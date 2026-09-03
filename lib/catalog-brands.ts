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
export function brandLogoSearchUrl(name: string) {
  return (
    'https://www.google.com/search?tbm=isch&q=' +
    encodeURIComponent(name.trim() + ' logo oficial')
  );
}
