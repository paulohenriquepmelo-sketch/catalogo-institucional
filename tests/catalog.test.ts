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
  getPublishedConfig,
  listCatalogProducts,
  listPublishedProducts,
  publishCatalog,
  saveCatalogProduct,
  saveConfig,
} from '../lib/catalog-repository';
import {
  GET as getProducts,
  POST as postProduct,
} from '../app/api/products/route';
import { POST as postConfig } from '../app/api/config/route';
import { POST as postLogout } from '../app/api/editor/logout/route';
import {
  GET as getPublication,
  POST as postPublication,
} from '../app/api/publication/route';
import { GET as getUpload, POST as postUpload } from '../app/api/uploads/route';
import {
  PUBLISHED_CATALOG_KEY,
  readPublishedCatalogSnapshot,
  writePublishedCatalogSnapshot,
} from '../lib/published-catalog';
import { database, env as testEnv, headers, setIdentity } from './runtime';
import { webp } from './image-fixtures';

import { catalogDateKey, expireProductOffer } from '../lib/catalog-data';

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

void test('expired offers lose both their toggle and percentage without modifying the source product', () => {
  const product = {
    ...products[0],
    details: {
      supplier: 'Fornecedor',
      showAsNew: true,
      offer: {
        enabled: true,
        discount: 35,
        startsAt: '2026-09-01',
        endsAt: '2026-09-25',
      },
    },
  };
  const endOfDay = catalogDateKey(new Date('2026-09-26T02:59:59.999Z'));
  assert.equal(endOfDay, '2026-09-25');
  assert.equal(expireProductOffer(product, endOfDay), product);
  assert.equal(expireProductOffer(product, '2026-08-31'), product);
  const nextDay = catalogDateKey(new Date('2026-09-26T03:00:00.000Z'));
  assert.equal(nextDay, '2026-09-26');
  const expired = expireProductOffer(product, nextDay);
  assert.equal(expired.details?.offer?.enabled === true, false);
  assert.equal(expired.details?.offer?.discount, undefined);
  assert.equal(expired.details?.supplier, 'Fornecedor');
  assert.equal(expired.details?.showAsNew, true);
  assert.equal(expired.updatedAt, product.updatedAt);
  assert.equal(product.details.offer.discount, 35);
  assert.equal(expireProductOffer(expired, nextDay), expired);
  assert.equal(
    expireProductOffer({ ...product, details: undefined }, nextDay).details,
    undefined,
  );
});

