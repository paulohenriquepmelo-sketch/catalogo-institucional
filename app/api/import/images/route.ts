import { env } from 'cloudflare:workers';
import { authorizeMutation, boundedBody } from '@/lib/editor-access';
import { matchImageFilename } from '@/lib/product-import';
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
    const code = form.get('code');
    const expected = form.get('expectedUpdatedAt');
    const replace = form.get('replaceExisting');
    if (
      !(file instanceof File) ||
      typeof code !== 'string' ||
      code.length > 180 ||
      typeof expected !== 'string' ||
      (replace !== 'true' && replace !== 'false')
    )
      throw new Error('Dados de vínculo inválidos.');
    if (!/\.(png|jpe?g|webp|gif)$/i.test(file.name))
      throw new Error('Use PNG, JPEG, WebP ou GIF.');
    const rows = await env.DB.prepare(
      'SELECT code,image,updated_at FROM products',
    ).all<{ code: string; image: string; updated_at: string }>();
    const product = matchImageFilename(file.name, rows.results);
    if (!product || product.code !== code)
      throw new Error('O nome da imagem não corresponde ao código do produto.');
    if (product.image && replace !== 'true')
      throw new Error(
        'O produto já possui imagem. Autorize a substituição na conferência.',
      );
    if (product.updated_at !== expected)
      throw new Error(
        'Produto alterado desde a conferência. Analise as imagens novamente.',
      );
    const image = await storeImage(file);
    const previous = Date.parse(expected);
    const updatedAt = new Date(
      Math.max(Date.now(), Number.isFinite(previous) ? previous + 1 : 0),
    ).toISOString();
    // Update only the image; never restore an outdated full product snapshot.
    const result = await env.DB.prepare(
      'UPDATE products SET image=?,updated_at=? WHERE code=? AND updated_at=?',
    )
      .bind(image.url, updatedAt, code, expected)
      .run();
    if (!result.meta.changes) {
      await env.FILES.delete(image.key);
      throw new Error(
        'Produto alterado durante o envio. A imagem anterior foi mantida.',
      );
    }
    return Response.json({ code, url: image.url, updatedAt });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Falha ao vincular imagem.',
      },
      { status: 400 },
    );
  }
}
