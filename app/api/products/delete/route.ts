import { env } from 'cloudflare:workers';
import { authorizeMutation } from '@/lib/editor-access';

const BATCH = 100;

/**
 * Exclui de vez produtos da área "Fora de linha" do editor. Só apaga produto
 * que a importação marcou (details.outOfCatalog): qualquer outro código
 * enviado é ignorado. O site muda depois de publicar.
 */
export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    const input = (await request.json().catch(() => null)) as {
      codes?: unknown;
      confirm?: unknown;
    } | null;
    if (input?.confirm !== true) throw new Error('Confirmação explícita necessária.');
    if (
      !Array.isArray(input.codes) ||
      !input.codes.length ||
      input.codes.length > BATCH ||
      input.codes.some((c) => typeof c !== 'string' || !c.trim() || c.length > 180)
    )
      throw new Error(`Envie de 1 a ${BATCH} códigos por vez.`);
    const codes = [...new Set(input.codes as string[])];
    const result = await env.DB.prepare(
      `DELETE FROM products WHERE code IN (${codes.map(() => '?').join(',')}) AND json_extract(details, '$.outOfCatalog') IS NOT NULL`,
    )
      .bind(...codes)
      .run();
    return Response.json({ deleted: result.meta.changes, ignored: codes.length - result.meta.changes });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Falha ao excluir.' },
      { status: 400 },
    );
  }
}
