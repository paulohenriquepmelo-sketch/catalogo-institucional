export function productImageSearchTerm(
  name: string,
  brand: string,
  code: string,
) {
  return [name.trim(), brand.trim(), code.trim()].filter(Boolean).join(' ').slice(0, 100);
}

export function productImageSearchUrl(query: string) {
  return (
    'https://www.google.com/search?tbm=isch&q=' +
    encodeURIComponent(query.trim() + ' produto')
  );
}
