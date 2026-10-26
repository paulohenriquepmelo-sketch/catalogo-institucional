import { authorizeMutation, publicError } from '@/lib/editor-access';
import {
  getConfig,
  listCatalogProducts,
  saveCatalogProduct,
} from '@/lib/catalog-repository';
import { getErpFixes } from '@/lib/erp-fixes-repository';
import { applyErpFixes } from '@/lib/erp-fixes';

// Produtos por chamada: o editor repete até `remaining` chegar a zero.
const BATCH = 100;

/**
 * Aplica as correções salvas aos produtos já cadastrados. Só muda nome e
 * hierarquia; foto, descrição e publicação ficam como estão. O site público
 * só muda depois de publicar.
 */
export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    const input = (await request.json().catch(() => null)) as {
      revision?: unknown;
      skip?: unknown;
    } | null;
    // Códigos que já falharam nesta rodada: sem isso, voltariam primeiro na
    // lista a cada chamada e travariam o resto.
    const skip = new Set(
      Array.isArray(input?.skip)
        ? input.skip.filter((c): c is string => typeof c === 'string').slice(0, 3000)
        : [],
    );
    const { fixes, revision } = await getErpFixes();
    if (input?.revision !== revision)
      throw new Error('As correções mudaram. Recarregue e confira a prévia de novo.');
    const context = await getConfig();
    const changed = (await listCatalogProducts(true))
      .map((product) => ({ product, fixed: applyErpFixes(product, fixes) }))
      .filter(
        ({ product, fixed }) =>
          !skip.has(product.code) &&
          (fixed.name !== product.name ||
          fixed.department !== product.department ||
          fixed.section !== product.section ||
          fixed.category !== product.category),
      );
    let updated = 0;
    const failed: { code: string; message: string }[] = [];
    for (const { fixed } of changed.slice(0, BATCH)) {
      try {
        await saveCatalogProduct(fixed, context);
        updated++;
      } catch (error) {
        failed.push({
          code: fixed.code,
          message: publicError(error, 'Falha ao salvar.'),
        });
      }
    }
    return Response.json({
      updated,
      failed,
      remaining: Math.max(0, changed.length - updated - failed.length),
    });
  } catch (error) {
    return Response.json(
      { error: publicError(error, 'Falha ao aplicar.') },
      { status: 400 },
    );
  }
}
