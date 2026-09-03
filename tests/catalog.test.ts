import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultConfig,
  validateConfig,
  imageUrl,
  safeLink,
} from '../lib/catalog-config';
import { classifySegment } from '../lib/segment-classifier';
import {
  discover,
  emptyFilters,
  similarProducts,
} from '../lib/catalog-discovery';
import { products } from './fixtures';
import {
  getConfig,
  listCatalogProducts,
  saveCatalogProduct,
  saveConfig,
} from '../lib/catalog-repository';
import {
  GET as getProducts,
  POST as postProduct,
} from '../app/api/products/route';
import { POST as postConfig } from '../app/api/config/route';
import { GET as getUpload, POST as postUpload } from '../app/api/uploads/route';
import { database, setIdentity } from './runtime';
import { webp } from './image-fixtures';

const clone = () => structuredClone(defaultConfig);
const request = (
  path: string,
  body: unknown,
  origin = 'https://catalog.test',
) =>
  new Request(`https://catalog.test${path}`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('classification, accent-insensitive search and conservative similarities', () => {
  assert.equal(
    classifySegment({
      ...products[0],
      name: '',
      description: '',
      department: '',
      section: '',
      category: '',
      specs: [],
    }).review,
    true,
  );
  const rules = [
    { name: 'A', note: '', keywords: ['café'] },
    { name: 'B', note: '', keywords: ['hotel'] },
  ];
  assert.equal(
    classifySegment(
      {
        name: 'CAFÉ',
        description: '',
        department: '',
        section: '',
        category: '',
        specs: [],
      },
      rules,
    ).segment,
    'A',
  );
  assert.equal(
    classifySegment(
      {
        name: 'café hotel',
        description: '',
        department: '',
        section: '',
        category: '',
        specs: [],
      },
      rules,
    ).segment,
    'Sem classificação',
  );
  assert.equal(
    discover(products, { ...emptyFilters, query: 'nomade' }).length,
    1,
  );
  assert.equal(discover(products, { ...emptyFilters, brand: 'Lin' }).length, 0);
  assert.equal(
    discover(products, {
      ...emptyFilters,
      department: 'Iluminação',
      section: 'Decorativa',
      category: 'Mesa',
    }).length,
    1,
  );
  assert.equal(
    similarProducts(
      [
        {
          ...products[0],
          id: 22,
          segment: 'Sem classificação',
          department: 'X',
          section: 'Y',
          category: 'Z',
        },
      ],
      { ...products[0], segment: 'Sem classificação' },
    ).length,
    0,
  );
});
test('configuration and media validation reject unsafe or inconsistent input', () => {
  assert.deepEqual(validateConfig(clone()), defaultConfig);
  assert.throws(() => imageUrl('javascript:alert(1)'));
  assert.throws(() => imageUrl('data:image/svg+xml,<svg/>'));
  assert.throws(() => safeLink('//external.test'));
  assert.throws(() => safeLink('/\\external.test'));
  assert.equal(safeLink('#catalogo'), '#catalogo');
  const config = clone();
  config.brands.push({ ...config.brands[0] });
  assert.throws(() => validateConfig(config), /duplicados/);
  const noCatalog = clone();
  noCatalog.blocks[0].visible = false;
  assert.throws(() => validateConfig(noCatalog), /catálogo visível/);
  const multiline = clone();
  multiline.segments[0].keywords.push('');
  assert.ok(!validateConfig(multiline).segments[0].keywords.includes(''));
  const invalidShowcase = clone();
  invalidShowcase.offers.interval = 2;
  assert.throws(() => validateConfig(invalidShowcase), /animação/);
});
test('persistent workflow: migrations, seeded records, drafts, revisions, ACL, uploads', async () => {
  const settings = await getConfig();
  assert.equal(settings.revision, 1);
  assert.ok(settings.config.blocks.some((block) => block.type === 'offers'));
  assert.ok(
    settings.config.blocks.some((block) => block.type === 'new-products'),
  );
  assert.equal((await listCatalogProducts()).length, 2525);
  const seed = (await listCatalogProducts(true)).find((p) => p.code === '32')!;
  assert.equal(seed.name, 'BALA FLOPI DIET 40G FLORESTAL');
  assert.equal(seed.details?.packaging, '12X40G');
  assert.equal(seed.details?.ean, '7896321005601');
  assert.equal(seed.details?.sourceRow, 2);
  assert.equal(
    (await listCatalogProducts()).find((p) => p.code === '32')?.details
      ?.supplier,
    undefined,
  );
  const saved = await saveCatalogProduct({
    ...seed,
    id: 0,
    code: 'TEST-DRAFT',
    published: false,
    details: {
      ...seed.details,
      offer: {
        enabled: true,
        discount: 40,
        startsAt: '2026-09-01',
        endsAt: '2026-09-30',
      },
      showAsNew: false,
    },
  });
  assert.ok(saved.id);
  assert.ok(saved.createdAt);
  assert.equal(saved.details?.offer?.discount, 40);
  assert.equal(saved.details?.showAsNew, false);
  assert.equal((await listCatalogProducts()).length, 2525);
  assert.equal((await listCatalogProducts(true)).length, 2526);
  await assert.rejects(
    () => saveCatalogProduct({ ...seed, id: 0, code: 'TEST-DRAFT' }),
    /código/,
  );
  const published = await saveCatalogProduct({
    ...saved,
    published: true,
    name: 'Produto de teste',
  });
  assert.equal((await listCatalogProducts()).length, 2526);
  await assert.rejects(
    () => saveCatalogProduct({ ...saved, name: 'Stale update' }),
    /outra sessão/,
  );
  const invalidBrand = { ...published, brand: 'Não existe' };
  await assert.rejects(() => saveCatalogProduct(invalidBrand), /marca/);
  const invalidPath = { ...published, category: 'Não existe' };
  await assert.rejects(() => saveCatalogProduct(invalidPath), /hierarquia/);
  const removeUsed = clone();
  removeUsed.brands = [];
  await assert.rejects(() => saveConfig(removeUsed, 1), /em uso/);
  const edited = clone();
  edited.name = 'Catálogo de teste';
  edited.banners[0].title = 'Banner editado';
  edited.primary = '#244433';
  const updated = await saveConfig(edited, 1);
  assert.equal(updated.revision, 2);
  assert.equal((await getConfig()).config.banners[0].title, 'Banner editado');
  await assert.rejects(() => saveConfig(edited, 1), /outra sessão/);
  setIdentity();
  assert.equal(
    (
      await getProducts(
        new Request('https://catalog.test/api/products?editor=1'),
      )
    ).status,
    403,
  );
  assert.equal(
    (await postProduct(request('/api/products', published))).status,
    403,
  );
  assert.equal(
    (await postConfig(request('/api/config', { config: edited, revision: 2 })))
      .status,
    403,
  );
  setIdentity('viewer@example.test');
  assert.equal(
    (await postProduct(request('/api/products', published))).status,
    403,
  );
  setIdentity('admin@example.test');
  assert.equal(
    (
      await postProduct(
        request('/api/products', published, 'https://attacker.test'),
      )
    ).status,
    403,
  );
  const write = await postProduct(
    request('/api/products', { ...published, published: false }),
  );
  assert.equal(write.status, 200);
  const read = await getProducts(
    new Request('https://catalog.test/api/products'),
  );
  const data = (await read.json()) as typeof products;
  assert.ok(!data.some((p) => p.code === 'TEST-DRAFT'));
  const makeUpload = (data: Uint8Array, type: string) => {
    const form = new FormData();
    form.append('file', new File([new Uint8Array(data)], 'test.png', { type }));
    return new Request('https://catalog.test/api/uploads', {
      method: 'POST',
      headers: { origin: 'https://catalog.test' },
      body: form,
    });
  };
  const png = Uint8Array.from(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEfcAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  const upload = await postUpload(makeUpload(webp, 'image/webp'));
  assert.equal(upload.status, 200);
  const { url } = (await upload.json()) as { url: string };
  assert.equal(imageUrl(url), url);
  const stored = await getUpload(new Request(`https://catalog.test${url}`));
  assert.equal(stored.status, 200);
  assert.equal(stored.headers.get('content-type'), 'image/webp');
  assert.match(url, /\.webp$/);
  assert.deepEqual(new Uint8Array(await stored.arrayBuffer()), webp);
  assert.equal((await postUpload(makeUpload(png, 'image/webp'))).status, 400);
  assert.equal(
    (
      await postUpload(
        makeUpload(
          new TextEncoder().encode('<svg onload="alert(1)"></svg>'),
          'image/png',
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await postUpload(
        makeUpload(new Uint8Array(5 * 1024 * 1024 + 1), 'image/png'),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await getUpload(
        new Request('https://catalog.test/api/uploads?key=../secrets'),
      )
    ).status,
    404,
  );
  setIdentity();
  assert.equal((await postUpload(makeUpload(png, 'image/png'))).status, 403);
  // This isolated in-memory test proves clearing products never resurrects demo items.
  database.exec('DELETE FROM products');
  assert.equal((await listCatalogProducts(true)).length, 0);
  assert.equal((await getConfig()).config.name, 'Catálogo de teste');
});
