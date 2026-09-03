import {
  authorizeMutation,
  getEditorUser,
  readJson,
} from '@/lib/editor-access';
import {
  listCatalogProducts,
  saveCatalogProduct,
} from '@/lib/catalog-repository';
export async function GET(request: Request) {
  const editor = new URL(request.url).searchParams.get('editor') === '1';
  if (editor && !(await getEditorUser()))
    return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
  try {
    return Response.json(await listCatalogProducts(editor), {
      headers: { 'cache-control': 'no-store' },
    });
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
