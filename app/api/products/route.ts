import {
  authorizeMutation,
  getEditorUser,
  readJson,
} from '@/lib/editor-access';
import {
  listCatalogProducts,
  listCatalogProductsPage,
  getPublishedCatalogSnapshot,
  saveCatalogProduct,
} from '@/lib/catalog-repository';
export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const editor = parameters.get('editor') === '1';
  if (editor && !(await getEditorUser()))
    return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
  try {
    if (parameters.get('paged') === '1') {
      const cursor = Number(parameters.get('cursor') ?? 0);
      const limit = Number(parameters.get('limit') ?? 200);
      if (
        !Number.isInteger(cursor) ||
        cursor < 0 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 250
      )
        return Response.json({ error: 'Página inválida.' }, { status: 400 });
      const items = editor
        ? await listCatalogProductsPage(true, cursor, limit)
        : (await getPublishedCatalogSnapshot()).products
            .filter((product) => product.id > cursor)
            .sort((left, right) => left.id - right.id)
            .slice(0, limit);
      return Response.json(
        {
          items,
          nextCursor: items.at(-1)?.id ?? cursor,
          done: items.length < limit,
        },
        {
          headers: {
            'cache-control': editor
              ? 'no-store'
              : 'public, max-age=60, must-revalidate',
          },
        },
      );
    }
    return Response.json(
      editor
        ? await listCatalogProducts(true)
        : (await getPublishedCatalogSnapshot()).products,
      {
        headers: {
          'cache-control': editor
            ? 'no-store'
            : 'public, max-age=60, must-revalidate',
        },
      },
    );
  } catch {
    return Response.json(
      { error: 'Não foi possível carregar os produtos. Tente novamente.' },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    return Response.json(await saveCatalogProduct(await readJson(request)));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Não foi possível salvar.',
      },
      { status: 400 },
    );
  }
}
