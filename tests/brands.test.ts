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
import {
  publishedBrands,
  brandLogoSearchUrl,
  withMultibrand,
  publicBrands,
  MULTIBRAND,
  MIN_BRAND_PRODUCTS,
  brandsWithEnoughProducts,
} from '../lib/catalog-brands';
import { GET as getProductsRoute } from '../app/api/products/route';
import {
  defaultConfig,
  validateConfig,
  whatsappNumber,
} from '../lib/catalog-config';
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
import { segmentIcon, segmentIconById } from '../lib/segment-icons';
import { buildSegments } from '../lib/segments';
import { SEGMENT_RULES } from '../lib/segment-rules';

void test('brand buttons open dialogs without anchor navigation or global catalog scrolling', () => {
  const brand = products[0].brand;
  const html = renderToStaticMarkup(
    createElement(CatalogBrands, {
      brands: [
        { name: brand, logo: '', published: true, featured: true },
        { name: 'Outra marca', logo: '', published: true, featured: true },
      ],
      items: products,
      contact: { email: '', phone: '', whatsapp: '' },
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
  // Produtos com nomes/categorias reais do catálogo, para as regras reconhecerem.
  const real = [
    { name: 'FAR TRIGO PROFISSIONAL D.BENTA 25KG', category: 'DONA BENTA' },
    { name: 'CATCHUP CALCUTA GALAO 3,4KG', category: '1.1-FOOD SERVICE' },
    { name: 'SACOLA PAPEL 7,5KG COMPAPEL 26,5X39', category: 'SACOLAS/ BOBINAS/ SACOS PP' },
    { name: 'CERVEJA HEINEKEN LATA 473 ML', category: '4.1-CERVEJAS' },
  ].map((row, i) => ({ ...products[0], ...row, id: 9000 + i, published: true }));
  const html = renderToStaticMarkup(
    createElement(CatalogSegments, { items: real, contact: { email: '', phone: '', whatsapp: '' } }),
  );
  // Segmentos com as regras do app: só os que têm produto, sem as coleções de data.
  const visible = buildSegments(real).filter(
    (s) => !s.rule.hidden && s.products.length > 0,
  );
  assert.ok(visible.length > 0);
  assert.equal((html.match(/aria-haspopup="dialog"/g) ?? []).length, visible.length);
  assert.match(html, /Ver produtos do segmento/);
  assert.match(html, /aria-label="Carrossel de segmentos"/);
  assert.match(html, /aria-label="Voltar segmentos"/);
  assert.doesNotMatch(html, /Pausar|Continuar|Retomar/);
  assert.equal(
    (html.match(/data-slot="carousel-item"/g) ?? []).length,
    visible.length,
  );
  const listed = SEGMENT_RULES.filter((r) => !r.hidden);
  assert.equal(
    new Set(listed.map((r) => segmentIconById(r.icon, r.name))).size,
    listed.length,
  );
  assert.ok(segmentIcon('Segmento personalizado'));
  const source = readFileSync('components/catalog-segments.tsx', 'utf8');
  assert.match(source, /kind="segment"/);
  assert.match(source, /groups=\{segment\.groups\}/);
  assert.doesNotMatch(source, /scrollIntoView|window\.location/);
  // Abrir um segmento nunca rola a página; a única rolagem do catálogo é a
  // da busca do topo, que leva aos resultados.
  const app = readFileSync('components/catalog-app.tsx', 'utf8');
  assert.equal((app.match(/scrollIntoView/g) ?? []).length, 1);
  assert.match(app, /function search\(query: string\)[\s\S]*?scrollIntoView/);
  // Cartões e lista de segmentos da página inicial também só abrem o popup.
  const sections = readFileSync('components/site-sections.tsx', 'utf8');
  const segmentCode = sections.slice(
    sections.indexOf('function SegmentCard('),
    sections.indexOf('// Carrossel dos painéis azuis'),
  );
  assert.ok(segmentCode.includes('export function HomeSegments('));
  assert.doesNotMatch(segmentCode, /scrollIntoView|window\.location/);
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
    createElement(CatalogBrands, { brands, items: [], contact: { email: '', phone: '', whatsapp: '' } }),
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
  // Produtos da marca despublicada aparecem no site como MULTIMARCAS.
  const publicProducts = (await (
    await getProductsRoute(new Request('https://catalog.test/api/products'))
  ).json()) as { brand: string }[];
  assert.ok(!publicProducts.some((p) => p.brand === draftBrand.name));
  assert.equal(
    publishedData.config.brands.some((b) => b.name === MULTIBRAND),
    publicProducts.some((p) => p.brand === MULTIBRAND),
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
void test('unpublished brands become MULTIMARCAS on the public site, and come back when published', () => {
  const brands = [
    { name: 'COCA COLA', logo: '', published: true, featured: false },
    { name: 'SANTHER', logo: '', published: false, featured: false },
  ];
  const list = [
    { code: '1', brand: 'COCA COLA' },
    { code: '2', brand: 'SANTHER' },
    { code: '3', brand: 'SEM CADASTRO' },
  ];
  const shown = withMultibrand(list, brands);
  assert.deepEqual(shown.map((p) => p.brand), ['COCA COLA', MULTIBRAND, MULTIBRAND]);
  // O original não muda (o editor continua com a marca real).
  assert.equal(list[1].brand, 'SANTHER');
  assert.deepEqual(publicBrands(brands, shown).map((b) => b.name), ['COCA COLA', MULTIBRAND]);
  // Sem produto em MULTIMARCAS, a marca não aparece.
  assert.deepEqual(publicBrands(brands, shown.slice(0, 1)).map((b) => b.name), ['COCA COLA']);
  // Publicar a marca devolve o nome dela.
  const all = brands.map((b) => ({ ...b, published: true }));
  assert.equal(withMultibrand(list, all)[1].brand, 'SANTHER');
  // Uma marca MULTIMARCAS criada no editor (com logo) é usada no lugar da automática.
  const custom = [...brands, { name: MULTIBRAND, logo: '/logo.webp', published: true, featured: false }];
  assert.deepEqual(
    publicBrands(custom, withMultibrand(list, custom)).filter((b) => b.name === MULTIBRAND).map((b) => b.logo),
    ['/logo.webp'],
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
  assert.match(editor, /aria-label="Contato comercial"/);
  assert.match(editor, /E-mail do contato comercial/);
  assert.match(editor, /onChange\(\{ \.\.\.config, email: v \}\)/);
  assert.match(editor, /onChange\(\{ \.\.\.config, whatsapp: v \}\)/);
  assert.match(editor, /onChange\(\{ \.\.\.config, phone: v \}\)/);
  // O contato comercial fica na Visão geral, com o botão de publicar.
  const app = readFileSync('components/editor-app.tsx', 'utf8');
  assert.match(
    app,
    /view === 'overview'[\s\S]*?<CommercialContactSettings[\s\S]*?\{pageSaveBar\}/,
  );
});

void test('commercial WhatsApp and phone are validated and old configs default to empty', () => {
  assert.equal(whatsappNumber('(44) 99999-9999'), '5544999999999');
  assert.equal(whatsappNumber('+55 44 99999-9999'), '5544999999999');
  const saved = validateConfig({
    ...defaultConfig,
    whatsapp: '(44) 99999-9999',
    phone: '(44) 3333-3333',
  });
  assert.equal(saved.whatsapp, '(44) 99999-9999');
  assert.equal(saved.phone, '(44) 3333-3333');
  const { phone: _phone, whatsapp: _whatsapp, ...legacy } = defaultConfig;
  assert.equal(validateConfig(legacy).whatsapp, '');
  assert.throws(
    () => validateConfig({ ...defaultConfig, whatsapp: '9999-9999' }),
    /WhatsApp inválido/,
  );
  assert.throws(
    () => validateConfig({ ...defaultConfig, phone: 'ligue já' }),
    /Telefone inválido/,
  );
});

void test('only featured public brands enter the carousel; the searchable popup includes all published brands', () => {
  const brands = Array.from({ length: 35 }, (_, i) => ({
    name: `Marca ${String(i).padStart(2, '0')}`,
    logo: '',
    published: true,
    featured: false,
  }));
  const carousel = renderToStaticMarkup(
    createElement(CatalogBrands, { brands, items: [], contact: { email: '', phone: '', whatsapp: '' } }),
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
      contact: { email: '', phone: '', whatsapp: '' },
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
      contact: { email: '', phone: '', whatsapp: '' },
    }),
  );
  assert.match(empty, /Nenhuma marca encontrada/);
  assert.doesNotMatch(empty, /data-slot="carousel"/);
});

void test('Acabaram de chegar follows the ERP code, not the import date', async () => {
  const { selectNewProducts } = await import('../components/product-showcase-carousel');
  const make = (code: string, extra: Record<string, unknown> = {}) => ({
    ...products[0],
    id: Number(code),
    code,
    createdAt: code === '9001' ? new Date().toISOString() : '2026-01-01T00:00:00Z',
    details: { ...extra },
  });
  // 9001 foi "criado hoje" por uma importação, mas é código antigo.
  const items = [make('9001'), make('11709'), make('11710'), make('11963'), make('11800', { showAsNew: false }), make('500', { showAsNew: true })];
  assert.deepEqual(selectNewProducts(items, { limit: 3 }).map((p) => p.code), ['500', '11963', '11710']);
  assert.deepEqual(selectNewProducts(items, { limit: 10, fromCode: 11710 }).map((p) => p.code), ['500', '11963', '11710']);
  assert.ok(!selectNewProducts(items, { limit: 10 }).some((p) => p.code === '11800'));
});

void test('tabaco e fogos ficam na lista geral, mas nunca em destaque, oferta ou novidades', async () => {
  const { isRestrictedProduct, withoutRestrictedPromotion } = await import('../lib/restricted-products');
  const { selectNewProducts, selectActiveOffers } = await import('../components/product-showcase-carousel');
  const { validateProduct } = await import('../lib/catalog-repository');
  const { defaultConfig } = await import('../lib/catalog-config');
  for (const name of ['FUMO SABIA DESFIADO 22G', 'PAPEL P/CIGARRO SABIA', 'CHARUTO DANNEMANN'])
    assert.ok(isRestrictedProduct({ name, category: 'UTILIDADES' }), name);
  for (const name of ['BATATA PALHA DUCHEF 1KG', 'SHAMPOO SEDA 325ML', 'BACON DEFUMADO 1KG', 'FUMACA LIQUIDA 100ML'])
    assert.ok(!isRestrictedProduct({ name, category: 'MERCEARIA' }), name);
  for (const name of ['TRAQUES 30UN', 'ESTALINHO FANTASMINHA (GLOBINHO)', 'GIRANDOLA MINI SHOW 468 TIRO E CORES'])
    assert.ok(isRestrictedProduct({ name, category: 'UTILIDADES' }), name);
  assert.ok(isRestrictedProduct({ name: 'BOMBA N° 04', category: 'FOGOS' }));
  for (const name of ['BALA PLUTONITA BOMBA EXPLOSIVA SORT 192G', 'VELA PARANA N 03', 'FOGAO 4 BOCAS'])
    assert.ok(!isRestrictedProduct({ name, category: 'MERCEARIA' }), name);

  const offer = { enabled: true, discount: 10, startsAt: '2026-01-01', endsAt: '2099-12-31' };
  const fumo = {
    ...products[0],
    id: 409,
    code: '99999',
    name: 'FUMO SABIA DESFIADO 22G',
    featured: true,
    published: true,
    details: { offer, showAsNew: true },
  };
  const clean = withoutRestrictedPromotion(fumo);
  assert.equal(clean.featured, false);
  assert.equal(clean.details?.offer, undefined);
  assert.equal(clean.details?.showAsNew, false);
  assert.equal(clean.published, true);
  assert.equal(withoutRestrictedPromotion(products[0]), products[0]);

  // A gravação pelo editor ou pela importação já tira o tabaco das vitrines.
  const saved = validateProduct(fumo, {
    ...defaultConfig,
    brands: [{ name: fumo.brand, logo: '', published: true, featured: false }],
    taxonomy: [{ department: fumo.department, section: fumo.section, category: fumo.category }],
  });
  assert.equal(saved.featured, false);
  assert.equal(saved.details?.offer, undefined);
  assert.equal(saved.published, true);

  // E as vitrines ignoram o que tiver sido gravado antes da regra.
  assert.deepEqual(selectNewProducts([fumo], { limit: 10 }), []);
  assert.deepEqual(selectActiveOffers([fumo], '2026-10-29', 10), []);
});

void test('image cleanup lives in a danger zone with typed confirmation, out of the overview', () => {
  const app = readFileSync('components/editor-app.tsx', 'utf8');
  const start = app.indexOf("view === 'overview'");
  const overview = app.slice(start, app.indexOf('<CatalogPdfPanel', start));
  assert.ok(overview.includes('Seu catálogo em um só lugar'));
  assert.doesNotMatch(overview, /clearProductAndLogoImages/);
  assert.match(app, /Zona de risco/);
  assert.match(app, /cleanupConfirm\.trim\(\) !== 'LIMPAR'/);
});

void test('marca com menos de 4 produtos publicados sai do site e volta ao chegar a 4', () => {
  const brand = (name: string, published = true) => ({ name, logo: '', published, featured: false });
  const items = (name: string, n: number, published = true) =>
    Array.from({ length: n }, () => ({ brand: name, published }));
  const brands = [brand('GRANDE'), brand('PEQUENA'), brand('RASCUNHO'), brand('DESLIGADA', false), brand(MULTIBRAND)];
  const products = [
    ...items('GRANDE', MIN_BRAND_PRODUCTS),
    ...items('PEQUENA', MIN_BRAND_PRODUCTS - 1),
    // Produto não publicado não conta.
    ...items('RASCUNHO', 2),
    ...items('RASCUNHO', 5, false),
  ];
  const result = brandsWithEnoughProducts(brands, products);
  const on = (name: string) => result.find((b) => b.name === name)?.published;
  assert.equal(on('GRANDE'), true);
  assert.equal(on('PEQUENA'), false);
  assert.equal(on('RASCUNHO'), false);
  assert.equal(on('DESLIGADA'), false);
  // MULTIMARCAS recebe os produtos das outras; nunca é escondida pela regra.
  assert.equal(on(MULTIBRAND), true);
  // Os produtos da marca pequena passam a aparecer em MULTIMARCAS.
  assert.ok(withMultibrand(items('PEQUENA', 1), result).every((p) => p.brand === MULTIBRAND));
  // Ao chegar a 4, a marca volta.
  assert.equal(
    brandsWithEnoughProducts(brands, [...products, { brand: 'PEQUENA', published: true }]).find((b) => b.name === 'PEQUENA')?.published,
    true,
  );
});
