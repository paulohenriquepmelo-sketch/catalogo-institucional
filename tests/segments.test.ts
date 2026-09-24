import { test } from 'node:test';
import assert from 'node:assert/strict';
import { products } from './fixtures';
import { discover, emptyFilters, similarProducts } from '../lib/catalog-discovery';
import { buildSegments } from '../lib/segments';
import { complementProducts } from '../lib/complements';
import type { Product } from '../lib/catalog-data';

// Produtos com nomes e categorias reais do catálogo publicado.
let nextId = 5000;
const make = (name: string, category: string, extra: Partial<Product> = {}): Product => ({
  ...products[0],
  id: nextId++,
  name,
  category,
  department: '1-ATACADO',
  section: '1-ALIMENTOS',
  brand: 'MARCA',
  published: true,
  ...extra,
});

const catalog = [
  make('CHOCO SNICKERS TRADICIONAL 45G', '2.4-CHOCOLATES', { section: '2-BOMBONIERI' }),
  make('CHOCO SNICKERS DARK 40G', '2.4-CHOCOLATES', { section: '2-BOMBONIERI' }),
  make('CHOCO SNICKERS MORANGO 42G', '2.4-CHOCOLATES', { section: '2-BOMBONIERI' }),
  make('BOMBOM GAROTO SORTIDO 250G', '2.4-CHOCOLATES', { section: '2-BOMBONIERI' }),
  make('BRINQ CONFEITO AQUA MANIA', '2.5-DOCES / BRINQUEDOS', { section: '2-BOMBONIERI' }),
  make('FAR TRIGO PROFISSIONAL D.BENTA 25KG', 'DONA BENTA', { section: '5-DONA BENTA PANIFICAÇÃO' }),
  make('CATCHUP CALCUTA GALAO 3,4KG', '1.1-FOOD SERVICE'),
  make('CATCHUP CALCUTA 200G', '1.2-MERCEARIA'),
  make('SACOLA PAPEL 7,5KG COMPAPEL 26,5X39', 'SACOLAS/ BOBINAS/ SACOS PP', { section: '8-EMBALAGENS & EPS' }),
  make('MAC OVOS STA AMALIA PENA 500G', '1.6-SANTA AMALIA'),
  make('MOLHO TOMATE DAJUDA PEDACOS 200G', '1.2-MERCEARIA'),
];

void test('similar products: up to 8, same product line first, no unrelated fillers', () => {
  const snickers = catalog[0];
  const similar = similarProducts(catalog, snickers);
  assert.ok(similar.length <= 8);
  assert.deepEqual(
    similar.slice(0, 2).map((p) => p.name),
    ['CHOCO SNICKERS DARK 40G', 'CHOCO SNICKERS MORANGO 42G'],
  );
  const flour = catalog.find((p) => p.name.startsWith('FAR TRIGO'))!;
  assert.ok(!similarProducts(catalog, flour).some((p) => p.name.startsWith('BRINQ')));
});

void test('segments: a product can be in several segments; food service needs a big pack', () => {
  const segments = buildSegments(catalog);
  const where = (name: string) =>
    segments.filter((s) => s.products.some((p) => p.name === name)).map((s) => s.rule.id);
  const bag = where('SACOLA PAPEL 7,5KG COMPAPEL 26,5X39');
  assert.ok(bag.includes('padarias') && bag.includes('restaurantes') && bag.includes('delivery'));
  const restaurant = segments.find((s) => s.rule.id === 'restaurantes')!;
  const sauces = restaurant.groups.find((g) => g.name === 'Molhos food service')!.products.map((p) => p.name);
  assert.deepEqual(sauces, ['CATCHUP CALCUTA GALAO 3,4KG']);
});

void test('complements: pasta suggests tomato sauce', () => {
  const pasta = catalog.find((p) => p.name.startsWith('MAC OVOS'))!;
  const suggested = complementProducts(catalog, pasta, 4, new Set());
  assert.equal(suggested[0]?.name, 'MOLHO TOMATE DAJUDA PEDACOS 200G');
});

void test('search filter accepts the new segment names (and still the stored one)', () => {
  const found = discover(catalog, { ...emptyFilters, segment: 'Padarias e confeitarias' });
  assert.ok(found.some((p) => p.name.startsWith('FAR TRIGO')));
  assert.ok(!found.some((p) => p.name.startsWith('CERVEJA')));
});
