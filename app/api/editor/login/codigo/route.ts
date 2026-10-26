import { env } from 'cloudflare:workers';
import {
  clearMfaChallenge,
  createEditorSession,
  hasValidMfaChallenge,
  setEditorSessionCookie,
} from '@/app/chatgpt-auth';
import { verifySecondFactor } from '@/lib/editor-totp';

// Segunda etapa do login: código do autenticador (ou de recuperação), só
// depois da senha certa (cookie de desafio válido por 5 minutos).
export async function POST(request: Request) {
  if (env.WORKER_ROLE === 'public')
    return new Response('Não encontrado.', { status: 404 });
  const form = await request.formData().catch(() => null);
  const rawReturn = form?.get('return_to');
  const returnTo = typeof rawReturn === 'string' ? rawReturn : '/editor';
  const safeReturnTo =
    returnTo.startsWith('/') &&
    !returnTo.startsWith('//') &&
    !/[\\\r\n]/.test(returnTo)
      ? returnTo
      : '/editor';
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return new Response('Origem não autorizada.', { status: 403 });
  const back = (error: string, step = true) =>
    Response.redirect(
      new URL(
        `/editor/login?${step ? 'etapa=codigo&' : ''}error=${error}&return_to=${encodeURIComponent(safeReturnTo)}`,
        request.url,
      ),
      303,
    );
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (
    env.LOGIN_LIMITER &&
    !(await env.LOGIN_LIMITER.limit({ key: `totp:${ip}` })).success
  )
    return back('limit');
  // Sem a senha conferida há pouco, volta para a senha.
  if (!(await hasValidMfaChallenge(request.headers.get('cookie'))))
    return back('expirou', false);
  const rawCode = form?.get('codigo');
  const code = typeof rawCode === 'string' ? rawCode.slice(0, 40) : '';
  if (!(await verifySecondFactor(code))) return back('codigo');
  const headers = new Headers({
    Location: safeReturnTo,
    'Cache-Control': 'private, no-store',
  });
  headers.append(
    'Set-Cookie',
    setEditorSessionCookie(await createEditorSession(), request.url),
  );
  headers.append('Set-Cookie', clearMfaChallenge(request.url));
  return new Response(null, { status: 303, headers });
}
