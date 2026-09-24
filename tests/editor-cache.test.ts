import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database } from './runtime';
import { listCatalogProductsChangedSince } from '../lib/catalog-repository';
import { latestChange, mergeProducts } from '../lib/editor-product-cache';
import { products } from './fixtures';

// Produtos "alterados no futuro", para não depender do resto do banco de teste.
const FUTURE = '2999-01-01T00:00:00.000Z';
const insert = database.prepare(
  `INSERT INTO products (code,name,description,department,section,category,segment,brand,image,specs,details,featured,published,created_at,updated_at)
   VALUES (?,?,'','D','S','C','Sem classificação','B','','[]','{}',0,1,?,?)`,
);
for (const [code, at] of [
  ['CACHE-1', '2999-01-02T00:00:00.000Z'],
  ['CACHE-2', '2999-01-02T00:00:00.000Z'], // mesmo horário: desempata pelo id
  ['CACHE-3', '2999-01-03T00:00:00.000Z'],
])
  insert.run(code, `Produto ${code}`, at, at);

void test('editor loads only products changed since the last load, paginated without skipping ties', async () => {
  const first = await listCatalogProductsChangedSince(FUTURE, 0, 2);
  assert.deepEqual(first.map((p) => p.code), ['CACHE-1', 'CACHE-2']);
  const last = first.at(-1)!;
  const second = await listCatalogProductsChangedSince(last.updatedAt!, last.id, 2);
  assert.deepEqual(second.map((p) => p.code), ['CACHE-3']);
  const none = await listCatalogProductsChangedSince('2999-01-03T00:00:00.000Z', second[0].id, 2);
  assert.equal(none.length, 0);
  // Pelo índice de updated_at: só as linhas alteradas são lidas.
  const plan = database
    .prepare(
      'EXPLAIN QUERY PLAN SELECT * FROM products WHERE updated_at >= ? AND (updated_at > ? OR id > ?) ORDER BY updated_at, id LIMIT ?',
    )
    .all(FUTURE, FUTURE, 0, 200)
    .map((row) => String((row as { detail: string }).detail))
    .join(' | ');
  assert.match(plan, /idx_products_updated_at/, plan);
});

void test('browser cache merges changes by id and tracks the latest change', () => {
  const a = { ...products[0], id: 1, name: 'A', updatedAt: '2026-01-01T00:00:00.000Z' };
  const b = { ...products[0], id: 2, name: 'B', updatedAt: '2026-01-02T00:00:00.000Z' };
  const bNew = { ...b, name: 'B novo', updatedAt: '2026-01-03T00:00:00.000Z' };
  const c = { ...products[0], id: 3, name: 'C', updatedAt: '2026-01-03T00:00:00.000Z' };
  const merged = mergeProducts([a, b], [bNew, c]);
  assert.deepEqual(merged.map((p) => p.name).sort(), ['A', 'B novo', 'C']);
  assert.deepEqual(latestChange(merged), { since: '2026-01-03T00:00:00.000Z', afterId: 3 });
});
