import { env } from 'cloudflare:workers';
import {
  authorizeMutation,
  getEditorUser,
  readJson,
} from '@/lib/editor-access';
import { getPublicationStatus, publishCatalog } from '@/lib/catalog-repository';

function unavailable() {
  return Response.json({ error: 'Página não encontrada.' }, { status: 404 });
}

export async function GET() {
  if (env.WORKER_ROLE === 'public') return unavailable();
  if (!(await getEditorUser()))
    return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
  try {
    return Response.json(await getPublicationStatus(), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch {
    return Response.json(
      { error: 'Não foi possível consultar a publicação.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (env.WORKER_ROLE === 'public') return unavailable();
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    const input = await readJson(request);
    if (input?.confirm !== true)
      throw new Error('Confirmação explícita necessária.');
    return Response.json(await publishCatalog());
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível publicar o catálogo.',
      },
      { status: 400 },
    );
  }
}
