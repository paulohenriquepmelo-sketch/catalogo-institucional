import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { isOnline, isUnmetered, onNetworkChange, useIsOnline } from '@/lib/network';

/**
 * Armazenamento PERMANENTE de imagens no aparelho.
 *
 * As imagens são gravadas como arquivos na pasta do app e um "manifesto"
 * guarda a relação URL → arquivo local, para o catálogo continuar visível
 * sem internet.
 *
 * Desempenho: imagens que entram na janela visível são enfileiradas primeiro,
 * com no máximo dois downloads simultâneos. No Wi-Fi, o restante do catálogo
 * é baixado em segundo plano (fila "completa"), para tudo aparecer offline.
 * O card atual não redesenha ao terminar de salvar; o arquivo local passa a
 * ser usado na próxima montagem.
 */

const MANIFEST_KEY = '@catalogo/images-manifest';
const IMAGE_DIR = `${FileSystem.documentDirectory ?? ''}catalogo-imagens/`;

let manifest: Record<string, string> = {};
let manifestLoadPromise: Promise<void> | null = null;
let manifestDirty = false;

let manifestSaveTimer: ReturnType<typeof setTimeout> | null = null;

// Uma fila única impede que dezenas de cards iniciem downloads ao mesmo
// tempo quando entram na janela da FlatList.
const IMAGE_DOWNLOAD_CONCURRENCY = 2;
const MAX_QUEUED_IMAGE_DOWNLOADS = 24;
const downloadQueue: string[] = [];
const queuedUrls = new Set<string>();
let activeDownloads = 0;

// Fila do catálogo inteiro, usada só em Wi-Fi e sempre depois da fila acima
// (o que está na tela tem prioridade). São ~2.400 fotos, ~120 MB no total.
let bulkQueue: string[] = [];

// Nome de arquivo estável e curto derivado da URL (FNV-1a).
function fileNameFor(url: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i += 1) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const match = /\.(jpg|jpeg|png|webp|gif|avif|bmp)(\?|#|$)/i.exec(url);
  const ext = match ? match[1].toLowerCase() : 'img';
  return `${hash.toString(16)}-${url.length.toString(16)}.${ext}`;
}

async function ensureDir() {
  try {
    const info = await FileSystem.getInfoAsync(IMAGE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
    }
  } catch {
    // Sem permissão/espaço: seguimos usando as URLs remotas.
  }
}

export async function loadImageManifest(): Promise<void> {
  if (manifestLoadPromise) return manifestLoadPromise;
  manifestLoadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(MANIFEST_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      manifest = parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      manifest = {};
    }
    await ensureDir();
  })();
  return manifestLoadPromise;
}

async function saveManifest() {
  if (!manifestDirty) return;
  manifestDirty = false;
  try {
    await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  } catch {
    // Manifesto é otimização: sem ele as imagens são rebaixadas depois.
  }
}

function scheduleManifestSave() {
  if (manifestSaveTimer) return;
  // 3 s: durante o download completo, o manifesto não é regravado a cada foto.
  manifestSaveTimer = setTimeout(() => {
    manifestSaveTimer = null;
    void saveManifest();
  }, 3_000);
}

function nextDownload(): string | undefined {
  if (downloadQueue.length) return downloadQueue.shift();
  if (!isUnmetered()) return undefined;
  while (bulkQueue.length) {
    const url = bulkQueue.shift()!;
    if (!manifest[url] && !queuedUrls.has(url)) {
      queuedUrls.add(url);
      return url;
    }
  }
  return undefined;
}

function pumpDownloadQueue() {
  if (!isOnline()) return;
  while (activeDownloads < IMAGE_DOWNLOAD_CONCURRENCY) {
    const url = nextDownload();
    if (!url) return;
    activeDownloads += 1;

    void (async () => {
      const fileName = fileNameFor(url);
      try {
        const result = await FileSystem.downloadAsync(url, `${IMAGE_DIR}${fileName}`);
        if (result.status !== 200) return;
        manifest[url] = fileName;
        manifestDirty = true;
        scheduleManifestSave();
      } catch {
        // Sem rede ou espaço: a imagem remota continua sendo usada.
      } finally {
        activeDownloads -= 1;
        queuedUrls.delete(url);
        pumpDownloadQueue();
      }
    })();
  }
}

// Retoma os downloads quando a internet (ou o Wi-Fi) volta.
onNetworkChange(pumpDownloadQueue);

/**
 * Agenda o download de todas as imagens do catálogo que ainda não estão no
 * aparelho. Só baixa em Wi-Fi; no 4G/5G a lista fica guardada e o download
 * começa sozinho quando o Wi-Fi voltar.
 */
export function prefetchAllImages(urls: (string | undefined)[]) {
  void loadImageManifest().then(() => {
    bulkQueue = Array.from(
      new Set(urls.filter((url): url is string => Boolean(url && /^https?:/i.test(url)))),
    ).filter((url) => !manifest[url]);
    pumpDownloadQueue();
  });
}

function cacheImageOnDemand(url: string) {
  if (!/^https?:/i.test(url) || !isOnline()) return;
  void loadImageManifest().then(() => {
    if (manifest[url] || queuedUrls.has(url)) return;
    if (downloadQueue.length >= MAX_QUEUED_IMAGE_DOWNLOADS) return;
    queuedUrls.add(url);
    downloadQueue.push(url);
    pumpDownloadQueue();
  });
}

/** Caminho local da imagem, se ela já estiver salva no aparelho. */
export function localUriFor(url?: string): string | undefined {
  if (!url) return undefined;
  const file = manifest[url];
  return file ? `${IMAGE_DIR}${file}` : undefined;
}

/**
 * Devolve o caminho local quando a imagem já está salva; senão a URL remota.
 * Sem internet e sem arquivo salvo, devolve `undefined` em vez de tentar a
 * URL remota (que só falharia e redesenharia a tela à toa).
 * O salvamento ocorre em segundo plano sem redesenhar o card atual.
 */
export function useLocalImageUri(url?: string): string | undefined {
  const online = useIsOnline();
  useEffect(() => {
    if (url && online) cacheImageOnDemand(url);
  }, [url, online]);

  if (!url) return undefined;
  return localUriFor(url) ?? (online || !/^https?:/i.test(url) ? url : undefined);
}

/** Apaga arquivos de imagens que não fazem mais parte do catálogo. */
export async function pruneImages(validUrls: (string | undefined)[]): Promise<void> {
  await loadImageManifest();
  const valid = new Set(validUrls.filter(Boolean) as string[]);
  let changed = false;

  for (const url of Object.keys(manifest)) {
    if (valid.has(url)) continue;
    const file = manifest[url];
    try {
      await FileSystem.deleteAsync(`${IMAGE_DIR}${file}`, { idempotent: true });
    } catch {
      // Ignora falha de remoção — no pior caso ocupa espaço.
    }
    delete manifest[url];
    manifestDirty = true;
    changed = true;
  }

  if (changed) await saveManifest();
}

/** Quantas imagens já estão salvas no aparelho. */
export function savedImageCount(): number {
  return Object.keys(manifest).length;
}
