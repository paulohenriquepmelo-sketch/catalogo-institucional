import { env } from 'cloudflare:workers';
import {
  detailFields,
  type Product,
  type ProductDetails,
} from './catalog-data';
import {
  defaultConfig,
  type CatalogConfig,
  validateConfig,
  imageUrl,
} from './catalog-config';
import { classifySegment } from './segment-classifier';
import { defaultCampaign } from './catalog-campaign';
import { defaultColors } from './catalog-colors';
import { defaultLayout } from './catalog-layout';
import {
  publishedCatalogSnapshotExists,
  readPublishedCatalogSnapshot,
  type PublishedCatalogSnapshot,
  writePublishedCatalogSnapshot,
} from './published-catalog';

// Migrations own both the schema and the one-time spreadsheet import.
async function initializeData() {
  await env.DB.prepare(
    'INSERT OR IGNORE INTO catalog_config (id,body,revision) VALUES (1,?,1)',
  )
    .bind(JSON.stringify(defaultConfig))
    .run();
}
function normalizeConfig(row: { body: string; revision: number }) {
  const stored = JSON.parse(row.body) as CatalogConfig;
  const isLegacyNexoBrand = stored.name?.trim().toUpperCase() === 'NEXO';
  const storedBlocks = Array.isArray(stored.blocks) ? stored.blocks : [];
  const addedBlocks = defaultConfig.blocks.filter(
    (block) =>
      ['offers', 'new-products'].includes(block.type) &&
      !storedBlocks.some((storedBlock) => storedBlock.type === block.type),
  );
  const catalogIndex = storedBlocks.findIndex(
    (block) => block.type === 'catalog',
  );
  const blocks = [...storedBlocks];
  blocks.splice(catalogIndex < 0 ? 0 : catalogIndex + 1, 0, ...addedBlocks);
  return {
    config: {
      ...stored,
      ...(isLegacyNexoBrand
        ? {
            name: defaultConfig.name,
            tagline: defaultConfig.tagline,
            logo: defaultConfig.logo,
            footer: defaultConfig.footer,
            primary: defaultConfig.primary,
            accent: defaultConfig.accent,
            background: defaultConfig.background,
            colors: structuredClone(defaultConfig.colors),
          }
        : {}),
      layout: { ...defaultLayout, ...stored.layout },
      brands: stored.brands.map((brand) => ({
        ...brand,
        published: brand.published ?? true,
        featured: brand.featured === true,
      })),
      colors: { ...defaultColors, ...stored.colors },
      campaign: stored.campaign ?? structuredClone(defaultCampaign),
      offers: stored.offers ?? structuredClone(defaultConfig.offers),
      newProducts:
        stored.newProducts ?? structuredClone(defaultConfig.newProducts),
      blocks,
    },
    revision: row.revision,
  };
}

export async function getConfig() {
  let row = await env.DB.prepare(
    'SELECT body,revision FROM catalog_config WHERE id=1',
  ).first<{ body: string; revision: number }>();
  if (!row) {
    await initializeData();
    row = await env.DB.prepare(
      'SELECT body,revision FROM catalog_config WHERE id=1',
    ).first<{ body: string; revision: number }>();
  }
  if (!row) throw new Error('Configuração indisponível.');
  return normalizeConfig(row);
}

export async function ensurePublishedCatalog() {
  const existing = await env.DB.prepare(
    'SELECT id FROM published_catalog_config WHERE id=1',
  ).first<{ id: number }>();
  if (existing) return;
  await initializeData();
  const publishedAt = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT OR IGNORE INTO published_catalog_config (id,body,revision,published_at) SELECT id,body,revision,? FROM catalog_config WHERE id=1',
    ).bind(publishedAt),
    env.DB.prepare(
      `INSERT OR IGNORE INTO published_products
        (id,code,name,description,department,section,category,segment,brand,image,specs,details,featured,published,created_at,updated_at)
       SELECT id,code,name,description,department,section,category,segment,brand,image,specs,details,featured,published,created_at,updated_at
       FROM products WHERE published=1`,
    ),
  ]);
}

export async function getPublishedConfig() {
  const snapshot = await readPublishedCatalogSnapshot();
  if (snapshot) return { config: snapshot.config, revision: snapshot.revision };
  if (env.WORKER_ROLE === 'public')
    throw new Error('Versão publicada indisponível.');
  return getLegacyPublishedConfig();
}

async function getLegacyPublishedConfig() {
  await ensurePublishedCatalog();
  const row = await env.DB.prepare(
    'SELECT body,revision FROM published_catalog_config WHERE id=1',
  ).first<{ body: string; revision: number }>();
  if (!row) throw new Error('Versão publicada indisponível.');
  return normalizeConfig(row);
}

