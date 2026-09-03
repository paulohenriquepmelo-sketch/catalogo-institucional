import { getConfig, saveConfig } from '@/lib/catalog-repository';
import { authorizeMutation, readJson } from '@/lib/editor-access';
export async function GET() {
  try {
    return Response.json(await getConfig(), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch {
    return Response.json(
      { error: 'Configuração temporariamente indisponível.' },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    const body = await readJson(request);
    if (!Number.isInteger(body.revision)) throw new Error('Revisão inválida.');
    return Response.json(await saveConfig(body.config, body.revision));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Não foi possível salvar.',
      },
      { status: 400 },
    );
  }
}
