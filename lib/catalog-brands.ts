import type { Brand } from './catalog-config';
export function publishedBrands(brands: Brand[]) {
  return brands
    .filter((brand) => brand.published === true)
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        a.name.localeCompare(b.name, 'pt-BR'),
    );
}
/**
 * Marca pública dos produtos cuja marca está despublicada no editor: no site
 * e no app eles aparecem juntos em "MULTIMARCAS" (no editor continuam com a
 * marca real; publicar a marca devolve o nome dela no site). Criar no editor
 * uma marca com este nome permite dar logo a ela.
 */
export const MULTIBRAND = 'MULTIMARCAS';

export function withMultibrand<T extends { brand: string }>(products: T[], brands: Brand[]) {
  const visible = new Set(publishedBrands(brands).map((b) => b.name));
  return products.map((p) => (visible.has(p.brand) ? p : { ...p, brand: MULTIBRAND }));
}

/** Marcas do site: as publicadas e, se algum produto cair nela, MULTIMARCAS. */
export function publicBrands(brands: Brand[], products: { brand: string }[]) {
  const list = publishedBrands(brands);
  if (list.some((b) => b.name === MULTIBRAND) || !products.some((p) => p.brand === MULTIBRAND))
    return list;
  return [...list, { name: MULTIBRAND, logo: '', published: true, featured: false }];
}

export function brandLogoSearchUrl(name: string) {
  return (
    'https://www.google.com/search?tbm=isch&q=' +
    encodeURIComponent(name.trim() + ' logo oficial')
  );
}
