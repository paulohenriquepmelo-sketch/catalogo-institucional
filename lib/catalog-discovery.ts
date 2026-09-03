import type { Product } from './catalog-data';
import { normalize } from './catalog-config';

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
  return items
    .filter(
      (p) =>
        p.published !== false &&
        (
          ['department', 'section', 'category', 'brand', 'segment'] as const
        ).every((key) => !filters[key] || p[key] === filters[key]) &&
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
export function similarProducts(items: Product[], product: Product) {
  return items
    .filter((p) => p.id !== product.id && p.published !== false)
    .map((p) => ({
      p,
      score:
        (p.department === product.department &&
        p.section === product.section &&
        p.category === product.category
          ? 8
          : 0) +
        (p.brand === product.brand ? 1 : 0) +
        (p.department === product.department && p.section === product.section
          ? 3
          : 0) +
        (p.segment === product.segment && p.segment !== 'Sem classificação'
          ? 2
          : 0),
    }))
    .filter((x) => x.score > 1)
    .sort(
      (a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name, 'pt-BR'),
    )
    .slice(0, 3)
    .map((x) => x.p);
}
