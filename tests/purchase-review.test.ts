import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getConfig, listCatalogProducts } from '../lib/catalog-repository';
import { PURCHASE_EXCLUDED_NOTE } from '../lib/product-import';
import { POST as importProducts } from '../app/api/import/products/route';
import {
  GET as getReview,
  POST as postReview,
} from '../app/api/purchase-review/route';
import { POST as buyerLogin } from '../app/api/compras/login/route';
import { GET as buyerProducts } from '../app/api/compras/products/route';
import { POST as buyerSubmit } from '../app/api/compras/submit/route';
import { database, setIdentity } from './runtime';

const origin = 'https://catalog.test';
const post = (path: string, body: unknown, from = origin, cookie = '') =>
  new Request(`${origin}${path}`, {
    method: 'POST',
    headers: { origin: from, 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
const login = (key: string) => {
  const body = new FormData();
  body.set('chave', key);
  return buyerLogin(new Request(`${origin}/api/compras/login`, { method: 'POST', body }));
};
const cookieOf = (response: Response) =>
  (response.headers.get('set-cookie') ?? '').split(';')[0];

void test('purchase review: 64-char key, filtered catalog, approval takes items out and import keeps them out', async () => {
  setIdentity('admin@example.test');
  const { config } = await getConfig();
  const path = config.taxonomy[0];
  const other = config.taxonomy.find((t) => t.category !== path.category)!;
  const row = (n: number, code: string, supplier: string, where = path) => ({
    row: n,
    values: {
      code,
      name: `ITEM COMPRAS ${code}`,
      department: where.department,
      section: where.section,
      category: where.category,
      brand: config.brands[0].name,
      supplier,
      outOfLine: '',
      resale: 'S',
      salesForce: 'S',
    },
  });
  const importRows = async (rows: unknown[]) =>
    (
      (await (
        await importProducts(
          post('/api/import/products', { rows, mode: 'upsert', publishNew: true, sourceFile: 'erp.xlsx' }),
        )
      ).json()) as { results: { code: string; status: string; message: string }[] }
    ).results;
  await importRows([
    row(2, 'CP-1', 'FORNECEDOR ALFA'),
    row(3, 'CP-2', 'FORNECEDOR ALFA'),
    row(4, 'CP-3', 'FORNECEDOR BETA'),
    row(5, 'CP-4', 'FORNECEDOR ALFA', other),
  ]);

  // Filtro e validade inválidos.
  for (const body of [
    { action: 'create', filter: { kind: 'brand', values: ['x'] }, days: 7 },
    { action: 'create', filter: { kind: 'supplier', values: [] }, days: 7 },
    { action: 'create', filter: { kind: 'supplier', values: ['FORNECEDOR ALFA'] }, days: 90 },
  ])
    assert.equal((await postReview(post('/api/purchase-review', body))).status, 400);

  const created = (await (
    await postReview(
      post('/api/purchase-review', {
        action: 'create',
        label: 'Revisão Alfa',
        filter: { kind: 'supplier', values: ['FORNECEDOR ALFA'] },
        days: 7,
      }),
    )
  ).json()) as { id: string; token: string };
  assert.match(created.token, /^[0-9a-f]{64}$/);
  // Só o hash da chave fica no banco.
  assert.doesNotMatch(
    JSON.stringify(database.prepare('SELECT * FROM review_links').all()),
    new RegExp(created.token),
  );

  // Sem chave ou com chave errada, nada.
  setIdentity();
  assert.equal((await buyerProducts(new Request(`${origin}/api/compras/products`))).status, 403);
  assert.match((await login('a'.repeat(64))).headers.get('location') ?? '', /erro=chave/);
  assert.match((await login('curta')).headers.get('location') ?? '', /erro=chave/);
  // O comprador não chega nas rotas do editor.
  assert.equal((await getReview()).status, 403);

  // Chave colada com espaços e maiúsculas também entra.
  const entered = await login(` ${created.token.toUpperCase().replace(/(.{16})/g, '$1 ')} `);
  assert.equal(entered.headers.get('location'), '/compras');
  const session = cookieOf(entered);
  assert.match(entered.headers.get('set-cookie') ?? '', /HttpOnly; SameSite=Strict/);

  const listed = (await (
    await buyerProducts(new Request(`${origin}/api/compras/products`, { headers: { cookie: session } }))
  ).json()) as { products: { code: string; supplier: string }[] };
  const codes = listed.products.map((p) => p.code).filter((c) => c.startsWith('CP-'));
  assert.deepEqual(codes.sort(), ['CP-1', 'CP-2', 'CP-4']);

  // Envio: só itens do filtro, mesma origem, com nome.
  const submit = (body: unknown, from = origin) =>
    buyerSubmit(post('/api/compras/submit', body, from, session));
  assert.equal((await submit({ buyer: 'Ana', codes: ['CP-3'] })).status, 400);
  assert.equal((await submit({ buyer: '', codes: ['CP-1'] })).status, 400);
  assert.equal((await submit({ buyer: 'Ana', codes: ['CP-1'] }, 'https://attacker.test')).status, 403);
  const sent = await submit({ buyer: 'Ana Compras', note: 'Saíram de linha', codes: ['CP-1', 'CP-2'] });
  assert.equal(sent.status, 200);

  // Editor vê o envio pendente e aprova só um item.
  setIdentity('admin@example.test');
  const state = (await (await getReview()).json()) as {
    requests: { id: string; status: string; buyer: string; items: { code: string }[] }[];
    options: { suppliers: [string, number][] };
  };
  const pending = state.requests.find((r) => r.buyer === 'Ana Compras')!;
  assert.equal(pending.status, 'pendente');
  assert.equal(pending.items.length, 2);
  assert.ok(state.options.suppliers.some(([name]) => name === 'FORNECEDOR ALFA'));
  const decided = (await (
    await postReview(post('/api/purchase-review', { action: 'decide', id: pending.id, approve: ['CP-1', 'CP-3'] }))
  ).json()) as { status: string; approved: number };
  assert.deepEqual(decided, { status: 'parcial', approved: 1, rejected: 1 });
  assert.equal(
    (await postReview(post('/api/purchase-review', { action: 'decide', id: pending.id, approve: [] }))).status,
    400,
  );
  const byCode = async (code: string) =>
    (await listCatalogProducts(true, [code]))[0];
  const excluded = await byCode('CP-1');
  assert.equal(excluded.published, false);
  assert.match(excluded.details?.outOfCatalog ?? '', /^Compras: Ana Compras em /);
  assert.equal((await byCode('CP-2')).published, true);

  // O ERP ainda manda CP-1 ativo: continua fora e a importação avisa.
  const again = await importRows([
    { ...row(2, 'CP-1', 'FORNECEDOR ALFA'), expectedUpdatedAt: (await byCode('CP-1')).updatedAt },
  ]);
  assert.equal(again[0].message, PURCHASE_EXCLUDED_NOTE);
  assert.equal((await byCode('CP-1')).published, false);
  assert.ok((await byCode('CP-1')).details?.purchaseExcluded);

  // Desfazer devolve ao catálogo.
  assert.equal(
    (await postReview(post('/api/purchase-review', { action: 'restore', code: 'CP-1' }))).status,
    200,
  );
  const restored = await byCode('CP-1');
  assert.equal(restored.published, true);
  assert.equal(restored.details?.outOfCatalog, undefined);
  assert.equal(restored.details?.purchaseExcluded, undefined);

  // Cancelar a chave derruba a sessão e a própria chave.
  assert.equal(
    (await postReview(post('/api/purchase-review', { action: 'revoke', id: created.id }))).status,
    200,
  );
  setIdentity();
  assert.equal(
    (await buyerProducts(new Request(`${origin}/api/compras/products`, { headers: { cookie: session } }))).status,
    403,
  );
  assert.match((await login(created.token)).headers.get('location') ?? '', /erro=chave/);

  // Chave do catálogo inteiro: o comprador filtra na página.
  setIdentity('admin@example.test');
  const whole = (await (
    await postReview(post('/api/purchase-review', { action: 'create', filter: { kind: 'all', values: [] }, days: 3 }))
  ).json()) as { token: string; label: string };
  assert.equal(whole.label, 'Catálogo inteiro');
  setIdentity();
  const wholeSession = cookieOf(await login(whole.token));
  const all = (await (
    await buyerProducts(new Request(`${origin}/api/compras/products`, { headers: { cookie: wholeSession } }))
  ).json()) as { products: { code: string }[] };
  for (const code of ['CP-1', 'CP-2', 'CP-3', 'CP-4'])
    assert.ok(all.products.some((p) => p.code === code), code);

  // Chave vencida também não entra.
  setIdentity('admin@example.test');
  const expiring = (await (
    await postReview(
      post('/api/purchase-review', { action: 'create', filter: { kind: 'category', values: [path.category] }, days: 1 }),
    )
  ).json()) as { id: string; token: string };
  database.prepare('UPDATE review_links SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z', expiring.id);
  assert.match((await login(expiring.token)).headers.get('location') ?? '', /erro=chave/);
});
