import { env } from 'cloudflare:workers';
import {
  createEditorSession,
  setEditorSessionCookie,
} from '@/app/chatgpt-auth';
import {
  authorizeMutation,
  getEditorUser,
  readJson,
  publicError,
} from '@/lib/editor-access';
import {
  changeEditorPassword,
  editorPasswordInfo,
} from '@/lib/editor-credentials';

export async function GET() {
  if (env.WORKER_ROLE === 'public')
    return Response.json({ error: 'Página não encontrada.' }, { status: 404 });
  if (!(await getEditorUser()))
    return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
  return Response.json(await editorPasswordInfo(), {
    headers: { 'cache-control': 'no-store' },
  });
}

// Troca a senha do editor. Exige sessão, mesma origem e a senha atual; usa o
// mesmo limite de tentativas do login. As outras sessões são encerradas e
// esta recebe um cookie novo.
export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (
    env.LOGIN_LIMITER &&
    !(await env.LOGIN_LIMITER.limit({ key: `password:${ip}` })).success
  )
    return Response.json(
      { error: 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.' },
      { status: 429 },
    );
  try {
    const input = await readJson(request);
    if (typeof input?.current !== 'string' || typeof input?.next !== 'string')
      throw new Error('Informe a senha atual e a nova.');
    const result = await changeEditorPassword(input.current, input.next);
    return Response.json(result, {
      headers: {
        'Set-Cookie': setEditorSessionCookie(
          await createEditorSession(),
          request.url,
        ),
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          publicError(error, 'Não foi possível trocar a senha.'),
      },
      { status: 400 },
    );
  }
}
