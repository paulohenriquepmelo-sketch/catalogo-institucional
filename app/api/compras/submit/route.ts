import { env } from 'cloudflare:workers';
import { readJson, publicError } from '@/lib/editor-access';
import { reviewLinkFromCookie, submitReview } from '@/lib/purchase-review';

// Envio do comprador: itens marcados como fora de linha, para aprovação.
export async function POST(request: Request) {
  if (env.WORKER_ROLE === 'public')
    return Response.json({ error: 'Página não encontrada.' }, { status: 404 });
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'Origem não autorizada.' }, { status: 403 });
  const link = await reviewLinkFromCookie(request.headers.get('cookie'));
  if (!link)
    return Response.json(
      { error: 'Sua chave venceu ou foi cancelada. Peça uma nova.', code: 'session' },
      { status: 403 },
    );
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (
    env.LOGIN_LIMITER &&
    !(await env.LOGIN_LIMITER.limit({ key: `compras-envio:${ip}` })).success
  )
    return Response.json(
      { error: 'Muitos envios seguidos. Aguarde um minuto e tente de novo.' },
      { status: 429 },
    );
  try {
    return Response.json(await submitReview(link, await readJson(request)));
  } catch (error) {
    return Response.json(
      { error: publicError(error, 'Não foi possível enviar.') },
      { status: 400 },
    );
  }
}
