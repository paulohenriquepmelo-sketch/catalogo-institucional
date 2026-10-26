import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export async function getEditorUser() {
  const user = await getChatGPTUser();
  const allowed = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (user?.source === 'session') return user;
  return user && allowed.includes(user.email.toLowerCase()) ? user : null;
}
export async function authorizeMutation(request: Request) {
  // The public Worker shares the R2 bucket but never accepts edits.
  if (env.WORKER_ROLE === 'public')
    return Response.json({ error: 'Página não encontrada.' }, { status: 404 });
  // Sem sessão (expirou ou saiu): `code` deixa o editor oferecer entrar de
  // novo sem perder o que está na tela.
  if (!(await getEditorUser()))
    return Response.json(
      {
        error:
          'Sua sessão expirou. Entre de novo para salvar; o que você alterou continua nesta tela.',
        code: 'session',
      },
      { status: 403 },
    );
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'Origem não autorizada.' }, { status: 403 });
  return null;
}
export async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new Error('Envie dados JSON.');
  const body = await boundedBody(request, 250000);
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new Error('JSON inválido.');
  }
}
export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length') ?? 0) > limit)
    throw new Error('Arquivo ou dados muito grandes.');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error('Arquivo ou dados muito grandes.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// Mensagem de erro que pode ir para a tela. Erros escritos pelo sistema
// (Error simples, em português) passam; erros técnicos (banco, rede, tipo)
// viram a mensagem genérica e ficam só no log do Worker.
const TECHNICAL =
  /D1_|SQLITE|sqlite|no such (table|column)|constraint failed|undefined|null|is not a function|fetch failed|network|stack|\bat\s+\S+\s+\(/i;
export function publicError(error: unknown, fallback: string) {
  if (
    error instanceof Error &&
    error.name === 'Error' &&
    error.message &&
    !TECHNICAL.test(error.message)
  )
    return error.message;
  console.error(error);
  return fallback;
}
