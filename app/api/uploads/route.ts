import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';

export async function POST(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: 'Acesso restrito ao editor.' }, { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.type.startsWith('image/')) return Response.json({ error: 'Envie uma imagem válida.' }, { status: 400 });
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const key = `catalog/${crypto.randomUUID()}-${safeName}`;
  await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return Response.json({ key, url: `/api/uploads?key=${encodeURIComponent(key)}` });
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key');
  if (!key) return new Response('Imagem não encontrada.', { status: 404 });
  const object = await env.FILES.get(key);
  if (!object) return new Response('Imagem não encontrada.', { status: 404 });
  return new Response(object.body, { headers: { 'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' } });
}
