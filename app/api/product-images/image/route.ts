import { getEditorUser } from '@/lib/editor-access';
import { retrieveProductImage } from '@/lib/logo-search';

export async function GET(request: Request) {
  if (!(await getEditorUser()))
    return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
  try {
    const image = await retrieveProductImage(
      new URL(request.url).searchParams.get('id') ?? '',
      request.signal,
    );
    return new Response(image.bytes, {
      headers: {
        'content-type': image.contentType,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível obter essa foto.',
      },
      { status: 400 },
    );
  }
}
