import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import readExcelFile from 'read-excel-file/node';
import {
  autoMap,
  previewProducts,
  previewImages,
  matchImageFilename,
  mappingError,
  type ImportValues,
  type ImportResult,
} from '../lib/product-import';
import { validateXlsxArchive } from '../lib/xlsx-safety';
import { defaultConfig } from '../lib/catalog-config';
import {
  getConfig,
  listCatalogProducts,
  saveCatalogProduct,
} from '../lib/catalog-repository';
import { POST as importProducts } from '../app/api/import/products/route';
import { POST as importImages } from '../app/api/import/images/route';
import { GET as getUpload } from '../app/api/uploads/route';
import { database, setIdentity } from './runtime';
import { webp } from './image-fixtures';

const headers = [
  'Código',
  'Descrição',
  'Nome do fornecedor',
  'Descrição do departamento',
  'Descrição da seção',
  'Marca',
  'Nome da categoria',
  'Embalagem',
  'Unidade de venda',
  'Descrição da unidade',
  'Embalagem Master',
  'Unidade master de compra',
  'Descrição da unidade',
  'NCM',
  'Unidade Venda EAN',
  'Unidade Master EAN',
];
const cells = [
  '00123',
  'Café teste',
  'Fornecedor interno',
  'Alimentos',
  'Mercearia',
  'Marca importada',
  'Cafés',
  '12',
  'UN',
  'Unidade',
  '6',
  'CX',
  'Caixa',
  '09012100.',
  '0789123456789',
  '17891234567890',
];
const values: ImportValues = {
  code: 'IMPORT-001',
  name: 'Café importado',
  department: 'Importação teste',
  section: 'Alimentos',
  category: 'Cafés',
  brand: 'Marca importada',
  supplier: 'Fornecedor privado',
  ean: '0789123456789',
};
type BatchResponse = { results: ImportResult[] };
const request = (body: unknown, origin = 'https://catalog.test') =>
  new Request('https://catalog.test/api/import/products', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const batch = (rows: unknown[], options: Record<string, unknown> = {}) => ({
  rows,
  mode: 'upsert',
  publishNew: false,
  sourceFile: 'teste.xlsx',
  ...options,
});
const png = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVq8AAAAASUVORK5CYII=',
    'base64',
  ),
);
const imageRequest = (
  name: string,
  code: string,
  expected: string,
  replace = false,
  bytes: Uint8Array = webp,
  origin = 'https://catalog.test',
) => {
  const form = new FormData();
  form.append('file', new File([bytes as BlobPart], name));
  form.append('code', code);
  form.append('expectedUpdatedAt', expected);
  form.append('replaceExisting', String(replace));
  return new Request('https://catalog.test/api/import/images', {
    method: 'POST',
    headers: { origin },
    body: form,
  });
};

void test('original spreadsheet columns, duplicate headers and textual codes are mapped accurately', () => {
  const mapping = autoMap(headers);
  assert.equal(mapping.code, 0);
  assert.equal(mapping.masterUnitDescription, 12);
  assert.equal(mapping.salesUnitDescription, 9);
  assert.equal(mappingError(mapping), '');
  assert.match(mappingError({ ...mapping, name: 0 }), /dois campos/);
  const [row] = previewProducts(
    [headers, cells],
    0,
    mapping,
    [],
    defaultConfig,
    { mode: 'upsert', publishNew: false },
  );
  assert.equal(row.action, 'new');
  assert.equal(row.values.code, '00123');
  assert.equal(row.values.ean, '0789123456789');
  assert.equal(row.values.ncm, '09012100');
  assert.equal(row.values.masterUnitDescription, 'Caixa');
  const duplicates = previewProducts(
    [headers, cells, cells],
    0,
    mapping,
    [],
    defaultConfig,
    { mode: 'upsert', publishNew: false },
  );
  assert.ok(
    duplicates.every((r) => r.action === 'error' && /repetido/.test(r.note)),
  );
  const invalid = [...cells];
  invalid[0] = '';
  assert.equal(
    previewProducts([headers, invalid], 0, mapping, [], defaultConfig, {
      mode: 'upsert',
      publishNew: false,
    })[0].action,
    'error',
  );
  const unsafe = [...cells] as unknown[];
  unsafe[0] = 9007199254740992;
  assert.match(
    previewProducts([headers, unsafe], 0, mapping, [], defaultConfig, {
      mode: 'upsert',
      publishNew: false,
    })[0].note,
    /precisão/,
  );
  unsafe[0] = new Date();
  assert.equal(
    previewProducts([headers, unsafe], 0, mapping, [], defaultConfig, {
      mode: 'upsert',
      publishNew: false,
    })[0].action,
    'error',
  );
  assert.throws(() => validateXlsxArchive(new ArrayBuffer(40)), /inválido/);
});

