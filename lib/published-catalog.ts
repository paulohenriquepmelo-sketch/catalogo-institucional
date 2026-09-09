import { env } from 'cloudflare:workers';
import type { CatalogConfig } from './catalog-config';
import type { Product } from './catalog-data';

export const PUBLISHED_CATALOG_KEY = 'catalog/published-v1.json';

export type PublishedCatalogSnapshot = {
  version: 1;
  revision: number;
  publishedAt: string;
  config: CatalogConfig;
  products: Product[];
};

export async function readPublishedCatalogSnapshot() {
  const object = await env.FILES.get(PUBLISHED_CATALOG_KEY);
  if (!object) return null;
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

export async function writePublishedCatalogSnapshot(
  snapshot: PublishedCatalogSnapshot,
) {
  await env.FILES.put(PUBLISHED_CATALOG_KEY, JSON.stringify(snapshot), {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { revision: String(snapshot.revision) },
  });
}