function mapProductRow(
  r: Record<string, unknown>,
  config: CatalogConfig,
  includePrivateDetails: boolean,
): Product {
  const details = JSON.parse(String(r.details ?? '{}')) as ProductDetails;
  if (!includePrivateDetails) {
    delete details.supplier;
    delete details.sourceFile;
    delete details.sourceRow;
  }
  const product = {
    id: Number(r.id),
    code: String(r.code),
    name: String(r.name),
    description: String(r.description),
    department: String(r.department),
    section: String(r.section),
    category: String(r.category),
    segment: String(r.segment),
    brand: String(r.brand),
    image: String(r.image),
    specs: JSON.parse(String(r.specs)),
    details,
    featured: Boolean(r.featured),
    published: Boolean(r.published),
    updatedAt: String(r.updated_at),
    createdAt: String(r.created_at),
  };
  return {
    ...product,
    segment: classifySegment(product, config.segments).segment,
  };
}

export async function listCatalogProducts(
  includeDrafts = false,
  codes?: string[],
): Promise<Product[]> {
  const { config } = await getConfig();
  if (codes?.length === 0) return [];
  const conditions = [
    includeDrafts ? '' : 'published=1',
    codes ? `code IN (${codes.map(() => '?').join(',')})` : '',
  ].filter(Boolean);
  const result = await env.DB.prepare(
    `SELECT * FROM products ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY featured DESC, name COLLATE NOCASE`,
  )
    .bind(...(codes ?? []))
    .all<Record<string, unknown>>();
  return result.results.map((row) => mapProductRow(row, config, includeDrafts));
}

export async function listPublishedProducts(codes?: string[]) {
  if (codes?.length === 0) return [];
  const snapshot = await readPublishedCatalogSnapshot();
  if (snapshot) {
    if (!codes) return snapshot.products;
    const selectedCodes = new Set(codes);
    return snapshot.products.filter((product) =>
      selectedCodes.has(product.code),
    );
  }
  if (env.WORKER_ROLE === 'public')
    throw new Error('Versão publicada indisponível.');
  const { config } = await getLegacyPublishedConfig();
  return listLegacyPublishedProducts(config, codes);
}

async function listLegacyPublishedProducts(
  config: CatalogConfig,
  codes?: string[],
) {
  const condition = codes
    ? `WHERE code IN (${codes.map(() => '?').join(',')})`
    : '';
  const result = await env.DB.prepare(
    `SELECT * FROM published_products ${condition} ORDER BY featured DESC, name COLLATE NOCASE`,
  )
    .bind(...(codes ?? []))
    .all<Record<string, unknown>>();
  return result.results.map((row) => mapProductRow(row, config, false));
}

export async function listCatalogProductsPage(
  includeDrafts: boolean,
  cursor: number,
  limit: number,
) {
  const { config } = await getConfig();
  const result = await env.DB.prepare(
    `SELECT * FROM products
     WHERE id > ?${includeDrafts ? '' : ' AND published=1'}
     ORDER BY id
     LIMIT ?`,
  )
    .bind(cursor, limit)
    .all<Record<string, unknown>>();
  return result.results.map((row) => mapProductRow(row, config, includeDrafts));
}

export async function listPublishedProductsPage(cursor: number, limit: number) {
  const snapshot = await readPublishedCatalogSnapshot();
  if (snapshot)
    return snapshot.products
      .filter((product) => product.id > cursor)
      .sort((left, right) => left.id - right.id)
      .slice(0, limit);
  if (env.WORKER_ROLE === 'public')
    throw new Error('Versão publicada indisponível.');
  const { config } = await getLegacyPublishedConfig();
  const result = await env.DB.prepare(
    'SELECT * FROM published_products WHERE id > ? ORDER BY id LIMIT ?',
  )
    .bind(cursor, limit)
    .all<Record<string, unknown>>();
  return result.results.map((row) => mapProductRow(row, config, false));
}

async function createPublishedCatalogSnapshot() {
  const { config, revision } = await getLegacyPublishedConfig();
  const products = await listLegacyPublishedProducts(config);
  const publication = await env.DB.prepare(
    'SELECT published_at FROM published_catalog_config WHERE id=1',
  ).first<{ published_at: string }>();
  const snapshot: PublishedCatalogSnapshot = {
    version: 1,
    revision,
    publishedAt: publication?.published_at ?? new Date().toISOString(),
    config,
    products,
  };
  return snapshot;
}

