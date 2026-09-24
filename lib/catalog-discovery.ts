import type { Product } from './catalog-data';
import { normalize } from './catalog-config';
import { buildSegments } from './segments';

// Segmentos (regras novas, multi-segmento) de cada produto, por catálogo.
const segmentNamesCache = new WeakMap<Product[], Map<number, Set<string>>>();
function segmentNamesOf(items: Product[]) {
  let map = segmentNamesCache.get(items);
  if (!map) {
    map = new Map();
    for (const segment of buildSegments(items)) {
      const name = normalize(segment.rule.name);
      for (const p of segment.products) {
        let names = map.get(p.id);
        if (!names) map.set(p.id, (names = new Set()));
        names.add(name);
      }
    }
    segmentNamesCache.set(items, map);
  }
  return map;
}

export type Filters = {
  query: string;
  department: string;
  section: string;
  category: string;
  brand: string;
  segment: string;
  sort: 'featured' | 'name';
};
export const emptyFilters: Filters = {
  query: '',
  department: '',
  section: '',
  category: '',
  brand: '',
  segment: '',
  sort: 'featured',
};
export function discover(items: Product[], filters: Filters) {
  const terms = normalize(filters.query).split(/\s+/).filter(Boolean);
  // Segmento: vale o das regras novas (um produto pode ter vários) ou o antigo
  // gravado no produto.
  const segment = filters.segment ? normalize(filters.segment) : '';
  const segmentNames = segment ? segmentNamesOf(items) : null;
  return items
    .filter(
      (p) =>
        p.published !== false &&
        (['department', 'section', 'category', 'brand'] as const).every(
          (key) => !filters[key] || p[key] === filters[key],
        ) &&
        (!segment ||
          p.segment === filters.segment ||
          Boolean(segmentNames?.get(p.id)?.has(segment))) &&
        terms.every((term) =>
          normalize(
            [
              p.name,
              p.code,
              p.description,
              p.brand,
              p.department,
              p.section,
              p.category,
              p.segment,
              p.details?.packaging,
              p.details?.ean,
              p.details?.masterEan,
              ...p.specs,
            ].join(' '),
          ).includes(term),
        ),
    )
    .sort(
      (a, b) =>
        (filters.sort === 'featured'
          ? Number(!!b.featured) - Number(!!a.featured)
          : 0) || a.name.localeCompare(b.name, 'pt-BR'),
    );
}
// Palavras do nome que identificam o produto (sem números, medidas e siglas
// curtas), guardadas por produto para não refazer a cada abertura.
const nameWordsCache = new WeakMap<Product, Set<string>>();
function nameWords(product: Product) {
  let words = nameWordsCache.get(product);
  if (!words) {
    words = new Set(
      product.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((word) => word.length >= 3),
    );
    nameWordsCache.set(product, words);
  }
  return words;
}

export function similarProducts(items: Product[], product: Product, limit = 8): Product[] {
  // Uma passada só, guardando os melhores. Ordenar o catálogo inteiro
  // (milhares de itens, com localeCompare) travava a abertura do produto.
  const best: { p: Product; score: number }[] = [];
  const beats = (a: { p: Product; score: number }, b: { p: Product; score: number }) =>
    a.score > b.score ||
    (a.score === b.score && a.p.name.localeCompare(b.p.name, 'pt-BR') < 0);
  const words = nameWords(product);

  for (const p of items) {
    if (p.id === product.id || p.published === false) continue;
    const sameSection = p.department === product.department && p.section === product.section;
    let score =
      (sameSection && p.category === product.category ? 8 : 0) +
      (p.brand === product.brand ? 1 : 0) +
      (sameSection ? 3 : 0) +
      (p.segment === product.segment && p.segment !== 'Sem classificação' ? 2 : 0);
    if (score <= 1) continue;
    // Mesma linha de produto (outros sabores/tamanhos) vem antes: +1 por
    // palavra do nome em comum, até 4.
    let shared = 0;
    for (const word of nameWords(p)) if (words.has(word) && ++shared === 4) break;
    // Só marca/segmento em comum não basta (o segmento do site às vezes erra):
    // precisa ser da mesma seção ou ter algo em comum no nome.
    if (!sameSection && shared === 0) continue;
    score += shared;
    // Descarta cedo quem nem empata com o último colocado: evita o localeCompare.
    if (best.length === limit && score < best[limit - 1].score) continue;

    const entry = { p, score };
    let i = best.length;
    while (i > 0 && beats(entry, best[i - 1])) i -= 1;
    if (i < limit) {
      best.splice(i, 0, entry);
      if (best.length > limit) best.pop();
    }
  }
  return best.map((x) => x.p);
}
