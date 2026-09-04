import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { CatalogBrands } from '../components/catalog-brands';
import { AllBrandsList } from '../components/all-brands-dialog';
import { ProductCard } from '../components/product-card';
import { products } from './fixtures';
import { discover, emptyFilters } from '../lib/catalog-discovery';
import { publishedBrands, brandLogoSearchUrl } from '../lib/catalog-brands';
import { defaultConfig, validateConfig } from '../lib/catalog-config';
import {
  getConfig,
  publishCatalog,
  saveConfig,
} from '../lib/catalog-repository';
import { GET as getConfigRoute } from '../app/api/config/route';
import { setIdentity, database } from './runtime';
import {
  defaultLayout,
  validateLayout,
  catalogLayoutStyle,
} from '../lib/catalog-layout';
import { CatalogSegments } from '../components/catalog-segments';
import { segmentIcon } from '../lib/segment-icons';

void test('brand buttons open dialogs without anchor navigation or global catalog scrolling', () => {
  const brand = products[0].brand;
  const html = renderToStaticMarkup(
    createElement(CatalogBrands, {
      brands: [
        { name: brand, logo: '', published: true, featured: true },
        { name: 'Outra marca', logo: '', published: true, featured: true },
      ],
      items: products,
      email: '',
    }),
  );
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-label="Carrossel de marcas"/);
  assert.match(html, /aria-label="Avançar marcas"/);
  assert.doesNotMatch(html, /Pausar|Continuar|Retomar/);
  assert.match(html, new RegExp('Ver produtos da marca ' + brand));
  assert.doesNotMatch(html, /href=/);
  const source = readFileSync('components/catalog-brands.tsx', 'utf8');
  assert.doesNotMatch(source, /scrollIntoView|window\.location/);
  assert.match(source, /<CollectionProducts/);
  assert.match(
    readFileSync('components/collection-products.tsx', 'utf8'),
    /<ProductDetailsDialog/,
  );
  assert.doesNotMatch(
    readFileSync('components/catalog-app.tsx', 'utf8'),
    /discovery\('brand'/,
  );
});

void test('segments use distinct activity icons and open the same collection popup without scrolling', () => {
  const html = renderToStaticMarkup(
    createElement(CatalogSegments, {
      segments: defaultConfig.segments,
      items: products,
      email: '',
    }),
  );
  assert.equal(
    (html.match(/aria-haspopup="dialog"/g) ?? []).length,
    defaultConfig.segments.length,
  );
  assert.match(html, /Ver produtos do segmento/);
  assert.match(html, /aria-label="Carrossel de segmentos"/);
  assert.match(html, /aria-label="Voltar segmentos"/);
  assert.doesNotMatch(html, /Pausar|Continuar|Retomar/);
  assert.equal(
    (html.match(/data-slot="carousel-item"/g) ?? []).length,
    defaultConfig.segments.length,
  );
  assert.equal(
    new Set(defaultConfig.segments.map((s) => segmentIcon(s.name))).size,
    9,
  );
  assert.ok(segmentIcon('Segmento personalizado'));
  const source = readFileSync('components/catalog-segments.tsx', 'utf8');
  assert.match(source, /kind="segment"/);
  assert.doesNotMatch(source, /scrollIntoView|window\.location/);
  assert.doesNotMatch(
    readFileSync('components/catalog-app.tsx', 'utf8'),
    /scrollIntoView/,
  );
});

void test('unpublished brands never appear, even if featured; featured published brands precede the others', () => {
  const brands = [
    { name: 'Alfa comum', logo: '', published: true, featured: false },
    { name: 'Zeta destaque', logo: '', published: true, featured: true },
    { name: 'Rascunho secreto', logo: '', published: false, featured: true },
  ];
  assert.deepEqual(
    publishedBrands(brands).map((b) => b.name),
    ['Zeta destaque', 'Alfa comum'],
  );
  const html = renderToStaticMarkup(
    createElement(CatalogBrands, { brands, items: [], email: '' }),
  );
  assert.doesNotMatch(html, /Rascunho secreto/);
  assert.match(html, /Zeta destaque/);
  assert.doesNotMatch(html, /Alfa comum/);
  assert.match(html, /Mostrar mais marcas/);
  assert.match(html, /Destaque/);
  const url = new URL(brandLogoSearchUrl('Mãe & Filhos #1'));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.searchParams.get('q'), 'Mãe & Filhos #1 logo oficial');
  assert.equal(url.searchParams.get('tbm'), 'isch');
});