let publishedCatalogReady: Promise<void> | undefined;
async function ensurePublishedCatalogSnapshot() {
  publishedCatalogReady ??= (async () => {
    if (await publishedCatalogSnapshotExists()) return;
    await writePublishedCatalogSnapshot(await createPublishedCatalogSnapshot());
  })().catch((error) => {
    publishedCatalogReady = undefined;
    throw error;
  });
  return publishedCatalogReady;
}

export async function getPublishedCatalogSnapshot() {
  const snapshot = await readPublishedCatalogSnapshot();
  if (snapshot) return snapshot;

  // The public Worker must never fall back to D1. A missing R2 snapshot is
  // safer as a temporary 503 than an accidental database scan per visitor.
  if (env.WORKER_ROLE === 'public')
    throw new Error('Versão publicada indisponível.');

  const generated = await createPublishedCatalogSnapshot();
  try {
    await writePublishedCatalogSnapshot(generated);
  } catch {
    // Keep the public catalog available if R2 has a transient write failure.
  }
  return generated;
}

export async function getPublicationStatus() {
  const [{ revision }, snapshot] = await Promise.all([
    getConfig(),
    getPublishedCatalogSnapshot(),
  ]);
  const row = await env.DB.prepare(
    'SELECT EXISTS(SELECT 1 FROM products WHERE updated_at > ? LIMIT 1) AS changed_products',
  )
    .bind(snapshot.publishedAt)
    .first<{
      changed_products: number;
    }>();
  if (!row) throw new Error('Estado de publicação indisponível.');
  return {
    hasChanges: revision !== snapshot.revision || Boolean(row.changed_products),
    publishedAt: snapshot.publishedAt,
    draftRevision: revision,
    publishedRevision: snapshot.revision,
  };
}

async function listProductsForSnapshot(config: CatalogConfig) {
  const result = await env.DB.prepare(
    'SELECT * FROM products WHERE published=1 ORDER BY featured DESC, name COLLATE NOCASE',
  ).all<Record<string, unknown>>();
  return result.results.map((row) => mapProductRow(row, config, false));
}

