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
  return loadEditorProducts();
}

type EditorProduct = import('./catalog-data').Product;

function sortForEditor(products: EditorProduct[]) {
  return products.sort(
    (left, right) =>
      Number(right.featured) - Number(left.featured) ||
      left.name.localeCompare(right.name, 'pt-BR'),
  );
}

/**
 * Editor: usa o cache do navegador e busca só o que mudou desde a última
 * carga (poucas linhas no D1). Sem cache, com cache de mais de um dia ou se
 * algo falhar, faz a carga completa e guarda para a próxima vez.
 */
async function loadEditorProducts(): Promise<EditorProduct[]> {
  const cacheModule = await import('./editor-product-cache');
  const cache = await cacheModule.readProductCache();
  if (cache && Date.now() - cache.fullAt < cacheModule.FULL_RELOAD_MS) {
    try {
      const changed: EditorProduct[] = [];
      let { since, afterId } = cache;
      for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
        const parameters = new URLSearchParams({
          editor: '1',
          since,
          afterId: String(afterId),
          limit: '200',
        });
        const page = await api<{
          items: EditorProduct[];
          since: string;
          afterId: number;
          done: boolean;
        }>(`/api/products?${parameters}`);
        changed.push(...page.items);
        since = page.since;
        afterId = page.afterId;
        if (page.done) {
          const items = cacheModule.mergeProducts(cache.items, changed);
          await cacheModule.writeProductCache({ ...cache, since, afterId, items });
          return sortForEditor(items);
        }
      }
    } catch {
      // Cai para a carga completa abaixo.
    }
  }
  const products = await loadAllEditorProducts();
  await cacheModule.writeProductCache({
    version: 1,
    fullAt: Date.now(),
    ...cacheModule.latestChange(products),
    items: products,
  });
  return sortForEditor(products);
}

async function loadAllEditorProducts(): Promise<EditorProduct[]> {
  type Product = EditorProduct;
  type Page = {
    items: Product[];
    nextCursor: number;
    done: boolean;
  };
  const products: Product[] = [];
  let cursor = 0;
  for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
    const parameters = new URLSearchParams({
      paged: '1',
      cursor: String(cursor),
      limit: '200',
    });
    parameters.set('editor', '1');
    const page = await api<Page>(`/api/products?${parameters}`);
    products.push(...page.items);
    if (page.done) return products;
    if (page.nextCursor <= cursor)
      throw new Error('A paginação dos produtos não avançou.');
    cursor = page.nextCursor;
  }
  throw new Error('O catálogo excedeu o limite de páginas permitido.');
}
