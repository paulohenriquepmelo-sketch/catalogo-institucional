import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { EditorApp } from '@/components/editor-app';
import { getEditorUser } from '@/lib/editor-access';
import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EditorPage() {
  const host = (await headers()).get('host')?.split(':')[0].toLowerCase();
  const editorHost = (
    env.EDITOR_HOSTNAME ??
    'catalogo-institucional-editor.paulohenriquemelo.workers.dev'
  ).toLowerCase();
  const localHost = host === 'localhost' || host === '127.0.0.1';
  if (!localHost && host !== editorHost) notFound();
  const user = await requireChatGPTUser('/editor');
  if (!(await getEditorUser()))
    return (
      <main className="access-message">
        <h1>Acesso restrito</h1>
        <p>Esta conta não está autorizada a administrar o catálogo.</p>
        <a href="/">Voltar ao catálogo</a>
      </main>
    );
  return <EditorApp userName={user.displayName} />;
}
