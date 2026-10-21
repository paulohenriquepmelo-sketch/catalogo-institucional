import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyErpFixes,
  defaultErpFixes,
  expandName,
  findErpSuspects,
  validateErpFixes,
  type ErpFixes,
} from '../lib/erp-fixes';
import { buildSegments } from '../lib/segments';
import { products } from './fixtures';
import type { Product } from '../lib/catalog-data';
import { getConfig, listCatalogProducts } from '../lib/catalog-repository';
import { GET as getFixes, POST as saveFixes } from '../app/api/editor/erp-fixes/route';
import { POST as applyFixes } from '../app/api/editor/erp-fixes/apply/route';
import { POST as importProducts } from '../app/api/import/products/route';
import { env, setIdentity } from './runtime';

const rules = defaultErpFixes.abbreviations;
const MASSAS = '1.4-MASSAS';
const SANTA = '1.6-SANTA AMALIA';

void test('erp names: abbreviations expand only where they mean that word', () => {
  assert.equal(expandName('MAC APOLO PARAFUSO 1KG', MASSAS, rules), 'MACARRÃO APOLO PARAFUSO 1KG');
  assert.equal(
    expandName('MAC OVOS STA AMALIA PENA 500G', SANTA, rules),
    'MACARRÃO OVOS SANTA AMALIA PENA 500G',
  );
  // O ponto da abreviação some, e a palavra colada ganha espaço.
  assert.equal(expandName('MAC. INSTANT. CARNE MARATA', MASSAS, rules), 'MACARRÃO INSTANT. CARNE MARATA');
  assert.equal(expandName('MAC.INSTANT GALINHA', MASSAS, rules), 'MACARRÃO INSTANT GALINHA');
  // "MAC." em escova é "macia"; "COND." no meio do nome é "condensado".
  assert.equal(
    expandName('ESCOLVA SORRISO TRIPLA MAC. LEV3PAG2', 'HIGIENE PESSOAL', rules),
    'ESCOLVA SORRISO TRIPLA MAC. LEV3PAG2',
  );
  assert.equal(
    expandName('LEITE COND. SEMIDESNAT. CAMPONESA 395ML', '1.2-MERCEARIA', rules),
    'LEITE COND. SEMIDESNAT. CAMPONESA 395ML',
  );
  // Palavra que só começa igual não é abreviação; espaços repetidos somem.
  assert.equal(expandName('MACARRAO  YARA 1KG', MASSAS, rules), 'MACARRAO YARA 1KG');
  assert.equal(expandName('PIR  CEREJA DO AMOR 480G', '2.3-PIRULITOS', rules), 'PIRULITO CEREJA DO AMOR 480G');
  // Categoria com espaço duplo, como vem do ERP.
  assert.equal(
    expandName('SALG TORCIDA BACON 60G', '2.6-SALGADINHOS /  PIPOCAS / CHIPS', rules),
    'SALGADINHO TORCIDA BACON 60G',
  );
  assert.equal(
    expandName('FAR TRIGO C/FERM D.BENTA (SC PLAST) 1KG', 'DONA BENTA', rules),
    'FARINHA DE TRIGO C/FERM DONA BENTA (SC PLAST) 1KG',
  );
  // Aplicar de novo não muda nada.
  const once = expandName('MAC. INSTANT. CARNE MARATA', MASSAS, rules);
  assert.equal(expandName(once, MASSAS, rules), once);
  // Linha ainda em edição (vazia) não faz nada.
  assert.equal(
    expandName('MAC APOLO', MASSAS, [{ from: '', to: 'X', categories: [], startOnly: false }]),
    'MAC APOLO',
  );
});

const path = { department: '1-ATACADO', section: '1-ALIMENTOS', category: '1.2-MERCEARIA' };
const fixes: ErpFixes = {
  abbreviations: rules,
  products: [
    { code: '8454', name: '', ...path },
    { code: '9999', name: 'NOME CERTO', department: '', section: '', category: '' },
  ],
  ignored: [],
};

