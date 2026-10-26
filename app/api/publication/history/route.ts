import { env } from 'cloudflare:workers';
import {
  authorizeMutation,
  getEditorUser,
  readJson,
  publicError,
} from '@/lib/editor-access';
import {
  listPublicationHistory,
  restorePublication,
} from '@/lib/published-catalog';

function unavailable() {
  return Response.json({ error: 'Página não encontrada.' }, { status: 404 });
}

// Publicações anteriores guardadas antes de cada nova publicação.
export async function GET() {
  if (env.WORKER_ROLE === 'public') return unavailable();
  if (!(await getEditorUser()))
    return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
  try {
    return Response.json(
      { entries: await listPublicationHistory() },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { error: 'Não foi possível consultar o histórico de publicações.' },
      { status: 503 },
    );
  }
}

// Volta o site público para uma publicação do histórico.
export async function POST(request: Request) {
  if (env.WORKER_ROLE === 'public') return unavailable();
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    const input = await readJson(request);
    if (input?.confirm !== true)
      throw new Error('Confirmação explícita necessária.');
    if (typeof input.id !== 'string')
      throw new Error('Publicação não encontrada.');
    return Response.json(await restorePublication(input.id));
  } catch (error) {
    return Response.json(
      {
        error:
          publicError(error, 'Não foi possível voltar a publicação.'),
      },
      { status: 400 },
    );
  }
}
