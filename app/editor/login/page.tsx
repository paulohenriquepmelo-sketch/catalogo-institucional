import { getChatGPTUser } from '@/app/chatgpt-auth';
import { env } from 'cloudflare:workers';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type LoginPageProps = {
  searchParams?:
    | { error?: string | string[]; return_to?: string | string[] }
    | Promise<{ error?: string | string[]; return_to?: string | string[] }>;
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
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/editor';

  return (
    <main className="editor-login-page">
      <section className="editor-login-card" aria-labelledby="editor-login-title">
        <p className="editor-login-kicker">NEXO · EDITOR</p>
        <h1 id="editor-login-title">Acesso administrativo</h1>
        <p>Informe a senha configurada para administrar o catálogo.</p>
        {error === '1' && (
          <p className="editor-login-error" role="alert">
            Senha inválida ou acesso ainda não configurado.
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
        <a href="https://sites-project.paulohenriquemelo.workers.dev/">
          Voltar ao catálogo
        </a>
      </section>
    </main>
  );
}
