import { env } from 'cloudflare:workers';
import { authorizeMutation, boundedBody } from '@/lib/editor-access';
import { storeImage } from '@/lib/image-storage';
export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    const bytes = await boundedBody(request, 6 * 1024 * 1024);
    const form = await new Response(bytes, {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    }).formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('Selecione uma imagem.');
    const image = await storeImage(file);
    return Response.json({
      url: image.url,
      bytes: image.bytes,
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
  if (
    !key ||
    !(
      /^images\/[a-f0-9-]+\.(png|jpg|webp|gif)$/.test(key) ||
      /^pending\/product-images\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9-]+\.webp$/.test(
        key,
      )
    )
  )
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
