import { env } from 'cloudflare:workers';
import { reviewSessionCookie } from '@/lib/purchase-review';

export async function POST(request: Request) {
  if (env.WORKER_ROLE === 'public')
    return new Response('Não encontrado.', { status: 404 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return new Response('Origem não autorizada.', { status: 403 });
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/compras?saiu=1',
      'Set-Cookie': reviewSessionCookie('', request.url, 0),
      'Cache-Control': 'private, no-store',
    },
  });
}
