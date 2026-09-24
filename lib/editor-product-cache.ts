import type { Product } from './catalog-data';

/**
 * Cache dos produtos do editor no navegador (IndexedDB, que aguenta os ~2 MB
 * do catálogo — o localStorage não). Ao abrir o editor, só os produtos
 * alterados desde a última carga são buscados no servidor, em vez de reler os
 * ~2.500 produtos do D1 toda vez. Uma vez por dia a carga é completa.
 */
export type ProductCache = {
  version: 1;
  /** Quando foi feita a última carga completa (ms). */
  fullAt: number;
  /** Posição da última alteração vista: (updatedAt, id). */
  since: string;
  afterId: number;
  items: Product[];
};

const DB_NAME = 'catalogo-editor';
const STORE = 'cache';
const KEY = 'products';
export const FULL_RELOAD_MS = 24 * 60 * 60 * 1000;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB falhou.'));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB falhou.'));
    });
  } finally {
    db.close();
  }
}

export async function readProductCache(): Promise<ProductCache | null> {
  try {
    const cache = await run<ProductCache | undefined>('readonly', (s) => s.get(KEY));
    return cache?.version === 1 && Array.isArray(cache.items) ? cache : null;
  } catch {
    return null;
  }
}

export async function writeProductCache(cache: ProductCache) {
  try {
    await run('readwrite', (s) => s.put(cache, KEY));
  } catch {
    // Sem cache, a próxima abertura só faz a carga completa.
  }
}

/** Última alteração vista numa lista de produtos: (updatedAt, id). */
export function latestChange(items: Product[]) {
  let since = '';
  let afterId = 0;
  for (const p of items) {
    const at = p.updatedAt ?? '';
    if (at > since || (at === since && p.id > afterId)) {
      since = at;
      afterId = p.id;
    }
  }
  return { since, afterId };
}

/** Junta as alterações ao cache (mesmo id: fica a versão nova). */
export function mergeProducts(cached: Product[], changed: Product[]) {
  const byId = new Map(cached.map((p) => [p.id, p]));
  for (const p of changed) byId.set(p.id, p);
  return [...byId.values()];
}
