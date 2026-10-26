import { env } from 'cloudflare:workers';
import {
  createEditorSession,
  setEditorSessionCookie,
} from '@/app/chatgpt-auth';
import {
  authorizeMutation,
  getEditorUser,
  readJson,
} from '@/lib/editor-access';
import { verifyEditorPassword } from '@/lib/editor-credentials';
import {
  confirmTotpEnrollment,
  disableTotp,
  startTotpEnrollment,
  totpStatus,
} from '@/lib/editor-totp';

export async function GET() {
  if (env.WORKER_ROLE === 'public')
    return Response.json({ error: 'Página não encontrada.' }, { status: 404 });
  if (!(await getEditorUser()))
    return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
  return Response.json(await totpStatus(), {
    headers: { 'cache-control': 'no-store' },
  });
}

// Ativar (start → confirm) e desativar o autenticador. Pedem a senha atual;
// confirmar e desativar trocam a chave da sessão, então a resposta traz um
// cookie novo para esta tela continuar aberta (as outras sessões caem).
export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (
    env.LOGIN_LIMITER &&
    !(await env.LOGIN_LIMITER.limit({ key: `totp-setup:${ip}` })).success
  )
    return Response.json(
      { error: 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.' },
      { status: 429 },
    );
  try {
    const input = await readJson(request);
    const text = (value: unknown) => (typeof value === 'string' ? value : '');
    const renewSession = async () => ({
      'Set-Cookie': setEditorSessionCookie(
        await createEditorSession(),
        request.url,
      ),
      'cache-control': 'no-store',
    });
    switch (input?.action) {
      case 'start':
        if (!(await verifyEditorPassword(text(input.password))))
          throw new Error('Senha atual incorreta.');
        return Response.json(await startTotpEnrollment(), {
          headers: { 'cache-control': 'no-store' },
        });
      case 'confirm': {
        const result = await confirmTotpEnrollment(text(input.code));
        return Response.json(result, { headers: await renewSession() });
      }
      case 'disable':
        if (!(await verifyEditorPassword(text(input.password))))
          throw new Error('Senha atual incorreta.');
        await disableTotp(text(input.code));
        return Response.json({ ok: true }, { headers: await renewSession() });
      default:
        throw new Error('Ação inválida.');
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Não foi possível concluir.',
      },
      { status: 400 },
    );
  }
}
