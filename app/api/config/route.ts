import {
  getConfig,
  getPublishedCatalogSnapshot,
  saveConfig,
} from '@/lib/catalog-repository';
import {
  authorizeMutation,
  getEditorUser,
  readJson,
} from '@/lib/editor-access';
import { publishedBrands } from '@/lib/catalog-brands';
export async function GET(request: Request) {
  const editor = new URL(request.url).searchParams.get('editor') === '1';
  if (editor && !(await getEditorUser()))
    return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
  try {
    const settings = editor
      ? await getConfig()
      : await getPublishedCatalogSnapshot().then(({ config, revision }) => ({
          config,
          revision,
        }));
    if (!editor)
      settings.config.brands = publishedBrands(settings.config.brands);
    return Response.json(settings, {
      headers: {
        'cache-control': editor
          ? 'no-store'
          : 'public, max-age=60, must-revalidate',
      },
    });
  } catch {
    return Response.json(
      { error: 'Configuração temporariamente indisponível.' },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    const body = await readJson(request);
    if (!Number.isInteger(body.revision)) throw new Error('Revisão inválida.');
    return Response.json(await saveConfig(body.config, body.revision));
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
