import { env } from 'cloudflare:workers';
import { authorizeMutation, boundedBody, getEditorUser, publicError } from '@/lib/editor-access';
import { getErpFixes, saveErpFixes } from '@/lib/erp-fixes-repository';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  if (env.WORKER_ROLE === 'public')
    return Response.json({ error: 'Página não encontrada.' }, { status: 404 });
  if (!(await getEditorUser()))
    return Response.json(
      { error: 'Somente administradores autorizados podem editar.' },
      { status: 403 },
    );
  return Response.json(await getErpFixes(), { headers: NO_STORE });
}

export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new Error('Envie dados JSON.');
    // Até 1.500 correções por código cabem com folga em 600 KB.
    const input = JSON.parse(
      new TextDecoder().decode(await boundedBody(request, 600000)),
    ) as { fixes?: unknown; revision?: unknown };
    if (!Number.isInteger(input?.revision)) throw new Error('Revisão inválida.');
    return Response.json(await saveErpFixes(input.fixes, input.revision as number), {
      headers: NO_STORE,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof SyntaxError ? 'JSON inválido.' : publicError(error, 'Falha ao salvar.') },
      { status: 400 },
    );
  }
}