void test('erp products: a code fix moves the category and the name follows the new category', () => {
  const sugar = applyErpFixes(
    { code: '8454', name: 'ACUCAR DE CONFEITEIRO MIX 1KG', department: '1-ATACADO', section: '1-ALIMENTOS', category: MASSAS },
    fixes,
  );
  assert.deepEqual(
    { ...sugar },
    { code: '8454', name: 'ACUCAR DE CONFEITEIRO MIX 1KG', ...path },
  );
  const named = applyErpFixes({ code: '9999', name: 'MAC X', ...path, category: MASSAS }, fixes);
  assert.equal(named.name, 'NOME CERTO');
  assert.equal(named.category, MASSAS);
});

void test('erp suspects: a product away from its family is suggested, food service size split is not', () => {
  const make = (code: string, name: string, category: string) => ({
    code,
    name,
    department: '1-ATACADO',
    section: '3-BEBIDAS',
    category,
  });
  const list = [
    make('1', 'AGUA MINERAL A 500ML', '3.4-AGUA MINERAL'),
    make('2', 'AGUA MINERAL B 500ML', '3.4-AGUA MINERAL'),
    make('3', 'AGUA MINERAL C 1,5L', '3.4-AGUA MINERAL'),
    make('4', 'AGUA MINERAL D 500ML', '3.1-SUCOS'),
    make('5', 'MOLHO TOMATE A 340G', '1.2-MERCEARIA'),
    make('6', 'MOLHO TOMATE B 340G', '1.2-MERCEARIA'),
    make('7', 'MOLHO TOMATE C 340G', '1.2-MERCEARIA'),
    make('8', 'MOLHO TOMATE BAG 1,7KG', '1.1-FOOD SERVICE'),
  ];
  const suspects = findErpSuspects(list, { abbreviations: [], products: [], ignored: [] });
  assert.deepEqual(
    suspects.map((s) => [s.code, s.suggested.category]),
    [['4', '3.4-AGUA MINERAL']],
  );
  assert.deepEqual(findErpSuspects(list, { abbreviations: [], products: [], ignored: ['4'] }), []);
});

void test('erp fixes validation: unknown hierarchy, repeated code and half paths are refused', () => {
  const taxonomy = [path];
  assert.doesNotThrow(() => validateErpFixes(defaultErpFixes, taxonomy));
  const base = { abbreviations: [], ignored: [] };
  assert.throws(
    () => validateErpFixes({ ...base, products: [{ code: '1', name: '', ...path, category: 'X' }] }, taxonomy),
    /hierarquia cadastrada/,
  );
  assert.throws(
    () =>
      validateErpFixes(
        { ...base, products: [{ code: '1', name: 'A', department: '', section: '', category: '' }, { code: '1', name: 'B', department: '', section: '', category: '' }] },
        taxonomy,
      ),
    /repetido/,
  );
  assert.throws(
    () => validateErpFixes({ ...base, products: [{ code: '1', name: '', department: 'X', section: '', category: '' }] }, taxonomy),
    /categoria/,
  );
  assert.throws(
    () => validateErpFixes({ ...base, abbreviations: [{ from: 'MAC', to: '', categories: [], startOnly: true }], products: [] }, taxonomy),
    /extenso/,
  );
});

void test('segments keep the same products after names are expanded', () => {
  let id = 9000;
  const make = (name: string, category: string): Product => ({
    ...products[0],
    id: id++,
    code: String(id),
    name,
    category,
    published: true,
  });
  const erp = [
    make('MAC OVOS STA AMALIA PENA 500G', SANTA),
    make('FAR TRIGO TIA OFELIA PAPEL 25KG', '1.1-FOOD SERVICE'),
    make('COND COLORAU GUARANA 500G', '1.5-CONDIMENTOS GUARANA'),
    make('EMB BOLO (G32) MILLENIUM ALTA 1KG', 'POTES REDONDO /  RETANGULAR'),
    make('REF TANG UVA 18G', '1.2-MERCEARIA'),
  ];
  const fixed = erp.map((p) => applyErpFixes(p, defaultErpFixes));
  assert.equal(fixed[1].name, 'FARINHA DE TRIGO TIA OFELIA PAPEL 25KG');
  const where = (list: Product[]) =>
    buildSegments(list).flatMap((s) =>
      s.groups.flatMap((g) => g.products.map((p) => `${s.rule.id}/${g.name}/${p.id}`)),
    );
  assert.deepEqual(where(fixed).sort(), where(erp).sort());
});

