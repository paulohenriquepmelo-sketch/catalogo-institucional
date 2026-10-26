import { env } from 'cloudflare:workers';
import type { CatalogConfig } from './catalog-config';
import {
  catalogDateKey,
  expireProductOffer,
  type Product,
} from './catalog-data';

export const PUBLISHED_CATALOG_KEY = 'catalog/published-v1.json';

export type PublishedCatalogSnapshot = {
  version: 1;
  revision: number;
  publishedAt: string;
  config: CatalogConfig;
  products: Product[];
};

export async function publishedCatalogSnapshotExists() {
  return Boolean(await env.FILES.head(PUBLISHED_CATALOG_KEY));
}

export async function readPublishedCatalogSnapshot() {
  const object = await env.FILES.get(PUBLISHED_CATALOG_KEY);
  if (!object) return null;
  const snapshot = await parseSnapshot(object);
  const today = catalogDateKey();
  return {
    ...snapshot,
    products: snapshot.products.map((product) =>
      expireProductOffer(product, today),
    ),
  };
}

async function parseSnapshot(object: {
  size: number;
  json<T>(): Promise<T>;
}) {
  if (object.size > 32 * 1024 * 1024)
    throw new Error('Snapshot publicado excede o limite permitido.');
  const snapshot = await object.json<PublishedCatalogSnapshot>();
  if (
    snapshot?.version !== 1 ||
    !Number.isInteger(snapshot.revision) ||
    typeof snapshot.publishedAt !== 'string' ||
    !snapshot.config ||
    !Array.isArray(snapshot.products)
  )
    throw new Error('Snapshot publicado inválido.');
  return snapshot;
}

// Histórico: antes de cada publicação a versão no ar é arquivada aqui, para
// o editor poder voltar o site para uma publicação anterior.
export const PUBLICATION_HISTORY_PREFIX = 'catalog/history/';
export const PUBLICATION_HISTORY_LIMIT = 10;
const HISTORY_ID = /^[0-9TZ-]{10,40}\.json$/;

export type PublicationHistoryEntry = {
  id: string;
  publishedAt: string;
  revision: number;
  products: number | null;
  size: number;
};

function snapshotMetadata(snapshot: PublishedCatalogSnapshot) {
  return {
    revision: String(snapshot.revision),
    publishedAt: snapshot.publishedAt,
    products: String(snapshot.products.length),
  };
}

async function archiveCurrentSnapshot() {
  const current = await env.FILES.get(PUBLISHED_CATALOG_KEY);
  if (!current) return;
  const bytes = await current.arrayBuffer();
  let metadata = current.customMetadata ?? {};
  // Publicações antigas não guardavam data e quantidade nos metadados.
  if (!metadata.publishedAt || !metadata.products) {
    const snapshot = JSON.parse(
      new TextDecoder().decode(bytes),
    ) as PublishedCatalogSnapshot;
    metadata = snapshotMetadata(snapshot);
  }
  const id =
    new Date(Date.parse(metadata.publishedAt) || Date.now())
      .toISOString()
      .replace(/[:.]/g, '-') + '.json';
  await env.FILES.put(PUBLICATION_HISTORY_PREFIX + id, bytes, {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: metadata,
  });
}

export async function listPublicationHistory(): Promise<
  PublicationHistoryEntry[]
> {
  // `include` existe no R2, mas falta nos tipos instalados.
  const listed = await env.FILES.list({
    prefix: PUBLICATION_HISTORY_PREFIX,
    include: ['customMetadata'],
  } as R2ListOptions);
  return listed.objects
    .map((object) => {
      const meta = object.customMetadata ?? {};
      const products = Number(meta.products);
      return {
        id: object.key.slice(PUBLICATION_HISTORY_PREFIX.length),
        publishedAt: meta.publishedAt ?? '',
        revision: Number(meta.revision) || 0,
        products: Number.isFinite(products) ? products : null,
        size: object.size,
      };
    })
    .filter((entry) => HISTORY_ID.test(entry.id))
    .sort((a, b) => b.id.localeCompare(a.id));
}

async function pruneHistory() {
  const entries = await listPublicationHistory();
  for (const entry of entries.slice(PUBLICATION_HISTORY_LIMIT))
    await env.FILES.delete(PUBLICATION_HISTORY_PREFIX + entry.id);
}

// Volta o site público para uma publicação do histórico. A versão que estava
// no ar também é arquivada, então a volta pode ser desfeita. O rascunho do
// editor não muda.
export async function restorePublication(id: string) {
  if (!HISTORY_ID.test(id)) throw new Error('Publicação não encontrada.');
  const object = await env.FILES.get(PUBLICATION_HISTORY_PREFIX + id);
  if (!object) throw new Error('Publicação não encontrada.');
  const snapshot = await parseSnapshot(object);
  await writePublishedCatalogSnapshot(snapshot);
  return {
    publishedAt: snapshot.publishedAt,
    productCount: snapshot.products.length,
  };
}

export async function writePublishedCatalogSnapshot(
  snapshot: PublishedCatalogSnapshot,
) {
  await archiveCurrentSnapshot();
  await env.FILES.put(PUBLISHED_CATALOG_KEY, JSON.stringify(snapshot), {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: snapshotMetadata(snapshot),
  });
  await pruneHistory();
}
