import { getEditorUser, publicError } from '@/lib/editor-access';
import { searchLogos } from '@/lib/logo-search';
export async function GET(request: Request) {
  if (!(await getEditorUser()))
    return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
  try {
    const results = await searchLogos(
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
          publicError(error, 'Não foi possível buscar as logos.'),
      },
      { status: 400 },
    );
  }
}