const post = (path: string, body: unknown, origin = 'https://catalog.test') =>
  new Request(`https://catalog.test${path}`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

void test('erp fixes API: editor only, applied on import and to existing products', async () => {
  setIdentity();
  assert.equal((await getFixes()).status, 403);
  assert.equal((await saveFixes(post('/api/editor/erp-fixes', {}))).status, 403);
  setIdentity('admin@example.test');
  env.WORKER_ROLE = 'public';
  assert.equal((await getFixes()).status, 404);
  env.WORKER_ROLE = 'editor';

  const first = (await (await getFixes()).json()) as { fixes: ErpFixes; revision: number };
  assert.ok(first.fixes.abbreviations.some((a) => a.from === 'MAC'));
  const { config } = await getConfig();
  const target = config.taxonomy[0];

  // Produto novo vindo do ERP com abreviação.
  const row = {
    row: 2,
    values: {
      code: 'ERP-1',
      name: 'MAC APOLO PARAFUSO 1KG',
      department: target.department,
      section: target.section,
      category: target.category,
      brand: config.brands[0]?.name ?? 'Marca',
    },
  };
  const imported = (await (
    await importProducts(
      post('/api/import/products', { rows: [row], mode: 'upsert', publishNew: false, sourceFile: 'erp.xlsx' }),
    )
  ).json()) as { results: { status: string }[] };
  assert.equal(imported.results[0].status, 'created');
  // Sem regra para esta categoria de teste, o nome fica como veio.
  assert.equal((await listCatalogProducts(true, ['ERP-1']))[0].name, 'MAC APOLO PARAFUSO 1KG');

  // Salva uma regra que vale para a categoria do produto: origem falsa e revisão velha falham.
  const next: ErpFixes = {
    ...first.fixes,
    abbreviations: [
      ...first.fixes.abbreviations,
      { from: 'MAC', to: 'MACARRÃO', categories: [target.category], startOnly: true },
    ],
  };
  assert.equal(
    (await saveFixes(post('/api/editor/erp-fixes', { fixes: next, revision: first.revision }, 'https://attacker.test'))).status,
    403,
  );
  const saved = (await (
    await saveFixes(post('/api/editor/erp-fixes', { fixes: next, revision: first.revision }))
  ).json()) as { revision: number };
  assert.equal(saved.revision, first.revision + 1);
  assert.equal(
    (await saveFixes(post('/api/editor/erp-fixes', { fixes: next, revision: first.revision }))).status,
    400,
  );

  // Aplicar exige a revisão salva e corrige o produto existente.
  assert.equal((await applyFixes(post('/api/editor/erp-fixes/apply', { revision: first.revision }))).status, 400);
  // Lotes de até 100: o editor repete até não sobrar nada.
  let calls = 0;
  let updated = 0;
  for (;;) {
    const applied = (await (
      await applyFixes(post('/api/editor/erp-fixes/apply', { revision: saved.revision }))
    ).json()) as { updated: number; failed: unknown[]; remaining: number };
    calls++;
    updated += applied.updated;
    assert.deepEqual(applied.failed, []);
    assert.ok(applied.updated <= 100);
    if (!applied.remaining) break;
    assert.ok(calls < 20);
  }
  assert.ok(calls > 1 && updated > 100);
  const [product] = await listCatalogProducts(true, ['ERP-1']);
  assert.equal(product.name, 'MACARRÃO APOLO PARAFUSO 1KG');

  // Uma nova importação da mesma linha do ERP não desfaz a correção.
  await importProducts(
    post('/api/import/products', {
      rows: [{ ...row, expectedUpdatedAt: product.updatedAt }],
      mode: 'upsert',
      publishNew: false,
      sourceFile: 'erp.xlsx',
    }),
  );
  assert.equal((await listCatalogProducts(true, ['ERP-1']))[0].name, 'MACARRÃO APOLO PARAFUSO 1KG');
});
