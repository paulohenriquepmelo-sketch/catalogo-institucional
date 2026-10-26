import { env } from 'cloudflare:workers';
import {
  authorizeMutation,
  getEditorUser,
  readJson,
  publicError,
} from '@/lib/editor-access';
import {
  createReviewLink,
  decideReview,
  listReviewLinks,
  listReviewRequests,
  restorePurchaseExcluded,
  revokeReviewLink,
  reviewFilterOptions,
} from '@/lib/purchase-review';

// Editor: chaves do compras, envios recebidos e decisões.
export async function GET() {
  if (env.WORKER_ROLE === 'public')
    return Response.json({ error: 'Página não encontrada.' }, { status: 404 });
  if (!(await getEditorUser()))
    return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
  // Em sequência: cada lista garante as tabelas na primeira vez.
  const links = await listReviewLinks();
  const requests = await listReviewRequests();
  const options = await reviewFilterOptions();
  return Response.json(
    { links, requests, options },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    const input = await readJson(request);
    switch (input?.action) {
      case 'create':
        return Response.json(await createReviewLink(input), {
          headers: { 'cache-control': 'no-store' },
        });
      case 'revoke':
        await revokeReviewLink(input.id);
        return Response.json({ ok: true });
      case 'decide':
        return Response.json(await decideReview(input.id, input.approve));
      case 'restore':
        await restorePurchaseExcluded(input.code);
        return Response.json({ ok: true });
      default:
        throw new Error('Ação inválida.');
    }
  } catch (error) {
    return Response.json(
      {
        error:
          publicError(error, 'Não foi possível concluir.'),
      },
      { status: 400 },
    );
  }
}
