import { env } from 'cloudflare:workers';
import { authorizeMutation, readJson, publicError } from '@/lib/editor-access';
import {
  getConfig,
  ensurePublishedCatalog,
  listCatalogProducts,
  saveCatalogProduct,
  validateProduct,
} from '@/lib/catalog-repository';
import { normalize, validateConfig } from '@/lib/catalog-config';
import {
  mergeImport,
  outOfCatalog,
  PURCHASE_EXCLUDED_NOTE,
  ignoredCategory,
  IGNORED_CATEGORY_NOTE,
  OUT_OF_CATALOG_NOTE,
  validateImportValues,
  type ImportResult,
  type ImportOptions,
  type ProductImportInput,
} from '@/lib/product-import';
import type { Product } from '@/lib/catalog-data';
import { applyErpFixes } from '@/lib/erp-fixes';
import { getErpFixes } from '@/lib/erp-fixes-repository';

export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    await ensurePublishedCatalog();
    const input = await readJson(request);
    if (
      !input ||
      !Array.isArray(input.rows) ||
      !input.rows.length ||
      input.rows.length > 10 ||
      !['new', 'upsert'].includes(input.mode) ||
      typeof input.publishNew !== 'boolean' ||
      typeof input.sourceFile !== 'string' ||
      input.sourceFile.length > 120
    )
      throw new Error('Lote inválido. Envie até 10 linhas por vez.');
    const options: ImportOptions = {
      mode: input.mode,
      publishNew: input.publishNew,
    };
    const results: ImportResult[] = [];
    const context = await getConfig();
    // Abreviações e hierarquia corrigidas no editor valem a cada importação.
    const { fixes } = await getErpFixes();
    const codes = input.rows
      .map((r: ProductImportInput) =>
        typeof r?.values?.code === 'string' ? r.values.code.trim() : '',
      )
      .filter(Boolean);
    const existing = new Map(
      (await listCatalogProducts(true, codes)).map((p) => [p.code, p]),
    );
    const config = structuredClone(context.config);
    const pending: {
      row: number;
      product: Product;
      out: boolean;
      purchase: boolean;
    }[] = [];
    const rows = input.rows as ProductImportInput[];
    const counts = new Map<string, number>();
    for (const row of rows)
      if (typeof row?.values?.code === 'string') {
        const code = row.values.code.trim();
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
    for (const row of rows) {
      const code =
        typeof row?.values?.code === 'string'
          ? row.values.code.trim().slice(0, 180)
          : '';
      const rowNumber = Number.isInteger(row?.row) ? row.row : 0;
      try {
        if (
          !row ||
          !Number.isInteger(row.row) ||
          row.row < 2 ||
          row.row > 20001
        )
          throw new Error('Número de linha inválido.');
        const values = validateImportValues(row.values);
        Object.assign(
          values,
          applyErpFixes(
            {
              code: values.code!,
              name: values.name!,
              department: values.department!,
              section: values.section!,
              category: values.category!,
            },
            fixes,
          ),
        );
        if ((counts.get(values.code!) ?? 0) > 1)
          throw new Error('Código repetido no lote.');
        if (ignoredCategory(values.category)) {
          results.push({
            row: row.row,
            code,
            status: 'skipped',
            message: IGNORED_CATEGORY_NOTE,
          });
          continue;
        }
        const current = existing.get(values.code!);
        // Reenvio automático de um lote que falhou no meio: a linha que o
        // servidor já gravou desta planilha não vira erro de "mudou".
        if (
          input.retry === true &&
          current &&
          current.updatedAt !== row.expectedUpdatedAt &&
          current.details?.sourceFile === input.sourceFile &&
          current.details?.sourceRow === row.row
        ) {
          results.push({
            row: row.row,
            code,
            status: 'updated',
            message: 'Já salvo na tentativa anterior.',
          });
          continue;
        }
        if (current && options.mode === 'new') {
          results.push({
            row: row.row,
            code,
            status: 'skipped',
            message: 'Código já cadastrado; mantido.',
          });
          continue;
        }
        if (
          current
            ? current.updatedAt !== row.expectedUpdatedAt
            : Boolean(row.expectedUpdatedAt)
        )
          throw new Error(
            'Produto mudou desde a conferência. Analise o arquivo novamente.',
          );
        const product = mergeImport(values, current, config, options);
        // Only append relationships; never remove or overwrite page settings.
        // Revalidar a configuração inteira só quando a linha traz marca ou
        // categoria nova: fazer isso em toda linha pesava no limite de
        // processamento do Worker e derrubava lotes no meio da importação.
        const newBrand = !config.brands.some(
          (b) => normalize(b.name) === normalize(product.brand),
        );
        const newPath = !config.taxonomy.some(
          (t) =>
            t.department === product.department &&
            t.section === product.section &&
            t.category === product.category,
        );
        let validConfig = config;
        if (newBrand || newPath) {
          const candidate = {
            ...config,
            brands: [...config.brands],
            taxonomy: [...config.taxonomy],
          };
          if (newBrand)
            candidate.brands.push({
              name: product.brand,
              logo: '',
              published: false,
              featured: false,
            });
          if (newPath)
            candidate.taxonomy.push({
              department: product.department,
              section: product.section,
              category: product.category,
            });
          validConfig = validateConfig(candidate);
        }
        product.details = {
          ...product.details,
          sourceFile: input.sourceFile,
          sourceRow: row.row,
        };
        const validProduct = validateProduct(product, validConfig);
        config.brands = validConfig.brands;
        config.taxonomy = validConfig.taxonomy;
        pending.push({
          row: row.row,
          product: validProduct,
          out: !!outOfCatalog(values),
          purchase: !outOfCatalog(values) && !!validProduct.details?.purchaseExcluded,
        });
      } catch (error) {
        results.push({
          row: rowNumber,
          code,
          status: 'error',
          message: publicError(error, 'Linha inválida.'),
        });
      }
    }
    let revision = context.revision;
    if (
      pending.length &&
      JSON.stringify(config) !== JSON.stringify(context.config)
    ) {
      const saved = await env.DB.prepare(
        'UPDATE catalog_config SET body=?,revision=revision+1 WHERE id=1 AND revision=?',
      )
        .bind(JSON.stringify(config), revision)
        .run();
      if (!saved.meta.changes)
        throw new Error(
          'A configuração mudou. Analise a planilha novamente antes de importar.',
        );
      revision++;
    }
    // Small independent batches allow progress reporting and safe stopping.
    for (const { row, product, out, purchase } of pending) {
      try {
        await saveCatalogProduct(product, { config, revision });
        results.push({
          row,
          code: product.code,
          status: product.id ? 'updated' : 'created',
          message: purchase
            ? PURCHASE_EXCLUDED_NOTE
            : out
            ? OUT_OF_CATALOG_NOTE
            : product.id
            ? 'Atualizado; imagem e publicação preservadas.'
            : product.published
              ? 'Criado e publicado.'
              : 'Criado como rascunho.',
        });
      } catch (error) {
        results.push({
          row,
          code: product.code,
          status: 'error',
          message:
            publicError(error, 'Falha ao salvar a linha.'),
        });
      }
    }
    return Response.json({ results: results.sort((a, b) => a.row - b.row) });
  } catch (error) {
    return Response.json(
      {
        error: publicError(error, 'Falha na importação.'),
      },
      { status: 400 },
    );
  }
}
