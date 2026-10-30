import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { isOnline, isUnmetered, onNetworkChange } from '@/lib/network';

const MANIFEST_KEY = '@catalogo/images-manifest';
const IMAGE_DIR = `${FileSystem.documentDirectory ?? ''}catalogo-imagens/`;
const IMAGE_DOWNLOAD_CONCURRENCY = 2;
const MAX_QUEUED_IMAGE_DOWNLOADS = 24;

let manifest: Record<string, string> = {};
let manifestLoadPromise: Promise<void> | null = null;
let manifestDirty = false;
let manifestSaveTimer: ReturnType<typeof setTimeout> | null = null;
let savePromise: Promise<void> = Promise.resolve();

const priorityQueue: string[] = [];
const downloadQueue: string[] = [];
let bulkQueue: string[] = [];
const queuedUrls = new Set<string>();
const downloadingUrls = new Set<string>();
const protectedUrls = new Set<string>();
const waiters = new Map<string, Set<(uri: string | undefined) => void>>();
let activeDownloads = 0;

function fileNameFor(url: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const match = /\.(jpg|jpeg|png|webp|gif|avif|bmp)(\?|#|$)/i.exec(url);
  const extension = match ? match[1].toLowerCase() : 'img';
  return `${hash.toString(16)}-${url.length.toString(16)}.${extension}`;
}

async function ensureDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(IMAGE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
    }
  } catch {
    // As URLs remotas continuam disponíveis quando o disco falha.
  }
}

export async function loadImageManifest(): Promise<void> {
  if (manifestLoadPromise) return manifestLoadPromise;

  manifestLoadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(MANIFEST_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      const next: Record<string, string> = {};
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        for (const [url, file] of Object.entries(parsed)) {
          if (
            typeof file === 'string' &&
            /^[a-z0-9.-]+$/i.test(file)
          ) {
            next[url] = file;
          }
        }
      }
      manifest = next;
    } catch {
      manifest = {};
    }
    await ensureDir();
  })();

  return manifestLoadPromise;
}

function saveManifest(): Promise<void> {
  savePromise = savePromise.then(async () => {
    if (!manifestDirty) return;
    manifestDirty = false;
    try {
      await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
    } catch {
      manifestDirty = true;
    }
  });
  return savePromise;
}

function scheduleManifestSave(): void {
  if (manifestSaveTimer) return;
  manifestSaveTimer = setTimeout(() => {
    manifestSaveTimer = null;
    void saveManifest();
  }, 3_000);
}

/** Confere a existência real; um manifesto antigo não prova que o arquivo existe. */
export function localUriFor(url?: string): string | undefined {
  if (!url) return undefined;
  const file = manifest[url];
  if (!file) return undefined;

  const uri = `${IMAGE_DIR}${file}`;
  try {
    if (new File(uri).exists) return uri;
  } catch {
    // Arquivo removido ou inacessível: permite um novo download.
  }

  delete manifest[url];
  manifestDirty = true;
  scheduleManifestSave();
  return undefined;
}

function finishWaiters(url: string, uri: string | undefined): void {
  const callbacks = waiters.get(url);
  waiters.delete(url);
  for (const callback of callbacks ?? []) callback(uri);
}

function takeQueued(queue: string[]): string | undefined {
  while (queue.length > 0) {
    const url = queue.shift();
    if (!url || downloadingUrls.has(url)) continue;
    const local = localUriFor(url);
    if (local) {
      queuedUrls.delete(url);
      finishWaiters(url, local);
      continue;
    }
    return url;
  }
  return undefined;
}

function nextDownload(): string | undefined {
  const priority = takeQueued(priorityQueue);
  if (priority) return priority;

  const ordinary = takeQueued(downloadQueue);
  if (ordinary) return ordinary;

  if (!isUnmetered()) return undefined;
  while (bulkQueue.length > 0) {
    const url = bulkQueue.shift();
    if (!url || queuedUrls.has(url) || localUriFor(url)) continue;
    queuedUrls.add(url);
    return url;
  }
  return undefined;
}

function pumpDownloadQueue(): void {
  if (!isOnline()) return;

  while (activeDownloads < IMAGE_DOWNLOAD_CONCURRENCY) {
    const url = nextDownload();
    if (!url) return;

    activeDownloads += 1;
    downloadingUrls.add(url);

    void (async () => {
      const fileName = fileNameFor(url);
      const destination = `${IMAGE_DIR}${fileName}`;
      const temporary = `${destination}.download`;
      let saved: string | undefined;

      try {
        const result = await FileSystem.downloadAsync(url, temporary);
        if (result.status !== 200) return;

        await FileSystem.deleteAsync(destination, { idempotent: true });
        await FileSystem.moveAsync({ from: temporary, to: destination });
        manifest[url] = fileName;
        manifestDirty = true;
        saved = localUriFor(url);

        // Artes precisam persistir antes de liberar a abertura offline futura.
        if (protectedUrls.has(url)) await saveManifest();
        else scheduleManifestSave();
      } catch {
        // Sem rede ou espaço, o consumidor pode continuar com a URL remota.
      } finally {
        try {
          await FileSystem.deleteAsync(temporary, { idempotent: true });
        } catch {
          // Um temporário remanescente não impede a fila.
        }
        activeDownloads -= 1;
        downloadingUrls.delete(url);
        queuedUrls.delete(url);
        finishWaiters(url, saved);
        pumpDownloadQueue();
      }
    })();
  }
}

