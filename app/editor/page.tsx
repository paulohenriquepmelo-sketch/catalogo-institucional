import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { EditorApp } from '@/components/editor-app';

export const dynamic = 'force-dynamic';

export default async function EditorPage() {
  const user = await requireChatGPTUser('/editor');
  return <EditorApp userName={user.displayName} />;
}
