/* oxlint-disable next/no-img-element, next/no-html-link-for-pages -- Logo fixo e links que precisam recarregar a página (cookies de login). */
import { getChatGPTUser, hasValidMfaChallenge } from '@/app/chatgpt-auth';
import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type LoginPageProps = {
  searchParams?:
    | {
        error?: string | string[];
        return_to?: string | string[];
        saiu?: string | string[];
        etapa?: string | string[];
      }
    | Promise<{
        error?: string | string[];
        return_to?: string | string[];
        saiu?: string | string[];
        etapa?: string | string[];
      }>;
};

export default async function EditorLoginPage({
  searchParams,
}: LoginPageProps) {
  if (env.WORKER_ROLE === 'public') notFound();
  if (await getChatGPTUser()) redirect('/editor');
  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const returnTo = Array.isArray(params.return_to)
    ? params.return_to[0]
    : params.return_to;
  const safeReturnTo =
    returnTo &&
    returnTo.startsWith('/') &&
    !returnTo.startsWith('//') &&
    !/[\\\r\n]/.test(returnTo)
      ? returnTo
      : '/editor';
  // Segunda etapa: só aparece com a senha conferida há menos de 5 minutos.
  const codeStep =
    params.etapa === 'codigo' &&
    (await hasValidMfaChallenge((await headers()).get('cookie')));

  if (codeStep)
    return (
      <main className="editor-login-page">
        <section
          className="editor-login-card"
          aria-labelledby="editor-login-title"
        >
          <span className="editor-login-logo-frame">
            <img
              src="/distribuidora-laurencini-logo.jpeg"
              alt="Distribuidora Laurencini"
            />
          </span>
          <p className="editor-login-kicker">CENTRAL DO CATÁLOGO</p>
          <h1 id="editor-login-title">Código do autenticador</h1>
          <p>
            Abra o app autenticador no celular e digite o código de 6 dígitos
            do Catálogo Laurencini. Sem o celular, use um código de
            recuperação.
          </p>
          {error === 'codigo' && (
            <p className="editor-login-error" role="alert">
              Código incorreto ou já usado. Espere o próximo código no app e
              tente de novo.
            </p>
          )}
          {error === 'limit' && (
            <p className="editor-login-error" role="alert">
              Muitas tentativas seguidas. Aguarde um minuto e tente novamente.
            </p>
          )}
          <form action="/api/editor/login/codigo" method="post">
            <input type="hidden" name="return_to" value={safeReturnTo} />
            <label htmlFor="editor-codigo">Código</label>
            <input
              id="editor-codigo"
              name="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={20}
              required
            />
            <button type="submit">Confirmar</button>
          </form>
          <a href="/editor/login">Voltar para a senha</a>
        </section>
      </main>
    );

  return (
    <main className="editor-login-page">
      <section className="editor-login-card" aria-labelledby="editor-login-title">
        <span className="editor-login-logo-frame">
          <img
            src="/distribuidora-laurencini-logo.jpeg"
            alt="Distribuidora Laurencini"
          />
        </span>
        <p className="editor-login-kicker">CENTRAL DO CATÁLOGO</p>
        <h1 id="editor-login-title">Acesso administrativo</h1>
        <p>Informe a senha configurada para administrar o catálogo.</p>
        {params.saiu && !error && (
          <output className="editor-login-notice">Você saiu do editor.</output>
        )}
        {error === 'expirou' && (
          <p className="editor-login-error" role="alert">
            O tempo para digitar o código acabou. Entre com a senha de novo.
          </p>
        )}
        {error === '1' && (
          <p className="editor-login-error" role="alert">
            Senha inválida ou acesso ainda não configurado.
          </p>
        )}
        {error === 'limit' && (
          <p className="editor-login-error" role="alert">
            Muitas tentativas seguidas. Aguarde um minuto e tente novamente.
          </p>
        )}
        <form action="/api/editor/login" method="post">
          <input type="hidden" name="return_to" value={safeReturnTo} />
          <label htmlFor="editor-password">Senha</label>
          <input
            id="editor-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
          />
          <button type="submit">Entrar no editor</button>
        </form>
        <a href="/">Voltar ao catálogo</a>
      </section>
    </main>
  );
}