void test('layout bounds, legacy defaults and brand publication survive save/reload with protected draft access', async () => {
  assert.deepEqual(validateLayout(undefined), defaultLayout);
  for (const value of [
    { logoWidth: 321 },
    { logoWidth: '180' },
    { productImageHeight: 0 },
    { productImageFit: 'fill' },
    [],
  ])
    assert.throws(() => validateLayout(value));
  const legacy = {
    ...defaultConfig,
    layout: undefined,
    brands: defaultConfig.brands.map(({ name, logo }) => ({ name, logo })),
  };
  database
    .prepare(
      'INSERT OR REPLACE INTO catalog_config (id,body,revision) VALUES (1,?,1)',
    )
    .run(JSON.stringify(legacy));
  const before = await getConfig();
  assert.deepEqual(before.config.layout, defaultLayout);
  assert.ok(before.config.brands.every((b) => b.published && !b.featured));
  const draftBrand = before.config.brands[0];
  const config = validateConfig({
    ...before.config,
    layout: {
      logoWidth: 240,
      productImageHeight: 150,
      productImageFit: 'contain',
    },
    brands: before.config.brands.map((b, i) =>
      i === 0 ? { ...b, published: false, featured: true } : b,
    ),
  });
  await saveConfig(config, before.revision);
  assert.deepEqual((await getConfig()).config.layout, config.layout);
  assert.equal(
    catalogLayoutStyle(config.layout)[
      '--logo-width' as keyof ReturnType<typeof catalogLayoutStyle>
    ],
    '240px',
  );
  setIdentity();
  const publicResponse = await getConfigRoute(
    new Request('https://catalog.test/api/config'),
  );
  const publicData = (await publicResponse.json()) as { config: typeof config };
  assert.ok(publicData.config.brands.some((b) => b.name === draftBrand.name));
  await publishCatalog();
  const publishedResponse = await getConfigRoute(
    new Request('https://catalog.test/api/config'),
  );
  const publishedData = (await publishedResponse.json()) as {
    config: typeof config;
  };
  assert.ok(
    !publishedData.config.brands.some((b) => b.name === draftBrand.name),
  );
  assert.equal(
    (
      await getConfigRoute(
        new Request('https://catalog.test/api/config?editor=1'),
      )
    ).status,
    403,
  );
  setIdentity('admin@example.test');
  const adminResponse = await getConfigRoute(
    new Request('https://catalog.test/api/config?editor=1'),
  );
  const adminData = (await adminResponse.json()) as { config: typeof config };
  assert.ok(
    adminData.config.brands.some(
      (b) => b.name === draftBrand.name && !b.published && b.featured,
    ),
  );
});
void test('brand-local search is exact, independent and keeps the product-details affordance', () => {
  const brand = products[0].brand;
  const results = discover(products, { ...emptyFilters, brand });
  assert.ok(results.length);
  assert.ok(results.every((p) => p.brand === brand));
  assert.equal(
    discover(products, { ...emptyFilters, brand, query: 'NOT-A-PRODUCT-123' })
      .length,
    0,
  );
  const html = renderToStaticMarkup(
    createElement(ProductCard, { product: products[0], onOpen: () => {} }),
  );
  assert.match(html, /Ver detalhes de/);
  assert.equal(emptyFilters.brand, '');
});

void test('compact product cards keep details accessible without arrow icons and group code and units below the image', () => {
  const product = {
    ...products[0],
    code: '0011236',
    details: { salesUnitDescription: 'UNIDADE', packaging: '01X80G' },
  };
  const html = renderToStaticMarkup(
    createElement(ProductCard, { product, onOpen: () => {} }),
  );
  assert.match(html, /type="button"/);
  assert.match(html, /aria-label="Ver detalhes de/);
  assert.match(html, /class="product-card-body"/);
  assert.match(html, /Código 0011236/);
  assert.match(html, /Unidade: UNIDADE/);
  assert.match(html, /Embalagem: 01X80G/);
  assert.ok(html.indexOf('product-card-body') < html.indexOf('Código 0011236'));
  assert.doesNotMatch(html, /lucide-arrow-right|product-copy|product-code/);
  const placeholder = renderToStaticMarkup(
    createElement(ProductCard, {
      product: { ...products[0], image: '', details: undefined },
      onOpen: () => {},
    }),
  );
  assert.match(placeholder, /Imagem não cadastrada/);
  assert.match(placeholder, /class="product-card-body"/);
  assert.doesNotMatch(
    placeholder,
    /Unidade:|Embalagem:|undefined|lucide-arrow-right/,
  );
  const fallback = renderToStaticMarkup(
    createElement(ProductCard, {
      product: { ...products[0], details: { salesUnit: 'UN' } },
      onOpen: () => {},
    }),
  );
  assert.match(fallback, /Unidade: UN/);
});

void test('product details reserve a larger responsive image stage without cropping', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  const rules = css.slice(
    css.indexOf('A larger product-detail stage uses the available popup area'),
  );
  assert.match(rules, /max-width: 1120px/);
  assert.match(rules, /\.dialog-product-top[\s\S]*?1\.15fr/);
  assert.match(rules, /\.dialog-product-top > img[\s\S]*?height: clamp/);
  assert.match(rules, /object-fit: contain/);
  assert.match(rules, /@media \(max-width: 600px\)[\s\S]*?55dvh/);
});

