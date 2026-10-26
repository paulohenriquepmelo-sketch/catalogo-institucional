import {
  createEditorSession,
  setEditorSessionCookie,
} from '@/app/chatgpt-auth';
import { authorizeMutation, readJson } from '@/lib/editor-access';
import { endAllEditorSessions } from '@/lib/editor-credentials';

// "Encerrar as outras sessões": troca a geração das sessões. Todos os
// cookies antigos deixam de valer; esta tela recebe um cookie novo.
export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    const input = await readJson(request);
    if (input?.confirm !== true)
      throw new Error('Confirmação explícita necessária.');
    await endAllEditorSessions();
    return Response.json(
      { ok: true },
      {
        headers: {
          'Set-Cookie': setEditorSessionCookie(
            await createEditorSession(),
            request.url,
          ),
          'cache-control': 'no-store',
        },
      },
    );
  } catch {
    return Response.json(
      { error: 'Não foi possível encerrar as sessões.' },
      { status: 400 },
    );
  }
}
