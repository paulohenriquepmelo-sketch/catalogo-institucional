import { env } from 'cloudflare:workers';
import { authorizeMutation, boundedBody } from '@/lib/editor-access';
function detect(bytes: Uint8Array) {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return ['png', 'image/png'];
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return ['jpg', 'image/jpeg'];
  const head = new TextDecoder().decode(bytes.slice(0, 16));
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP')
    return ['webp', 'image/webp'];
  if (head.startsWith('GIF87a') || head.startsWith('GIF89a'))
    return ['gif', 'image/gif'];
  return null;
}
export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    const bytes = await boundedBody(request, 6 * 1024 * 1024);
    const form = await new Response(bytes, {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    }).formData();
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      file.size > 5 * 1024 * 1024 ||
      file.size < 12
    )
      throw new Error('Envie uma imagem de até 5 MB.');
    const data = await file.arrayBuffer();
    const format = detect(new Uint8Array(data));
    if (!format)
      throw new Error('Formato inválido. Use PNG, JPEG, WebP ou GIF.');
    const key = `images/${crypto.randomUUID()}.${format[0]}`;
    await env.FILES.put(key, data, {
      httpMetadata: { contentType: format[1] },
    });
    return Response.json({
      url: `/api/uploads?key=${encodeURIComponent(key)}`,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Falha no envio. Tente novamente.',
      },
      { status: 400 },
    );
  }
}
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key');
  if (!key || !/^images\/[a-f0-9-]+\.(png|jpg|webp|gif)$/.test(key))
    return new Response('Imagem não encontrada.', { status: 404 });
  const object = await env.FILES.get(key);
  if (!object) return new Response('Imagem não encontrada.', { status: 404 });
  return new Response(object.body, {
    headers: {
      'content-type':
        object.httpMetadata?.contentType ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