void test('classification, accent-insensitive search and conservative similarities', () => {
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
void test('configuration and media validation reject unsafe or inconsistent input', () => {
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
void test('persistent workflow: migrations, seeded records, drafts, revisions, ACL, uploads', async () => {
  const settings = await getConfig();
  assert.equal(settings.revision, 1);
  assert.ok(settings.config.blocks.some((block) => block.type === 'offers'));
  assert.ok(
    settings.config.blocks.some((block) => block.type === 'new-products'),
  );
  assert.equal((await listCatalogProducts()).length, 2525);
  assert.equal((await listPublishedProducts()).length, 2525);
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
        endsAt: '2099-12-31', // oferta ativa; data fixa no passado vencia o teste
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
  const expiredSaved = await saveCatalogProduct({
    ...saved,
    details: {
      ...saved.details,
      offer: {
        enabled: true,
        discount: 35,
        startsAt: '2000-01-01',
        endsAt: '2000-01-02',
      },
    },
  });
  assert.equal(expiredSaved.details?.offer, undefined);
  assert.equal(
    (await listCatalogProducts(true)).find((p) => p.id === saved.id)?.details
      ?.offer,
    undefined,
  );
  const storedExpired = database
    .prepare('SELECT details FROM products WHERE id=?')
    .get(saved.id) as { details: string };
  assert.equal(JSON.parse(storedExpired.details).offer, undefined);
  const published = await saveCatalogProduct({
    ...saved,
    updatedAt: expiredSaved.updatedAt,
    published: true,
    name: 'Produto de teste',
  });
  assert.equal((await listCatalogProducts()).length, 2526);
  assert.equal((await listPublishedProducts()).length, 2525);
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
  const removeUsedCategory = clone();
  removeUsedCategory.taxonomy = removeUsedCategory.taxonomy.filter(
    (t) =>
      !(
        t.department === published.department &&
        t.section === published.section &&
        t.category === published.category
      ),
  );
  await assert.rejects(() => saveConfig(removeUsedCategory, 1), /em uso/);
  // Consumo do D1: salvar a configuração não varre os produtos — as
  // verificações usam índices (antes: ~350 mil linhas lidas por salvamento).
  for (const [sql, args] of [
    ['SELECT brand FROM products WHERE brand IN (?) LIMIT 1', ['x']],
    [
      'SELECT name FROM products WHERE department=? AND section=? AND category=? LIMIT 1',
      ['a', 'b', 'c'],
    ],
    ["SELECT COALESCE(MAX(updated_at),'') FROM products", []],
  ] as const) {
    const plan = database
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all(...args)
      .map((row) => String((row as { detail: string }).detail))
      .join(' | ');
    assert.match(plan, /USING (COVERING )?INDEX/, `${sql} → ${plan}`);
  }
  const edited = clone();
  edited.name = 'Catálogo de teste';
  edited.banners[0].title = 'Banner editado';
  edited.primary = '#244433';
  const updated = await saveConfig(edited, 1);
  assert.equal(updated.revision, 2);
  assert.equal((await getConfig()).config.banners[0].title, 'Banner editado');
  assert.notEqual(
    (await getPublishedConfig()).config.banners[0].title,
    'Banner editado',
  );
  assert.equal((await publishCatalog()).productCount, 2526);
  const publishedSnapshot = await testEnv.FILES.get(PUBLISHED_CATALOG_KEY);
  assert.ok(publishedSnapshot);
  assert.equal(
    (await publishedSnapshot.json<{ products: unknown[] }>()).products.length,
    2526,
  );
  assert.equal(
    Number(
      (
        database
          .prepare('SELECT COUNT(*) AS total FROM published_products')
          .get() as { total: number }
      ).total,
    ),
    2525,
  );
  assert.equal((await listPublishedProducts()).length, 2526);
  assert.equal(
    (await getPublishedConfig()).config.banners[0].title,
    'Banner editado',
  );
  await assert.rejects(() => saveConfig(edited, 1), /outra sessão/);
  setIdentity();
  assert.equal((await getPublication()).status, 403);
  assert.equal(
    (await postPublication(request('/api/publication', { confirm: true })))
      .status,
    403,
  );
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
  assert.ok(data.some((p) => p.code === 'TEST-DRAFT'));
  assert.equal(
    (await postPublication(request('/api/publication', { confirm: true })))
      .status,
    200,
  );
  const republished = (await (
    await getProducts(new Request('https://catalog.test/api/products'))
  ).json()) as typeof products;
  assert.ok(!republished.some((p) => p.code === 'TEST-DRAFT'));
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

void test('published snapshots remove expired discounts without requiring republication', async () => {
  await writePublishedCatalogSnapshot({
    version: 1,
    revision: 123,
    publishedAt: '2000-01-01T00:00:00Z',
    config: clone(),
    products: [
      {
        ...products[0],
        details: {
          offer: {
            enabled: true,
            discount: 35,
            startsAt: '2000-01-01',
            endsAt: '2000-01-02',
          },
        },
      },
    ],
  });
  const snapshot = await readPublishedCatalogSnapshot();
  assert.equal(snapshot?.products[0].details?.offer, undefined);
  assert.equal(snapshot?.revision, 123);
  const response = await getProducts(
    new Request('https://catalog.test/api/products'),
  );
  assert.equal(response.status, 200);
  const items = await response.json();
  assert.ok(Array.isArray(items));
  assert.equal(items[0].details.offer, undefined);
});

void test('forged identity headers do not grant editor access unless a trusted proxy is configured', async () => {
  const { getEditorUser, authorizeMutation } = await import(
    '../lib/editor-access'
  );
  const trusted = testEnv.TRUST_IDENTITY_HEADERS;
  const role = testEnv.WORKER_ROLE;
  try {
    testEnv.TRUST_IDENTITY_HEADERS = '';
    for (const [id, email] of [
      ['editor-password', 'qualquer@exemplo.invalid'],
      ['local-test-id', 'admin@example.test'],
    ]) {
      const h = await headers();
      h.set('oai-authenticated-user-id', id);
      h.set('oai-authenticated-user-email', email);
      assert.equal(await getEditorUser(), null);
      const denied = await authorizeMutation(
        new Request('https://editor.test/api/products', {
          method: 'POST',
          headers: { origin: 'https://editor.test' },
        }),
      );
      assert.equal(denied?.status, 403);
    }
    // Even with trusted headers, the password-session shortcut is not reachable
    // by naming the header user "editor-password".
    testEnv.TRUST_IDENTITY_HEADERS = 'true';
    const h = await headers();
    h.set('oai-authenticated-user-id', 'editor-password');
    h.set('oai-authenticated-user-email', 'qualquer@exemplo.invalid');
    assert.equal(await getEditorUser(), null);
    // The public Worker never accepts edits, even from an administrator.
    setIdentity('admin@example.test');
    testEnv.WORKER_ROLE = 'public';
    const publicDenied = await authorizeMutation(
      new Request('https://public.test/api/uploads', {
        method: 'POST',
        headers: { origin: 'https://public.test' },
      }),
    );
    assert.equal(publicDenied?.status, 404);
  } finally {
    testEnv.TRUST_IDENTITY_HEADERS = trusted;
    testEnv.WORKER_ROLE = role;
    setIdentity();
  }
});

void test('login limits attempts per IP and never redirects off the editor origin', async () => {
  const { POST: login } = await import('../app/api/editor/login/route');
  const env = testEnv as typeof testEnv & {
    EDITOR_PASSWORD?: string;
    LOGIN_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  };
  const attempts = new Map<string, number>();
  env.EDITOR_PASSWORD = 'senha-de-teste';
  env.LOGIN_LIMITER = {
    async limit({ key }) {
      attempts.set(key, (attempts.get(key) ?? 0) + 1);
      return { success: (attempts.get(key) ?? 0) <= 2 };
    },
  };
  const post = (password: string, returnTo: string, ip = '203.0.113.7') => {
    const body = new FormData();
    body.set('password', password);
    body.set('return_to', returnTo);
    return login(
      new Request('https://editor.test/api/editor/login', {
        method: 'POST',
        body,
        headers: { 'cf-connecting-ip': ip },
      }),
    );
  };
  try {
    const ok = await post('senha-de-teste', '/\\evil.example');
    assert.equal(ok.status, 303);
    assert.equal(ok.headers.get('location'), '/editor');
    assert.match(ok.headers.get('set-cookie') ?? '', /HttpOnly/);
    assert.match((await post('errada', '/editor')).headers.get('location')!, /error=1/);
    // Third attempt from the same IP is blocked even with the right password.
    const blocked = await post('senha-de-teste', '/editor');
    assert.match(blocked.headers.get('location')!, /error=limit/);
    assert.equal(blocked.headers.get('set-cookie'), null);
    // Another IP is not affected.
    assert.equal(
      (await post('senha-de-teste', '/editor', '198.51.100.9')).headers.get('location'),
      '/editor',
    );
  } finally {
    delete env.EDITOR_PASSWORD;
    delete env.LOGIN_LIMITER;
  }
});

void test('clearing images changes nothing when the configuration changed in another session', async () => {
  const { POST: clearImages } = await import(
    '../app/api/editor/clear-images/route'
  );
  setIdentity('admin@example.test');
  const count = () =>
    (
      database
        .prepare("SELECT COUNT(*) AS n FROM products WHERE image <> ''")
        .get() as { n: number }
    ).n;
  // Direct row: earlier tests may leave brands/categories empty.
  database.exec(
    "INSERT INTO products (code,name,description,department,section,category,segment,brand,image,created_at,updated_at) VALUES ('CLEAR-IMAGES-TEST','Teste','','D','S','C','Seg','B','/api/uploads?key=images%2Fteste.webp','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')",
  );
  const before = count();
  assert.ok(before > 0);
  const batch = testEnv.DB.batch;
  // Another session saves the configuration between the read and the batch.
  testEnv.DB.batch = async (statements) => {
    database.exec('UPDATE catalog_config SET revision=revision+1 WHERE id=1');
    return batch(statements);
  };
  try {
    const response = await clearImages(
      new Request('https://editor.test/api/editor/clear-images', {
        method: 'POST',
        headers: {
          origin: 'https://editor.test',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ confirm: true }),
      }),
    );
    assert.equal(response.status, 409);
    assert.equal(count(), before);
  } finally {
    testEnv.DB.batch = batch;
    setIdentity();
  }
});

void test('editor session: expired session is identifiable, logout clears the cookie and checks origin', async () => {
  setIdentity();
  const denied = await postConfig(
    request('/api/config', { config: clone(), revision: 1 }),
  );
  assert.equal(denied.status, 403);
  const body = (await denied.json()) as { error: string; code?: string };
  assert.equal(body.code, 'session');
  assert.match(body.error, /sessão expirou/);
  const out = await postLogout(
    new Request('https://catalog.test/api/editor/logout', {
      method: 'POST',
      headers: { origin: 'https://catalog.test' },
    }),
  );
  assert.equal(out.status, 303);
  assert.equal(out.headers.get('location'), '/editor/login?saiu=1');
  assert.match(out.headers.get('set-cookie') ?? '', /Max-Age=0/);
  const forged = await postLogout(
    new Request('https://catalog.test/api/editor/logout', {
      method: 'POST',
      headers: { origin: 'https://attacker.test' },
    }),
  );
  assert.equal(forged.status, 403);
  setIdentity('admin@example.test');
});
