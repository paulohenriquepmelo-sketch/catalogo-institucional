import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  allowedLogoImage,
  logoResult,
  searchLogos,
  searchProductImages,
  retrieveLogo,
  retrieveProductImage,
  boundedLogoResponse,
} from '../lib/logo-search';
import {
  importBrandLogo,
  importProductImage,
} from '../lib/import-brand-logo';
import { BrandLogoPicker } from '../components/brand-logo-picker';
import { ProductImagePicker } from '../components/product-image-picker';
import { GET as searchRoute } from '../app/api/logos/search/route';
import { GET as imageRoute } from '../app/api/logos/image/route';
import { GET as productSearchRoute } from '../app/api/product-images/search/route';
import { GET as productImageRoute } from '../app/api/product-images/image/route';
import { setIdentity } from './runtime';
import { webp } from './image-fixtures';
const page = {
  pageid: 42,
  title: 'File:Marca logo.svg',
  imageinfo: [
    {
      thumburl:
        'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Marca.svg/600px-Marca.svg.png',
      extmetadata: { LicenseShortName: { value: 'Public domain' } },
    },
  ],
};

void test('logo selection does not expose arbitrary URLs, unverified formats or attribution-required images', () => {
  assert.equal(logoResult(page)?.id, 42);
  assert.equal(
    logoResult({
      ...page,
      imageinfo: [
        {
          ...page.imageinfo[0],
          extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } },
        },
      ],
    }),
    null,
  );
  for (const url of [
    'http://thumb.wikimedia.org/wikipedia/commons/a.png',
    'https://127.0.0.1/a.png',
    'https://thumb.wikimedia.org.evil.test/wikipedia/commons/a.png',
    'https://user:password@thumb.wikimedia.org/wikipedia/commons/a.png',
    'https://thumb.wikimedia.org/wikipedia/commons/a.svg',
    'https://upload.wikimedia.org:8443/wikipedia/commons/a.png',
    'https://upload.wikimedia.org/secret.png',
  ])
    assert.throws(() => allowedLogoImage(url));
  assert.equal(
    allowedLogoImage(page.imageinfo[0].thumburl + '?tracking=yes'),
    page.imageinfo[0].thumburl,
  );
});

void test('search and download require admin; failed validation performs no outgoing request', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    throw new Error('Unexpected request');
  });
  setIdentity();
  assert.equal(
    (
      await searchRoute(
        new Request('https://catalog.test/api/logos/search?q=Marca'),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await imageRoute(
        new Request('https://catalog.test/api/logos/image?id=42'),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await productSearchRoute(
        new Request('https://catalog.test/api/product-images/search?q=Produto'),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await productImageRoute(
        new Request('https://catalog.test/api/product-images/image?id=42'),
      )
    ).status,
    403,
  );
  await assert.rejects(() => searchLogos('x'));
  await assert.rejects(() => searchProductImages('x'));
  await assert.rejects(() => retrieveLogo('https://127.0.0.1'));
  await assert.rejects(() => retrieveProductImage('https://127.0.0.1'));
  assert.equal(calls, 0);
});

void test('provider results and raster retrieval use bounded, non-redirecting requests', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async (input: unknown, init?: RequestInit) => {
      assert.equal(init?.redirect, 'manual');
      assert.match(
        String(new Headers(init?.headers).get('user-agent')),
        /CatalogLogoPicker/,
      );
      if (String(input).startsWith('https://commons.wikimedia.org/w/api.php'))
        return Response.json({ query: { pages: { 42: page } } });
      assert.equal(String(input), page.imageinfo[0].thumburl);
      return new Response(webp, { headers: { 'content-type': 'image/webp' } });
    },
  );
  assert.equal((await searchLogos('Marca'))[0].id, 42);
  assert.equal((await searchProductImages('Produto Marca'))[0].id, 42);
  const image = await retrieveLogo('42');
  assert.equal(image.contentType, 'image/webp');
  assert.deepEqual(image.bytes, webp);
  setIdentity('admin@example.test');
  assert.equal(
    (
      await imageRoute(
        new Request('https://catalog.test/api/logos/image?id=42'),
      )
    ).status,
    200,
  );
  await assert.rejects(
    () =>
      boundedLogoResponse(
        new Response('', {
          status: 302,
          headers: { location: 'http://localhost/' },
        }),
        100,
      ),
    /HTTP 302/,
  );
  await assert.rejects(
    () => boundedLogoResponse(new Response(new Uint8Array(101)), 100),
    /tamanho/,
  );
});

void test('product image selection uses its protected endpoint and the same optimized upload pipeline', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async (input: unknown, init?: RequestInit) => {
      if (String(input) === '/api/product-images/image?id=42')
        return new Response(webp, {
          headers: { 'content-type': 'image/webp' },
        });
      assert.equal(input, '/api/uploads');
      assert.equal(init?.method, 'POST');
      assert.ok(init?.body instanceof FormData);
      return Response.json({ url: '/api/uploads?key=images%2Fproduto.webp' });
    },
  );
  const result = await importProductImage(42, 'Produto teste');
  assert.equal(
    result.url,
    '/api/uploads?key=images%2Fproduto.webp',
  );
  assert.match(result.summary, /WebP/);
});

void test('selecting a logo uploads WebP and returns the new URL only after success, without saving other brand fields', async (t) => {
  let uploaded = false;
  let failure = false;
  t.mock.method(
    globalThis,
    'fetch',
    async (input: unknown, init?: RequestInit) => {
      if (String(input) === '/api/logos/image?id=42')
        return new Response(webp, {
          headers: { 'content-type': 'image/webp' },
        });
      assert.equal(input, '/api/uploads');
      assert.equal(init?.method, 'POST');
      assert.ok(init);
      assert.ok(init.body instanceof FormData);
      const file = init.body.get('file') as File;
      assert.equal(file.type, 'image/webp');
      assert.equal(file.name, 'Marca.webp');
      assert.deepEqual(new Uint8Array(await file.arrayBuffer()), webp);
      uploaded = true;
      return failure
        ? Response.json({ error: 'Falha simulada' }, { status: 500 })
        : Response.json({ url: '/api/uploads?key=images%2Fabc.webp' });
    },
  );
  const result = await importBrandLogo(42, 'Marca');
  assert.equal(uploaded, true);
  assert.equal(result.url, '/api/uploads?key=images%2Fabc.webp');
  assert.match(result.summary, /WebP/);
  failure = true;
  await assert.rejects(() => importBrandLogo(42, 'Marca'), /Falha simulada/);
});

void test('the magnifier opens an in-editor dialog rather than navigating away', () => {
  const html = renderToStaticMarkup(
    createElement(BrandLogoPicker, {
      name: 'Marca',
      onBusy: () => {},
      onChange: () => {},
    }),
  );
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /Buscar e selecionar logo/);
  assert.doesNotMatch(html, /href=/);
});

void test('the product magnifier opens the same in-editor selection flow', () => {
  const html = renderToStaticMarkup(
    createElement(ProductImagePicker, {
      name: 'Produto teste',
      brand: 'Marca',
      code: '123',
      onBusy: () => {},
      onChange: () => {},
    }),
  );
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /Buscar e selecionar foto/);
  assert.doesNotMatch(html, /href=/);
});
