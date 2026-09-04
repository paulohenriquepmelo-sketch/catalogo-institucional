import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { EditorApp } from '@/components/editor-app';
import { getEditorUser } from '@/lib/editor-access';

export const dynamic = 'force-dynamic';

export default async function EditorPage() {
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
