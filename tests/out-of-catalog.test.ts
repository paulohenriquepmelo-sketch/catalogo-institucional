import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoMap, outOfCatalog } from '../lib/product-import';
import { getConfig, listCatalogProducts, saveCatalogProduct } from '../lib/catalog-repository';
import { POST as importProducts } from '../app/api/import/products/route';
import { POST as deleteProducts } from '../app/api/products/delete/route';
import { setIdentity } from './runtime';

// Cabeçalho real da exportação do ERP (códigos antes dos nomes, "Marca" duas vezes).
const ERP_HEADER = ["Código", "Descrição", "Fornecedor", "Nome do fornecedor", "Departamento", "Descrição do departamento", "Seção", "Descrição da seção", "Marca", "Marca", "Categoria", "Nome da categoria", "Embalagem", "Unidade de venda", "Descrição da unidade", "Embalagem Master", "Unidade master de compra", "Descrição da unidade", "NCM + Exceção", "NCM", "GTIN Unid.Venda", "GTIN Unid.Master", "GTIN Unid. Tributável", "Unidade Venda  EAN", "Unidade Master EAN", "Cód. Fábrica", "Fora de linha", "Revenda", "Enviar para Força de Vendas"];

void test('ERP export: names win over codes, double-spaced headers match, rule columns are found', () => {
  const map = autoMap(ERP_HEADER);
  const title = (key: keyof typeof map) => ERP_HEADER[map[key]!];
  assert.equal(title('department'), 'Descrição do departamento');
  assert.equal(title('section'), 'Descrição da seção');
  assert.equal(title('category'), 'Nome da categoria');
  assert.equal(title('supplier'), 'Nome do fornecedor');
  assert.equal(map.brand, 9); // a segunda "Marca" (nome), não a primeira (código)
  assert.equal(title('ean'), 'Unidade Venda  EAN');
  assert.equal(title('outOfLine'), 'Fora de linha');
  assert.equal(title('resale'), 'Revenda');
  assert.equal(title('salesForce'), 'Enviar para Força de Vendas');
});

void test('rule: any of FL / Revenda N / Força de Vendas N takes the product off the site', () => {
  assert.equal(outOfCatalog({ outOfLine: '', resale: 'S', salesForce: 'S' }), '');
  assert.equal(outOfCatalog({ outOfLine: '  ', resale: 's', salesForce: 'S' }), '');
  assert.equal(outOfCatalog({ outOfLine: 'FL', resale: 'S', salesForce: 'S' }), 'Fora de linha');
  assert.equal(outOfCatalog({ outOfLine: '', resale: 'n', salesForce: 'S' }), 'Revenda: N');
  assert.equal(
    outOfCatalog({ outOfLine: 'fl', resale: 'N', salesForce: 'N' }),
    'Fora de linha · Revenda: N · Força de Vendas: N',
  );
});

const post = (path: string, body: unknown, origin = 'https://catalog.test') =>
  new Request(`https://catalog.test${path}`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

void test('import keeps marked products as drafts in the Fora de linha area; delete only removes those', async () => {
  setIdentity('admin@example.test');
  const { config } = await getConfig();
  const path = config.taxonomy[0];
  const base = { department: path.department, section: path.section, category: path.category, brand: config.brands[0].name };
  const row = (n: number, code: string, flags: Record<string, string>) => ({
    row: n,
    values: { code, name: `PRODUTO ${code}`, ...base, ...flags },
  });
  const run = async (rows: unknown[]) =>
    ((await (
      await importProducts(post('/api/import/products', { rows, mode: 'upsert', publishNew: true, sourceFile: 'erp.xlsx' }))
    ).json()) as { results: { status: string; message: string }[] }).results;

  const first = await run([
    row(2, 'FL-1', { outOfLine: 'FL', resale: 'S', salesForce: 'S' }),
    row(3, 'OK-1', { outOfLine: '', resale: 'S', salesForce: 'S' }),
  ]);
  assert.deepEqual(first.map((r) => r.status), ['created', 'created']);
  assert.match(first[0].message, /rascunho/);
  const [fl, ok] = await listCatalogProducts(true, ['FL-1', 'OK-1']).then((list) =>
    ['FL-1', 'OK-1'].map((c) => list.find((p) => p.code === c)!),
  );
  assert.equal(fl.published, false);
  assert.equal(fl.details?.outOfCatalog, 'Fora de linha');
  assert.equal(ok.published, true);
  assert.equal(ok.details?.outOfCatalog, undefined);

  // Produto publicado que passa a ter Revenda = N sai do site.
  const again = await run([{ ...row(2, 'OK-1', { outOfLine: '', resale: 'N', salesForce: 'S' }), expectedUpdatedAt: ok.updatedAt }]);
  assert.equal(again[0].status, 'updated');
  const okNow = (await listCatalogProducts(true, ['OK-1']))[0];
  assert.equal(okNow.published, false);
  assert.equal(okNow.details?.outOfCatalog, 'Revenda: N');
  // Salvar no editor não apaga a marcação.
  const saved = await saveCatalogProduct({ ...okNow, description: 'editado' });
  assert.equal(saved.details?.outOfCatalog, 'Revenda: N');
  // Planilha sem a marcação: sai da área (a publicação fica com você).
  await run([{ ...row(2, 'OK-1', { outOfLine: '', resale: 'S', salesForce: 'S' }), expectedUpdatedAt: saved.updatedAt }]);
  const cleared = (await listCatalogProducts(true, ['OK-1']))[0];
  assert.equal(cleared.details?.outOfCatalog, undefined);
  assert.equal(cleared.published, false);

  // Exclusão: só editor, mesma origem, confirmação, e só produto marcado.
  setIdentity();
  assert.equal((await deleteProducts(post('/api/products/delete', { codes: ['FL-1'], confirm: true }))).status, 403);
  setIdentity('admin@example.test');
  assert.equal((await deleteProducts(post('/api/products/delete', { codes: ['FL-1'], confirm: true }, 'https://attacker.test'))).status, 403);
  assert.equal((await deleteProducts(post('/api/products/delete', { codes: ['FL-1'] }))).status, 400);
  assert.equal((await deleteProducts(post('/api/products/delete', { codes: [], confirm: true }))).status, 400);
  const result = (await (
    await deleteProducts(post('/api/products/delete', { codes: ['FL-1', 'OK-1'], confirm: true }))
  ).json()) as { deleted: number; ignored: number };
  assert.deepEqual(result, { deleted: 1, ignored: 1 });
  const left = await listCatalogProducts(true, ['FL-1', 'OK-1']);
  assert.deepEqual(left.map((p) => p.code), ['OK-1']);
});
