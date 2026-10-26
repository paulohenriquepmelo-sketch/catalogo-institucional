import { env } from 'cloudflare:workers';
import { reviewLinkFromCookie, reviewProducts } from '@/lib/purchase-review';

// Produtos do filtro da chave do comprador, na ordem do catálogo impresso.
export async function GET(request: Request) {
  if (env.WORKER_ROLE === 'public')
    return Response.json({ error: 'Página não encontrada.' }, { status: 404 });
  const link = await reviewLinkFromCookie(request.headers.get('cookie'));
  if (!link)
    return Response.json(
      { error: 'Sua chave venceu ou foi cancelada. Peça uma nova.', code: 'session' },
      { status: 403 },
    );
  return Response.json(
    {
      label: link.label,
      expiresAt: link.expiresAt,
      filter: link.filter,
      products: await reviewProducts(link.filter),
    },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
