import {
  detailFields,
  productIssues,
  type Product,
  type ProductDetails,
} from './catalog-data';
import { normalize, type CatalogConfig } from './catalog-config';
import { classifySegment } from './segment-classifier';
import { applyErpFixes, type ErpFixes } from './erp-fixes';

export const importColumns = [
  {
    key: 'code',
    label: 'Código',
    required: true,
    aliases: ['codigo', 'codigo do produto', 'cod', 'sku'],
  },
  {
    key: 'name',
    label: 'Nome / descrição do produto',
    required: true,
    aliases: [
      'descricao',
      'nome',
      'produto',
      'descricao do produto',
      'nome do produto',
    ],
  },
  {
    key: 'department',
    label: 'Departamento',
    required: true,
    aliases: ['descricao do departamento', 'departamento'],
  },
  {
    key: 'section',
    label: 'Seção',
    required: true,
    aliases: ['descricao da secao', 'secao'],
  },
  {
    key: 'category',
    label: 'Categoria',
    required: true,
    aliases: ['nome da categoria', 'descricao da categoria', 'categoria'],
  },
  {
    key: 'brand',
    label: 'Marca',
    required: true,
    aliases: ['nome da marca', 'marca'],
    // Exportação do ERP: "Marca" (código) e depois "Marca" (nome).
    preferLast: true,
  },
  {
    key: 'supplier',
    label: 'Fornecedor (interno)',
    aliases: ['nome do fornecedor', 'fornecedor'],
  },
  {
    key: 'packaging',
    label: 'Embalagem de venda',
    aliases: ['embalagem', 'embalagem de venda'],
  },
  {
    key: 'salesUnit',
    label: 'Unidade de venda',
    aliases: ['unidade de venda', 'unidade venda'],
  },
  {
    key: 'salesUnitDescription',
    label: 'Descrição da unidade de venda',
    aliases: ['descricao da unidade', 'descricao da unidade de venda'],
  },
  {
    key: 'masterPackaging',
    label: 'Embalagem master',
    aliases: ['embalagem master'],
  },
  {
    key: 'masterUnit',
    label: 'Unidade master de compra',
    aliases: ['unidade master de compra', 'unidade master'],
  },
  {
    key: 'masterUnitDescription',
    label: 'Descrição da unidade master',
    aliases: ['descricao da unidade', 'descricao da unidade master'],
  },
  { key: 'ncm', label: 'NCM', aliases: ['ncm'] },
  {
    key: 'ean',
    label: 'EAN de venda',
    aliases: ['unidade venda ean', 'ean', 'ean de venda', 'codigo de barras'],
  },
  {
    key: 'masterEan',
    label: 'EAN master',
    aliases: ['unidade master ean', 'ean master'],
  },
  // Regra de saída do site: qualquer uma das três marcações tira o produto
  // do site (veja outOfCatalog).
  { key: 'outOfLine', label: 'Fora de linha', aliases: ['fora de linha'] },
  { key: 'resale', label: 'Revenda', aliases: ['revenda'] },
  {
    key: 'salesForce',
    label: 'Enviar para Força de Vendas',
    aliases: ['enviar para forca de vendas', 'forca de vendas'],
  },
] as const;

/**
 * Fora de linha = FL, Revenda = N ou Enviar para Força de Vendas = N: o
 * produto sai do site, do app e do PDF (entra ou fica como rascunho, com
 * foto e dados guardados no editor, na área "Fora de linha"). Devolve o
 * motivo, ou '' quando o produto segue normal.
 */
export function outOfCatalog(values: ImportValues) {
  const flag = (value?: string) => (value ?? '').trim().toUpperCase();
  return [
    flag(values.outOfLine) === 'FL' && 'Fora de linha',
    flag(values.resale) === 'N' && 'Revenda: N',
    flag(values.salesForce) === 'N' && 'Força de Vendas: N',
  ]
    .filter(Boolean)
    .join(' · ');
}
export const OUT_OF_CATALOG_NOTE =
  'Fora de linha, sem revenda ou fora da Força de Vendas: fica como rascunho (fora do site).';
export type ImportKey = (typeof importColumns)[number]['key'];
export type ColumnMapping = Partial<Record<ImportKey, number>>;
export type ImportValues = Partial<Record<ImportKey, string>>;
export type ProductImportInput = {
  row: number;
  values: ImportValues;
  expectedUpdatedAt?: string;
};
export type ImportOptions = { mode: 'new' | 'upsert'; publishNew: boolean };
export type ImportResult = {
  row: number;
  code: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  message: string;
};
export type ExcelSheet = { sheet: string; data: unknown[][] };
export function columnTitle(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
}
export type ProductPreview = ProductImportInput & {
  name: string;
  action: 'new' | 'update' | 'skip' | 'error';
  note: string;
  segment: string;
};