void test('filename matching is exact, zero-preserving, delimiter-aware and conservative', () => {
  const codes = ['12', '123', '00123', 'AB', 'AB-12'].map((code) => ({ code }));
  assert.equal(matchImageFilename('123.jpg', codes)?.code, '123');
  assert.equal(matchImageFilename('00123_frente.PNG', codes)?.code, '00123');
  assert.equal(matchImageFilename('AB-12_frente.jpg', codes)?.code, 'AB-12');
  assert.equal(matchImageFilename('AB-12.jpg', codes)?.code, 'AB-12');
  assert.equal(matchImageFilename('123-foto.webp', codes)?.code, '123');
  assert.equal(matchImageFilename('123 foto.webp', codes)?.code, '123');
  assert.equal(matchImageFilename('foto_123.jpg', codes), undefined);
  assert.equal(matchImageFilename('1234.jpg', codes), undefined);
  assert.equal(matchImageFilename('ab-12.jpg', codes), undefined);
});

void test('bulk API enforces administrator, same origin, payload limits and no invalid writes', async () => {
  const body = batch([{ row: 2, values }]);
  setIdentity();
  assert.equal((await importProducts(request(body))).status, 403);
  assert.equal(
    (await importImages(imageRequest('IMPORT-001.jpg', 'IMPORT-001', '')))
      .status,
    403,
  );
  setIdentity('admin@example.test');
  assert.equal(
    (await importProducts(request(body, 'https://attacker.test'))).status,
    403,
  );
  assert.equal(
    (
      await importImages(
        imageRequest(
          'IMPORT-001.jpg',
          'IMPORT-001',
          '',
          false,
          png,
          'https://attacker.test',
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (await importProducts(request(batch(Array(11).fill({ row: 2, values })))))
      .status,
    400,
  );
  assert.equal(
    (await importProducts(request({ ...body, publishNew: 'yes' }))).status,
    400,
  );
  assert.equal(
    (await importProducts(request({ long: 'x'.repeat(250001) }))).status,
    400,
  );
  const response = await importProducts(
    request(batch([{ row: 2, values: { ...values, brand: '' } }])),
  );
  assert.equal(
    ((await response.json()) as BatchResponse).results[0].status,
    'error',
  );
  assert.equal(
    database
      .prepare('SELECT count(*) n FROM products WHERE code=?')
      .get(values.code!)?.n,
    0,
  );
});

void test('bulk creates, adds relationships, preserves editor fields and refuses stale updates', async () => {
  setIdentity('admin@example.test');
  let response = await importProducts(request(batch([{ row: 2, values }])));
  assert.equal(response.status, 200);
  assert.equal(
    ((await response.json()) as BatchResponse).results[0].status,
    'created',
  );
  let product = (await listCatalogProducts(true, [values.code!]))[0];
  assert.equal(product.published, false);
  assert.equal(product.details?.ean, '0789123456789');
  assert.equal(product.details?.supplier, values.supplier);
  assert.notEqual(product.segment, '');
  const config = (await getConfig()).config;
  assert.ok(config.brands.some((b) => b.name === values.brand));
  assert.equal(
    config.brands.find((b) => b.name === values.brand)?.published,
    false,
  );
  assert.equal(
    config.brands.find((b) => b.name === values.brand)?.featured,
    false,
  );
  assert.ok(config.taxonomy.some((t) => t.department === values.department));
  product = await saveCatalogProduct({
    ...product,
    image: 'https://example.test/product.png',
    description: 'Texto editorial',
    specs: ['Uma característica'],
    featured: true,
    published: true,
  });
  response = await importProducts(
    request(
      batch([
        {
          row: 2,
          values: { ...values, name: 'Atualizado', supplier: '' },
          expectedUpdatedAt: product.updatedAt,
        },
      ]),
    ),
  );
  assert.equal(
    ((await response.json()) as BatchResponse).results[0].status,
    'updated',
  );
  const updated = (await listCatalogProducts(true, [values.code!]))[0];
  assert.equal(updated.name, 'Atualizado');
  assert.equal(updated.image, product.image);
  assert.equal(updated.description, product.description);
  assert.deepEqual(updated.specs, product.specs);
  assert.equal(updated.featured, true);
  assert.equal(updated.published, true);
  assert.equal(updated.details?.supplier, values.supplier);
  const publicItem = (await listCatalogProducts(false, [values.code!]))[0];
  assert.equal(publicItem.details?.supplier, undefined);
  assert.equal(publicItem.details?.sourceFile, undefined);
  response = await importProducts(
    request(
      batch([
        {
          row: 2,
          values: { ...values, name: 'Stale overwrite' },
          expectedUpdatedAt: product.updatedAt,
        },
      ]),
    ),
  );
  assert.equal(
    ((await response.json()) as BatchResponse).results[0].status,
    'error',
  );
  response = await importProducts(request(batch([{ row: 2, values }])));
  assert.equal(
    ((await response.json()) as BatchResponse).results[0].status,
    'error',
  );
  response = await importProducts(
    request(batch([{ row: 2, values }], { mode: 'new' })),
  );
  assert.equal(
    ((await response.json()) as BatchResponse).results[0].status,
    'skipped',
  );
  assert.equal(
    (await listCatalogProducts(true, [values.code!]))[0].name,
    'Atualizado',
  );
  assert.equal(
    database
      .prepare('SELECT count(*) n FROM products WHERE code=?')
      .get(values.code!)?.n,
    1,
  );
  response = await importProducts(
    request(
      batch([
        { row: 3, values: { ...values, code: 'IMPORT-DUP' } },
        { row: 4, values: { ...values, code: 'IMPORT-DUP' } },
      ]),
    ),
  );
  assert.ok(
    ((await response.json()) as BatchResponse).results.every(
      (r) => r.status === 'error',
    ),
  );
  response = await importProducts(
    request(
      batch(
        [
          { row: 5, values: { ...values, code: 'IMPORT-PUBLIC' } },
          { row: 6, values: { ...values, code: 'IMPORT-BAD', name: '' } },
        ],
        { publishNew: true },
      ),
    ),
  );
  assert.deepEqual(
    ((await response.json()) as BatchResponse).results.map((r) => r.status),
    ['created', 'error'],
  );
  assert.equal((await listCatalogProducts(false, ['IMPORT-PUBLIC'])).length, 1);
});

void test('image previews reject duplicate links and uploads only replace with consent', async () => {
  setIdentity('admin@example.test');
  let product = (await listCatalogProducts(true, [values.code!]))[0];
  const files = [
    new File([png], `${product.code}.png`),
    new File([png], `${product.code}_frente.png`),
  ];
  assert.ok(
    previewImages(files, [product], true).every(
      (row) => row.action === 'error',
    ),
  );
  assert.equal(previewImages([files[0]], [product], false)[0].action, 'skip');
  assert.equal(previewImages([files[0]], [product], true)[0].action, 'replace');
  assert.equal(
    previewImages([new File([png], '9999999.png')], [product], false)[0].action,
    'error',
  );
  assert.equal(
    (
      await importImages(
        imageRequest(`${product.code}.png`, product.code, product.updatedAt!),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await importImages(
        imageRequest('unknown.png', product.code, product.updatedAt!, true),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await importImages(
        imageRequest(`${product.code}.png`, product.code, 'stale', true),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await importImages(
        imageRequest(
          `${product.code}.png`,
          product.code,
          product.updatedAt!,
          true,
          new Uint8Array(20),
        ),
      )
    ).status,
    400,
  );
  const response = await importImages(
    imageRequest(
      `${product.code}_frente.png`,
      product.code,
      product.updatedAt!,
      true,
    ),
  );
  assert.equal(response.status, 200);
  const result = (await response.json()) as { url: string };
  const previous = product;
  product = (await listCatalogProducts(true, [values.code!]))[0];
  assert.equal(product.image, result.url);
  assert.notEqual(product.updatedAt, previous.updatedAt);
  assert.equal(product.name, previous.name);
  assert.equal(product.description, previous.description);
  assert.deepEqual(product.details, previous.details);
  const storedImage = await getUpload(
    new Request(`https://catalog.test${result.url}`),
  );
  assert.equal(storedImage.status, 200);
  assert.equal(storedImage.headers.get('content-type'), 'image/webp');
  assert.match(result.url, /\.webp$/);
  assert.deepEqual(new Uint8Array(await storedImage.arrayBuffer()), webp);
  assert.equal(
    (
      await importImages(
        imageRequest(
          `${product.code}.png`,
          product.code,
          previous.updatedAt!,
          true,
        ),
      )
    ).status,
    400,
  );
  const without = (await listCatalogProducts(true, ['IMPORT-PUBLIC']))[0];
  assert.equal(
    (
      await importImages(
        imageRequest(`${without.code}.png`, without.code, without.updatedAt!),
      )
    ).status,
    200,
  );
});

void test(
  'actual user workbook is readable without changing the workbook or live catalog',
  { skip: !process.env.TEST_PRODUCTS_XLSX },
  async () => {
    const file = readFileSync(process.env.TEST_PRODUCTS_XLSX!);
    validateXlsxArchive(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    );
    const sheets = await readExcelFile(file);
    assert.ok(sheets.length > 0);
    const rows = previewProducts(
      sheets[0].data,
      0,
      autoMap(sheets[0].data[0]),
      [],
      defaultConfig,
      { mode: 'upsert', publishNew: false },
    );
    assert.equal(rows.length, 2525);
    assert.equal(rows.filter((r) => r.action === 'new').length, 2525);
    assert.ok(rows.some((r) => r.values.code === '32'));
  },
);