onNetworkChange(() => {
  if (!isOnline()) {
    // Não deixa consumidores aguardando uma fila pausada indefinidamente.
    for (const url of waiters.keys()) {
      if (!downloadingUrls.has(url)) finishWaiters(url, undefined);
    }
    return;
  }
  pumpDownloadQueue();
});

function enqueue(url: string, priority: boolean): boolean {
  if (queuedUrls.has(url)) {
    if (priority && !downloadingUrls.has(url) && !priorityQueue.includes(url)) {
      const index = downloadQueue.indexOf(url);
      if (index >= 0) downloadQueue.splice(index, 1);
      priorityQueue.push(url);
    }
    return true;
  }

  if (!priority && downloadQueue.length >= MAX_QUEUED_IMAGE_DOWNLOADS) return false;
  queuedUrls.add(url);
  (priority ? priorityQueue : downloadQueue).push(url);
  return true;
}

/** Downloads prioritários podem usar rede móvel, assim como imagens visíveis. */
export async function ensureCachedImage(
  url: string,
  priority = false,
): Promise<string | undefined> {
  await loadImageManifest();
  const local = localUriFor(url);
  if (local) return local;
  if (!/^https?:/i.test(url)) return url || undefined;
  if (!isOnline()) return undefined;

  return new Promise((resolve) => {
    if (!enqueue(url, priority)) {
      resolve(undefined);
      return;
    }
    let callbacks = waiters.get(url);
    if (!callbacks) {
      callbacks = new Set();
      waiters.set(url, callbacks);
    }
    callbacks.add(resolve);
    pumpDownloadQueue();
  });
}

/** Proteção atual, consultada novamente a cada remoção. */
export function protectThemeImages(urls: readonly string[]): void {
  protectedUrls.clear();
  for (const url of urls) {
    if (url) protectedUrls.add(url);
  }
}

/** Hero, fundo e painel precedem os extras e a fila comum do catálogo. */
export async function prefetchThemeImages(
  primary: readonly string[],
  extras: readonly string[],
): Promise<void> {
  await Promise.all(primary.map((url) => ensureCachedImage(url, true)));
  // Ignora extras de um tema que deixou de estar ativo durante o download.
  await Promise.all(
    extras
      .filter((url) => protectedUrls.has(url))
      .map((url) => ensureCachedImage(url, true)),
  );
}

export function prefetchAllImages(urls: (string | undefined)[]): void {
  void loadImageManifest().then(() => {
    bulkQueue = Array.from(new Set(
      urls.filter((url): url is string => Boolean(url && /^https?:/i.test(url))),
    )).filter((url) => !localUriFor(url));
    pumpDownloadQueue();
  });
}

export function useLocalImageUri(url?: string): string | undefined {
  const [saved, setSaved] = useState<{ url: string; uri: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (url) {
      void ensureCachedImage(url).then((uri) => {
        if (!cancelled && uri) setSaved({ url, uri });
      });
    }
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return undefined;

  // Confere o arquivo inclusive quando um download acabou de provocar o render.
  if (saved?.url === url) {
    const local = localUriFor(url);
    if (local) return local;
  }

  return localUriFor(url) ??
    (isOnline() || !/^https?:/i.test(url) ? url : undefined);
}

export async function pruneImages(
  validUrls: (string | undefined)[],
): Promise<void> {
  await loadImageManifest();
  const valid = new Set(
    validUrls.filter((url): url is string => typeof url === 'string' && url.length > 0),
  );

  for (const url of Object.keys(manifest)) {
    if (
      valid.has(url) ||
      protectedUrls.has(url) ||
      queuedUrls.has(url) ||
      downloadingUrls.has(url)
    ) continue;

    const file = manifest[url];
    if (!file) continue;

    try {
      await FileSystem.deleteAsync(`${IMAGE_DIR}${file}`, { idempotent: true });
      delete manifest[url];
      manifestDirty = true;
    } catch {
      // Mantém a entrada quando a remoção não foi concluída.
    }
  }

  await saveManifest();
}

export function savedImageCount(): number {
  return Object.keys(manifest).filter((url) => localUriFor(url) !== undefined).length;
}
