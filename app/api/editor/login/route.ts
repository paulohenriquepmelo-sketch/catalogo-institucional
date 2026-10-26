import { env } from 'cloudflare:workers';
import {
  createEditorSession,
  setEditorSessionCookie,
} from '@/app/chatgpt-auth';
import { verifyEditorPassword } from '@/lib/editor-credentials';

export async function POST(request: Request) {
  if (env.WORKER_ROLE === 'public')
    return new Response('Não encontrado.', { status: 404 });
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const returnTo = String(form.get('return_to') ?? '/editor');
  // Browsers treat a backslash like "/", which could lead off this origin.
  const safeReturnTo =
    returnTo.startsWith('/') &&
    !returnTo.startsWith('//') &&
    !/[\\\r\n]/.test(returnTo)
      ? returnTo
      : '/editor';
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return new Response('Origem não autorizada.', { status: 403 });
  // Limit password attempts per client IP before checking the password.
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (env.LOGIN_LIMITER && !(await env.LOGIN_LIMITER.limit({ key: ip })).success)
    return Response.redirect(
      new URL(
        `/editor/login?error=limit&return_to=${encodeURIComponent(safeReturnTo)}`,
        request.url,
      ),
      303,
    );
  if (!(await verifyEditorPassword(password)))
    return Response.redirect(
      new URL(`/editor/login?error=1&return_to=${encodeURIComponent(safeReturnTo)}`, request.url),
      303,
    );
  const session = await createEditorSession();
  return new Response(null, {
    status: 303,
    headers: {
      Location: safeReturnTo,
      'Set-Cookie': setEditorSessionCookie(session, request.url),
      'Cache-Control': 'private, no-store',
    },
  });
}