// Planilhas do ERP repetem a informação como código e como nome
// ("Departamento" 10008 / "Descrição do departamento" 1-ATACADO): os apelidos
// de cada campo vêm em ordem de preferência, e o nome ganha do código.
export function autoMap(headers: unknown[]): ColumnMapping {
  const used = new Set<number>();
  const mapping: ColumnMapping = {};
  const titles = headers.map((header) => normalize(columnTitle(header)).replace(/\s+/g, ' '));
  for (const field of importColumns) {
    for (const alias of field.aliases as readonly string[]) {
      const matches = titles
        .map((title, i) => (title === alias && !used.has(i) ? i : -1))
        .filter((i) => i >= 0);
      if (!matches.length) continue;
      const index = 'preferLast' in field ? matches.at(-1)! : matches[0];
      mapping[field.key] = index;
      used.add(index);
      break;
    }
  }
  return mapping;
}
export function mappingError(mapping: ColumnMapping) {
  const missing = importColumns.filter(
    (field) => 'required' in field && mapping[field.key] === undefined,
  );
  if (missing.length)
    return `Selecione as colunas: ${missing.map((f) => f.label).join(', ')}.`;
  const indexes = Object.values(mapping).filter((i) => i !== undefined);
  if (new Set(indexes).size !== indexes.length)
    return 'Uma coluna não pode preencher dois campos. Revise o mapeamento.';
  return '';
}
function cellText(value: unknown, key: ImportKey): string {
  if (value == null) return '';
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new Error(
      'Há uma data ou valor inválido. Use texto nas células de cadastro.',
    );
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) ||
      (['code', 'ean', 'masterEan', 'ncm'].includes(key) &&
        !Number.isSafeInteger(value)))
  )
    throw new Error(
      'Número com precisão insegura ou decimal. Formate códigos e EAN como texto no Excel.',
    );
  let text = String(value).trim();
  if (key === 'ncm') text = text.replace(/\.$/, '');
  if (['outOfLine', 'resale', 'salesForce'].includes(key) && text.length > 20)
    throw new Error('As colunas Fora de linha, Revenda e Força de Vendas aceitam só a marcação (FL, S ou N).');
  const limit = ['department', 'section', 'category', 'brand'].includes(key)
    ? 80
    : ['code', 'name'].includes(key)
      ? 180
      : 250;
  if (text.length > limit)
    throw new Error(`Uma célula ultrapassa o limite de ${limit} caracteres.`);
  return text;
}
export function validateImportValues(value: unknown): ImportValues {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Linha inválida.');
  const input = value as Record<string, unknown>;
  const result: ImportValues = {};
  for (const field of importColumns) {
    if (input[field.key] !== undefined) {
      if (typeof input[field.key] !== 'string')
        throw new Error('Os campos de importação devem ser texto.');
      result[field.key] = cellText(input[field.key], field.key);
    }
    if ('required' in field && !result[field.key])
      throw new Error(`Preencha ${field.label}.`);
  }
  return result;
}
export function mergeImport(
  values: ImportValues,
  existing: Product | undefined,
  config: CatalogConfig,
  options: ImportOptions,
): Product {
  const details: ProductDetails = { ...existing?.details };
  for (const [key] of detailFields) if (values[key]) details[key] = values[key];
  // A planilha decide de novo a cada importação: desmarcou, sai da área.
  const out = outOfCatalog(values);
  if (out) details.outOfCatalog = out;
  else delete details.outOfCatalog;
  const p: Product = {
    id: existing?.id ?? 0,
    name: values.name!,
    code: values.code!,
    department: values.department!,
    section: values.section!,
    category: values.category!,
    brand: values.brand!,
    description: existing?.description ?? '',
    image: existing?.image ?? '',
    specs: existing?.specs ?? [],
    published: out ? false : (existing?.published ?? options.publishNew),
    featured: existing?.featured ?? false,
    updatedAt: existing?.updatedAt,
    createdAt: existing?.createdAt,
    details,
    segment: '',
  };
  // Keep existing display spelling when the imported label is equivalent.
  p.brand =
    config.brands.find((b) => normalize(b.name) === normalize(p.brand))?.name ??
    p.brand;
  const path = config.taxonomy.find(
    (t) =>
      normalize(t.department) === normalize(p.department) &&
      normalize(t.section) === normalize(p.section) &&
      normalize(t.category) === normalize(p.category),
  );
  if (path) Object.assign(p, path);
  p.segment = classifySegment(p, config.segments).segment;
  return p;
}
const comparedKeys = ['name', 'department', 'section', 'category', 'brand', 'published'] as const;
function sameImportedData(next: Product, current: Product) {
  if (comparedKeys.some((key) => next[key] !== current[key])) return false;
  const keys = [...detailFields.map(([key]) => key), 'outOfCatalog'] as const;
  return keys.every(
    (key) => (next.details?.[key] ?? '') === (current.details?.[key] ?? ''),
  );
}
export function previewProducts(
  rows: unknown[][],
  header: number,
  mapping: ColumnMapping,
  products: Product[],
  config: CatalogConfig,
  options: ImportOptions,
  /** Correções do ERP: aplicadas aqui também, para comparar com o cadastro. */
  fixes?: ErpFixes,
): ProductPreview[] {
  const mappingIssue = mappingError(mapping);
  if (mappingIssue) throw new Error(mappingIssue);
  const existing = new Map(products.map((p) => [p.code, p]));
  const output: ProductPreview[] = [];
  for (let i = header + 1; i < rows.length; i++) {
    const cells = rows[i];
    if (
      !cells?.some(
        (cell) => cell != null && (typeof cell !== 'string' || cell.trim()),
      )
    )
      continue;
    const row: ProductPreview = {
      row: i + 1,
      values: {},
      name: '',
      action: 'error',
      note: '',
      segment: '',
    };
    try {
      for (const field of importColumns) {
        const index = mapping[field.key];
        if (index !== undefined)
          row.values[field.key] = cellText(cells[index], field.key);
      }
      row.values = validateImportValues(row.values);
      if (fixes)
        Object.assign(
          row.values,
          applyErpFixes(
            {
              code: row.values.code!,
              name: row.values.name!,
              department: row.values.department!,
              section: row.values.section!,
              category: row.values.category!,
            },
            fixes,
          ),
        );
      row.name = row.values.name ?? '';
      const current = existing.get(row.values.code!);
      row.expectedUpdatedAt = current?.updatedAt;
      row.action = current
        ? options.mode === 'new'
          ? 'skip'
          : 'update'
        : 'new';
      const merged = mergeImport(row.values, current, config, options);
      row.segment = merged.segment;
      // Igual ao cadastro: não precisa ir de novo (reimportar a mesma
      // planilha, ou continuar uma importação que parou, só envia o resto).
      if (row.action === 'update' && current && sameImportedData(merged, current))
        row.action = 'skip';
      const warnings = productIssues(merged);
      row.note =
        row.action === 'skip'
          ? options.mode === 'new'
            ? 'Código já cadastrado; será mantido.'
            : 'Sem alterações em relação ao cadastro.'
          : outOfCatalog(row.values)
            ? OUT_OF_CATALOG_NOTE
            : warnings.length
            ? `Conferir: ${warnings.join(' · ')}`
            : 'Pronto para importar.';
    } catch (error) {
      row.note = error instanceof Error ? error.message : 'Linha inválida.';
    }
    output.push(row);
  }
  const counts = new Map<string, number>();
  for (const row of output)
    if (row.values.code)
      counts.set(row.values.code, (counts.get(row.values.code) ?? 0) + 1);
  for (const row of output)
    if ((counts.get(row.values.code ?? '') ?? 0) > 1) {
      row.action = 'error';
      row.note =
        'Código repetido nesta planilha. Corrija as linhas duplicadas.';
    }
  if (output.length > 20000)
    throw new Error(
      'Importe até 20.000 produtos por arquivo. Divida a planilha em partes.',
    );
  return output;
}

