import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { defaultConfig, validateConfig } from '../lib/catalog-config';
import { classifySegment } from '../lib/segment-classifier';
import { productIssues, type Product } from '../lib/catalog-data';

// One-time migration generator. Never changes the source workbook.
const input = process.argv[2];
if (!input) throw new Error('Informe o JSON extraído da planilha.');
const payload = await fs.readFile(input, 'utf8');
const source = JSON.parse(payload) as {
  rows: { row: number; values: (string | number | null)[] }[];
};
const config = validateConfig(defaultConfig);
const str = (value: unknown) => (value == null ? '' : String(value).trim());
const imported: Product[] = source.rows.map(({ row, values: v }) => {
  const p: Product = {
    id: 0,
    code: str(v[0]),
    name: str(v[1]),
    description: '',
    department: str(v[3]),
    section: str(v[4]),
    category: str(v[6]),
    brand: str(v[5]),
    segment: '',
    image: '',
    specs: [],
    featured: false,
    published: true,
    details: {
      supplier: str(v[2]),
      packaging: str(v[7]),
      salesUnit: str(v[8]),
      salesUnitDescription: str(v[9]),
      masterPackaging: str(v[10]),
      masterUnit: str(v[11]),
      masterUnitDescription: str(v[12]),
      ncm: str(v[13]).replace(/\.$/, ''),
      ean: str(v[14]),
      masterEan: str(v[15]),
      sourceFile: 'produtos.xlsx',
      sourceRow: row,
    },
  };
  p.segment = classifySegment(p, config.segments).segment;
  return p;
});
if (
  imported.length !== 2525 ||
  new Set(imported.map((p) => p.code)).size !== imported.length
)
  throw new Error('Contagem ou códigos inconsistentes.');
const quote = (v: unknown) => `'${String(v).replaceAll("'", "''")}'`;
const parts = [
  `-- Fonte: produtos.xlsx, aba produtos, A2:P2526. Sem preços ou fotos.\n-- SHA256 dos dados extraídos: ${createHash('sha256').update(payload).digest('hex')}\n-- Códigos, marcas e hierarquia preservados; NCM sem ponto terminal; EAN não é corrigido automaticamente.`,
];
parts.push(
  `INSERT INTO catalog_config (id,body,revision) VALUES (1,${quote(JSON.stringify(config))},1) ON CONFLICT(id) DO NOTHING;`,
);
for (let start = 0; start < imported.length; start += 40) {
  const chunk = imported.slice(start, start + 40);
  parts.push(
    `INSERT INTO products (code,name,description,department,section,category,segment,brand,image,specs,details,featured,published,created_at,updated_at) VALUES\n${chunk.map((p) => `(${[p.code, p.name, p.description, p.department, p.section, p.category, p.segment, p.brand, p.image, JSON.stringify(p.specs), JSON.stringify(p.details)].map(quote).join(',')},0,1,'2026-09-03T00:00:00.000Z','2026-09-03T00:00:00.000Z')`).join(',\n')}\nON CONFLICT(code) DO NOTHING;`,
  );
}
const filename = 'drizzle/0003_import_produtos.sql';
const existing = await fs.readFile(filename, 'utf8');
if (
  !existing.startsWith('-- Custom SQL migration') &&
  !existing.startsWith('-- Fonte: produtos.xlsx')
)
  throw new Error('Destino não é a migração esperada.');
await fs.writeFile(filename, parts.join('\n--> statement-breakpoint\n') + '\n');
const issues = imported.flatMap((p) =>
  productIssues(p).map((issue) => ({
    code: p.code,
    row: p.details?.sourceRow,
    issue,
  })),
);
const report = {
  source: 'produtos.xlsx',
  sheet: 'produtos',
  range: 'A2:P2526',
  products: imported.length,
  brands: config.brands.length,
  paths: config.taxonomy.length,
  segments: imported.reduce<Record<string, number>>((counts, p) => {
    counts[p.segment] = (counts[p.segment] ?? 0) + 1;
    return counts;
  }, {}),
  issues,
  withoutImages: imported.length,
};
await fs.writeFile('work/import-report.json', JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    ...report,
    issues: undefined,
    issueCount: issues.length,
    productsWithIssues: new Set(issues.map((i) => i.code)).size,
  }),
);
