export async function api<T>(
  url: string,
  body?: unknown,
  signal?: AbortSignal,
  cache: RequestCache = 'no-store',
): Promise<T> {
  const response = await fetch(
    url,
    body === undefined
      ? { cache, signal }
      : {
          method: 'POST',
          signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok || data === null)
    throw new Error(
      data?.error ?? 'Não foi possível concluir. Tente novamente.',
    );
  return data as T;
}

export async function loadProducts(
  editor = false,
): Promise<import('./catalog-data').Product[]> {
  type Product = import('./catalog-data').Product;
  type Page = {
    items: Product[];
    nextCursor: number;
    done: boolean;
  };
  if (!editor) {
    const products = await api<Product[]>(
      '/api/products',
      undefined,
      undefined,
      'default',
    );
    return products.sort(
      (left, right) =>
        Number(right.featured) - Number(left.featured) ||
        left.name.localeCompare(right.name, 'pt-BR'),
    );
  }
  const products: Product[] = [];
  let cursor = 0;
  for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
    const parameters = new URLSearchParams({
      paged: '1',
      cursor: String(cursor),
      limit: '200',
    });
    if (editor) parameters.set('editor', '1');
    const page = await api<Page>(`/api/products?${parameters}`);
    products.push(...page.items);
    if (page.done) {
      return products.sort(
        (left, right) =>
          Number(right.featured) - Number(left.featured) ||
          left.name.localeCompare(right.name, 'pt-BR'),
      );
    }
    if (page.nextCursor <= cursor)
      throw new Error('A paginação dos produtos não avançou.');
    cursor = page.nextCursor;
  }
  throw new Error('O catálogo excedeu o limite de páginas permitido.');
}
