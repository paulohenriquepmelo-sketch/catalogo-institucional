import { env } from 'cloudflare:workers';
import { products as starterProducts, type Product } from '@/lib/catalog-data';

type ProductRecord = Product & { published: boolean };

export async function ensureCatalogSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      department TEXT NOT NULL,
      section TEXT NOT NULL,
      category TEXT NOT NULL,
      segment TEXT NOT NULL,
      brand TEXT NOT NULL,
      image TEXT NOT NULL,
      specs TEXT NOT NULL DEFAULT '[]',
      featured INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code ON products(code)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_products_taxonomy ON products(department, section, category)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_products_segment ON products(segment)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand)'),
  ]);

  const count = await db.prepare('SELECT COUNT(*) AS total FROM products').first<{ total: number }>();
  if ((count?.total ?? 0) === 0) {
    const now = new Date().toISOString();
    await db.batch(starterProducts.map((product) => db.prepare(`INSERT INTO products
      (code, name, description, department, section, category, segment, brand, image, specs, featured, published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
      .bind(product.code, product.name, product.description, product.department, product.section, product.category, product.segment, product.brand, product.image, JSON.stringify(product.specs), product.featured ? 1 : 0, now, now)));
  }
}

export async function listCatalogProducts(): Promise<ProductRecord[]> {
  await ensureCatalogSchema();
  const result = await env.DB.prepare('SELECT * FROM products ORDER BY featured DESC, updated_at DESC').all<Record<string, unknown>>();
  return result.results.map((row) => ({
    id: Number(row.id), code: String(row.code), name: String(row.name), description: String(row.description),
    department: String(row.department), section: String(row.section), category: String(row.category), segment: String(row.segment),
    brand: String(row.brand), image: String(row.image), specs: JSON.parse(String(row.specs || '[]')),
    featured: Boolean(row.featured), published: Boolean(row.published),
  }));
}

export async function saveCatalogProduct(product: Omit<ProductRecord, 'id'> & { id?: number }) {
  await ensureCatalogSchema();
  const now = new Date().toISOString();
  if (product.id) {
    await env.DB.prepare(`UPDATE products SET code=?, name=?, description=?, department=?, section=?, category=?, segment=?, brand=?, image=?, specs=?, featured=?, published=?, updated_at=? WHERE id=?`)
      .bind(product.code, product.name, product.description, product.department, product.section, product.category, product.segment, product.brand, product.image, JSON.stringify(product.specs), product.featured ? 1 : 0, product.published ? 1 : 0, now, product.id).run();
    return product.id;
  }
  const result = await env.DB.prepare(`INSERT INTO products
    (code, name, description, department, section, category, segment, brand, image, specs, featured, published, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(product.code, product.name, product.description, product.department, product.section, product.category, product.segment, product.brand, product.image, JSON.stringify(product.specs), product.featured ? 1 : 0, product.published ? 1 : 0, now, now).run();
  return Number(result.meta.last_row_id);
}

export async function removeCatalogProduct(id: number) {
  await ensureCatalogSchema();
  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
}