export async function publishCatalog() {
  const { config, revision } = await getConfig();
  const products = await listProductsForSnapshot(config);
  const latestProductUpdate = products.reduce(
    (latest, product) => Math.max(latest, Date.parse(product.updatedAt) || 0),
    0,
  );
  const publishedAt = new Date(
    Math.max(Date.now(), latestProductUpdate + 1),
  ).toISOString();
  await writePublishedCatalogSnapshot({
    version: 1,
    revision,
    publishedAt,
    config,
    products,
  });
  return { hasChanges: false, publishedAt, productCount: products.length };
}
export function validateProduct(
  value: unknown,
  config: CatalogConfig,
): Product {
  if (!value || typeof value !== 'object') throw new Error('Produto inválido.');
  const v = value as Product;
  for (const key of [
    'name',
    'code',
    'description',
    'department',
    'section',
    'category',
    'brand',
  ] as const) {
    if (
      typeof v[key] !== 'string' ||
      (key !== 'description' && !v[key].trim()) ||
      v[key].length > (key === 'description' ? 4000 : 180)
    )
      throw new Error(`Revise o campo ${key}.`);
  }
  if (
    !Number.isInteger(v.id) ||
    v.id < 0 ||
    !Array.isArray(v.specs) ||
    v.specs.length > 50 ||
    v.specs.some((s) => typeof s !== 'string' || s.length > 250)
  )
    throw new Error('Produto inválido.');
  if (!config.brands.some((b) => b.name === v.brand))
    throw new Error('Cadastre a marca antes de vincular o produto.');
  if (
    !config.taxonomy.some(
      (t) =>
        t.department === v.department &&
        t.section === v.section &&
        t.category === v.category,
    )
  )
    throw new Error('Escolha uma hierarquia cadastrada.');
  const details: ProductDetails = {};
  for (const [key] of detailFields) {
    const value = v.details?.[key] ?? '';
    if (typeof value !== 'string' || value.length > 250)
      throw new Error('Revise os dados de embalagem e identificação.');
    details[key] = value.trim();
  }
  if (v.details?.sourceFile)
    details.sourceFile = String(v.details.sourceFile).slice(0, 120);
  if (Number.isInteger(v.details?.sourceRow))
    details.sourceRow = v.details?.sourceRow;
  if (v.details?.showAsNew !== undefined) {
    if (typeof v.details.showAsNew !== 'boolean')
      throw new Error('Revise a publicação na vitrine de novidades.');
    details.showAsNew = v.details.showAsNew;
  }
  if (v.details?.offer !== undefined) {
    const offer = v.details.offer;
    if (
      !offer ||
      typeof offer !== 'object' ||
      !Number.isInteger(offer.discount) ||
      offer.discount < 1 ||
      offer.discount > 99 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(offer.startsAt) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(offer.endsAt) ||
      offer.startsAt > offer.endsAt
    )
      throw new Error('Revise o desconto e o período da oferta.');
    details.offer = {
      enabled: offer.enabled === true,
      discount: offer.discount,
      startsAt: offer.startsAt,
      endsAt: offer.endsAt,
    };
  }
  return {
    id: v.id,
    name: v.name.trim(),
    code: v.code.trim(),
    description: v.description.trim(),
    department: v.department,
    section: v.section,
    category: v.category,
    brand: v.brand,
    image: imageUrl(v.image),
    specs: v.specs.map((s) => s.trim()).filter(Boolean),
    segment: classifySegment(v, config.segments).segment,
    featured: v.featured === true,
    published: v.published === true,
    updatedAt: v.updatedAt,
    createdAt: v.createdAt,
    details,
  };
}
export async function saveCatalogProduct(
  value: unknown,
  context?: { config: CatalogConfig; revision: number },
) {
  await ensurePublishedCatalogSnapshot();
  const { config, revision } = context ?? (await getConfig());
  const p = validateProduct(value, config);
  const previous = Date.parse(p.updatedAt ?? '');
  const now = new Date(
    Math.max(Date.now(), Number.isFinite(previous) ? previous + 1 : 0),
  ).toISOString();
  const args = [
    p.code,
    p.name,
    p.description,
    p.department,
    p.section,
    p.category,
    p.segment,
    p.brand,
    p.image,
    JSON.stringify(p.specs),
    JSON.stringify(p.details ?? {}),
    p.featured ? 1 : 0,
    p.published ? 1 : 0,
    now,
  ];
  let id = p.id;
  try {
    if (id) {
      const r = await env.DB.prepare(
        'UPDATE products SET code=?,name=?,description=?,department=?,section=?,category=?,segment=?,brand=?,image=?,specs=?,details=?,featured=?,published=?,updated_at=? WHERE id=? AND updated_at=? AND (SELECT revision FROM catalog_config WHERE id=1)=?',
      )
        .bind(...args, id, p.updatedAt ?? '', revision)
        .run();
      if (!r.meta.changes)
        throw new Error(
          'Cadastro alterado em outra sessão. Recarregue antes de salvar.',
        );
    } else {
      const r = await env.DB.prepare(
        'INSERT INTO products (code,name,description,department,section,category,segment,brand,image,specs,details,featured,published,updated_at,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT revision FROM catalog_config WHERE id=1)=?',
      )
        .bind(...args, now, revision)
        .run();
      if (!r.meta.changes)
        throw new Error('Configuração alterada. Recarregue antes de salvar.');
      id = Number(r.meta.last_row_id);
    }
  } catch (error) {
    if (String(error).includes('UNIQUE'))
      throw new Error('Já existe um produto com este código.');
    throw error;
  }
  return { ...p, id, updatedAt: now, createdAt: p.createdAt ?? now };
}
export async function saveConfig(value: unknown, revision: number) {
  await ensurePublishedCatalogSnapshot();
  const config = validateConfig(value);
  const products = await listCatalogProducts(true);
  for (const p of products) {
    if (!config.brands.some((b) => b.name === p.brand))
      throw new Error(
        `A marca ${p.brand} está em uso. Altere os produtos antes de removê-la.`,
      );
    if (
      !config.taxonomy.some(
        (t) =>
          t.department === p.department &&
          t.section === p.section &&
          t.category === p.category,
      )
    )
      throw new Error(
        `A categoria de ${p.name} está em uso. Mova o produto antes de removê-la.`,
      );
  }
  // The CAS revision and product timestamp guards prevent silent overwrites.
  const r = await env.DB.prepare(
    `UPDATE catalog_config SET body=?,revision=revision+1 WHERE id=1 AND revision=?
      AND NOT EXISTS (SELECT 1 FROM products p WHERE
        NOT EXISTS (SELECT 1 FROM json_each(?) b WHERE json_extract(b.value,'$.name')=p.brand)
        OR NOT EXISTS (SELECT 1 FROM json_each(?) t WHERE json_extract(t.value,'$.department')=p.department
          AND json_extract(t.value,'$.section')=p.section AND json_extract(t.value,'$.category')=p.category))`,
  )
    .bind(
      JSON.stringify(config),
      revision,
      JSON.stringify(config.brands),
      JSON.stringify(config.taxonomy),
    )
    .run();
  if (!r.meta.changes)
    throw new Error(
      'A página ou seus vínculos mudaram em outra sessão. Recarregue antes de salvar.',
    );
  // Segments are derived from the current configuration at read time as well.
  return { config, revision: revision + 1 };
}
