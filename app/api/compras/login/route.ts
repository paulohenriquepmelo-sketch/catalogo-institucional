import { env } from 'cloudflare:workers';
import {
  createReviewSession,
  resolveReviewKey,
  reviewSessionCookie,
} from '@/lib/purchase-review';

// Entrada do comprador com a chave de 64 caracteres.
export async function POST(request: Request) {
  if (env.WORKER_ROLE === 'public')
    return new Response('Não encontrado.', { status: 404 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return new Response('Origem não autorizada.', { status: 403 });
  const back = (error: string) =>
    Response.redirect(new URL(`/compras?erro=${error}`, request.url), 303);
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (
    env.LOGIN_LIMITER &&
    !(await env.LOGIN_LIMITER.limit({ key: `compras:${ip}` })).success
  )
    return back('limite');
  const form = await request.formData().catch(() => null);
  const raw = form?.get('chave');
  const key = typeof raw === 'string' ? raw.slice(0, 200) : '';
  const link = await resolveReviewKey(key);
  if (!link) return back('chave');
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/compras',
      'Set-Cookie': reviewSessionCookie(
        await createReviewSession(link),
        request.url,
        (Date.parse(link.expiresAt) - Date.now()) / 1000,
      ),
      'Cache-Control': 'private, no-store',
    },
  });
}
