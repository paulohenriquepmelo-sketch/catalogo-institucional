import { getEditorUser } from '@/lib/editor-access';
import { searchProductImages } from '@/lib/logo-search';

export async function GET(request: Request) {
  if (!(await getEditorUser()))
    return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
  try {
    const results = await searchProductImages(
      new URL(request.url).searchParams.get('q') ?? '',
      request.signal,
    );
    return Response.json(
      { results, provider: 'Wikimedia Commons' },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível buscar fotos de produtos.',
      },
      { status: 400 },
    );
  }
}