void test('search results normalize product photos without cropping', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  const rules = css.slice(css.indexOf('.catalog-search-results {'));
  assert.match(
    rules,
    /\.catalog-search-results \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
  );
  assert.match(rules, /grid-auto-rows: max-content/);
  assert.match(
    rules,
    /\.catalog-search-results \.product-card \{[\s\S]*?display: grid;[\s\S]*?grid-template-rows: auto 180px/,
  );
  assert.match(
    rules,
    /\.catalog-search-results \.product-card \{[\s\S]*?min-height: 0;[\s\S]*?height: auto/,
  );
  assert.match(
    rules,
    /\.catalog-search-results \.product-card \.product-image-wrap,[\s\S]*?aspect-ratio: 1 \/ 1/,
  );
  assert.match(
    rules,
    /\.catalog-search-results \.product-card-body \{[\s\S]*?min-height: 0;[\s\S]*?height: 180px/,
  );
  assert.match(
    rules,
    /\.catalog-search-results \.product-image[\s\S]*?object-fit: contain/,
  );
  assert.match(
    rules,
    /\.catalog-search-results \.product-image[\s\S]*?width: 100%;[\s\S]*?height: 100%;[\s\S]*?padding: 10%/,
  );
  assert.match(rules, /object-position: center/);
  assert.match(
    rules,
    /\.catalog-search-results \.product-card:hover \.product-image[\s\S]*?transform: none/,
  );
  assert.match(
    rules,
    /@media \(max-width: 1100px\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    rules,
    /@media \(max-width: 700px\)[\s\S]*?grid-template-columns: 1fr/,
  );
});

void test('product details use strong text and the editor exposes a dedicated commercial contact area', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  assert.match(
    css,
    /\.product-dialog \.product-specifications[\s\S]*?font-weight: 600/,
  );
  const editor = readFileSync('components/config-editor.tsx', 'utf8');
  assert.match(editor, /contact-settings-title/);
  assert.match(editor, /E-mail do contato comercial/);
  assert.match(editor, /change\('email', v\)/);
});

void test('only featured public brands enter the carousel; the searchable popup includes all published brands', () => {
  const brands = Array.from({ length: 35 }, (_, i) => ({
    name: `Marca ${String(i).padStart(2, '0')}`,
    logo: '',
    published: true,
    featured: false,
  }));
  const carousel = renderToStaticMarkup(
    createElement(CatalogBrands, { brands, items: [], email: '' }),
  );
  assert.doesNotMatch(carousel, /data-slot="carousel-item"/);
  assert.match(carousel, /Mostrar mais marcas/);
  const html = renderToStaticMarkup(
    createElement(AllBrandsList, {
      brands: [
        ...brands,
        { name: 'Oculta', logo: '', published: false, featured: true },
      ],
      items: [],
      counts: {},
      email: '',
    }),
  );
  assert.equal((html.match(/aria-haspopup="dialog"/g) ?? []).length, 35);
  assert.match(html, /Ver produtos da marca Marca 34/);
  assert.match(html, /Buscar marca/);
  assert.doesNotMatch(html, /Oculta/);
  const empty = renderToStaticMarkup(
    createElement(AllBrandsList, {
      brands: [],
      items: [],
      counts: {},
      email: '',
    }),
  );
  assert.match(empty, /Nenhuma marca encontrada/);
  assert.doesNotMatch(empty, /data-slot="carousel"/);
});