export function matchImageFilename<T extends { code: string }>(
  filename: string,
  products: T[],
): T | undefined {
  const stem = filename.replace(/\.[^.]+$/, '').trim();
  const exact = products.filter((p) => p.code === stem);
  if (exact.length === 1) return exact[0];
  const matches = products.filter(
    (p) => stem.startsWith(p.code) && /^[_ -]/.test(stem.slice(p.code.length)),
  );
  // Longest code wins: AB-12_frente belongs to AB-12, not AB.
  matches.sort((a, b) => b.code.length - a.code.length);
  if (
    matches.length &&
    (matches.length === 1 || matches[0].code.length > matches[1].code.length)
  )
    return matches[0];
  return undefined;
}
export type ImagePreview = {
  file: File;
  product?: Product;
  action: 'link' | 'replace' | 'skip' | 'error';
  note: string;
};
export function previewImages(
  files: File[],
  products: Product[],
  replace: boolean,
): ImagePreview[] {
  const rows: ImagePreview[] = files.map((file) => {
    const product = matchImageFilename(file.name, products);
    if (
      !/\.(png|jpe?g|webp|gif)$/i.test(file.name) ||
      file.size < 12 ||
      file.size > 5 * 1024 * 1024
    )
      return {
        file,
        product,
        action: 'error',
        note: 'Use PNG, JPEG, WebP ou GIF de até 5 MB.',
      };
    if (!product)
      return {
        file,
        action: 'error',
        note: 'Código não encontrado. Importe o produto primeiro e confira o nome do arquivo.',
      };
    return {
      file,
      product,
      action: product.image ? (replace ? 'replace' : 'skip') : 'link',
      note: product.image
        ? replace
          ? 'A imagem principal será substituída.'
          : 'Produto já tem imagem; será mantida.'
        : 'Pronto para vincular.',
    };
  });
  const counts = new Map<string, number>();
  for (const row of rows)
    if (row.product && row.action !== 'error')
      counts.set(row.product.code, (counts.get(row.product.code) ?? 0) + 1);
  for (const row of rows)
    if (row.product && (counts.get(row.product.code) ?? 0) > 1) {
      row.action = 'error';
      row.note =
        'Mais de uma imagem para este código. Selecione apenas a imagem principal.';
    }
  return rows;
}
