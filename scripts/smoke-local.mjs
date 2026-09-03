import assert from 'node:assert/strict';
const origin = 'http://localhost:3000';
const home = await fetch(origin);
assert.equal(home.status, 200);
await home.arrayBuffer();
const publicProducts = await fetch(`${origin}/api/products`);
assert.equal(publicProducts.status, 200);
const products = await publicProducts.json();
assert.equal(products.length, 2525);
assert.ok(
  products.every((p) => !p.details?.supplier && !p.details?.sourceFile),
);
const configResponse = await fetch(`${origin}/api/config`);
assert.equal(configResponse.status, 200);
const { config } = await configResponse.json();
assert.equal(config.brands.length, 253);
assert.equal(config.taxonomy.length, 43);
assert.equal((await fetch(`${origin}/api/products?editor=1`)).status, 403);
assert.equal(
  (
    await fetch(`${origin}/api/products`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: '{}',
    })
  ).status,
  403,
);
const signIn = await fetch(`${origin}/signin-with-chatgpt?return_to=/editor`, {
  redirect: 'manual',
});
assert.ok([302, 303, 307].includes(signIn.status));
const cookie = signIn.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie);
const editor = await fetch(`${origin}/editor`, { headers: { cookie } });
assert.equal(editor.status, 200);
await editor.arrayBuffer();
const privateResponse = await fetch(`${origin}/api/products?editor=1`, {
  headers: { cookie },
});
assert.equal(privateResponse.status, 200);
const privateProducts = await privateResponse.json();
assert.equal(privateProducts.length, 2525);
assert.ok(privateProducts.find((p) => p.code === '32').details.supplier);
assert.equal(
  (
    await fetch(`${origin}/api/products`, {
      method: 'POST',
      headers: {
        cookie,
        origin: 'https://untrusted.test',
        'content-type': 'application/json',
      },
      body: '{}',
    })
  ).status,
  403,
);
console.log(
  JSON.stringify({
    home: 200,
    products: products.length,
    brands: config.brands.length,
    paths: config.taxonomy.length,
    editor: editor.status,
    anonymousWrite: 'denied',
    crossOriginWrite: 'denied',
    supplier: 'editor-only',
  }),
);
