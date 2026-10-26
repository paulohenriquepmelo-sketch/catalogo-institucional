import { env } from 'cloudflare:workers';
import { clearEditorSessionCookie } from '@/app/chatgpt-auth';

// Sair do editor: apaga o cookie de sessão e volta para o login.
export async function POST(request: Request) {
  if (env.WORKER_ROLE === 'public')
    return new Response('Não encontrado.', { status: 404 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return new Response('Origem não autorizada.', { status: 403 });
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/editor/login?saiu=1',
      'Set-Cookie': clearEditorSessionCookie(request.url),
      'Cache-Control': 'private, no-store',
    },
  });
}
