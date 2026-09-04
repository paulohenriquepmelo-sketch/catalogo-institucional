import { env } from 'cloudflare:workers';
import {
  createEditorSession,
  setEditorSessionCookie,
} from '@/app/chatgpt-auth';

export async function POST(request: Request) {
  const host = new URL(request.url).hostname.toLowerCase();
  const editorHost = (
    env.EDITOR_HOSTNAME ??
    'catalogo-institucional-editor.paulohenriquemelo.workers.dev'
  ).toLowerCase();
  const localHost = host === 'localhost' || host === '127.0.0.1';
  if (!localHost && host !== editorHost)
    return new Response('Não encontrado.', { status: 404 });
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const returnTo = String(form.get('return_to') ?? '/editor');
  const safeReturnTo =
    returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/editor';
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return new Response('Origem não autorizada.', { status: 403 });
  if (!env.EDITOR_PASSWORD || password !== env.EDITOR_PASSWORD)
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
