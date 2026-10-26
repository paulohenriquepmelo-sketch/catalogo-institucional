/* oxlint-disable next/no-img-element -- Logo fixo, igual à tela de login do editor. */
import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { PurchaseReviewApp } from '@/components/purchase-review-app';
import { reviewLinkFromCookie } from '@/lib/purchase-review';

export const dynamic = 'force-dynamic';

type Params = { erro?: string | string[]; saiu?: string | string[] };

// Página do compras: entra com a chave de 64 caracteres e revisa o catálogo.
export default async function PurchaseReviewPage({
  searchParams,
}: {
  searchParams?: Params | Promise<Params>;
}) {
  if (env.WORKER_ROLE === 'public') notFound();
  const link = await reviewLinkFromCookie((await headers()).get('cookie'));
  if (link)
    return (
      <PurchaseReviewApp
        linkId={link.id}
        label={link.label}
        expiresAt={link.expiresAt}
      />
    );
  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.erro) ? params.erro[0] : params.erro;
  return (
    <main className="editor-login-page">
      <section className="editor-login-card" aria-labelledby="compras-title">
        <span className="editor-login-logo-frame">
          <img
            src="/distribuidora-laurencini-logo.jpeg"
            alt="Distribuidora Laurencini"
          />
        </span>
        <p className="editor-login-kicker">REVISÃO DO CATÁLOGO</p>
        <h1 id="compras-title">Acesso do compras</h1>
        <p>
          Cole a chave de acesso de 64 caracteres que você recebeu. Ela vale
          por tempo limitado e só mostra os produtos da sua revisão.
        </p>
        {params.saiu && !error && (
          <output className="editor-login-notice">Você saiu da revisão.</output>
        )}
        {error === 'chave' && (
          <p className="editor-login-error" role="alert">
            Chave inválida, vencida ou cancelada. Confira se copiou os 64
            caracteres ou peça uma nova.
          </p>
        )}
        {error === 'limite' && (
          <p className="editor-login-error" role="alert">
            Muitas tentativas seguidas. Aguarde um minuto e tente novamente.
          </p>
        )}
        <form action="/api/compras/login" method="post">
          <label htmlFor="compras-chave">Chave de acesso</label>
          <textarea
            id="compras-chave"
            name="chave"
            className="compras-key-input"
            rows={3}
            maxLength={200}
            autoComplete="off"
            spellCheck={false}
            required
          />
          <button type="submit">Entrar na revisão</button>
        </form>
      </section>
    </main>
  );
}
