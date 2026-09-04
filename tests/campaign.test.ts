import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CatalogCampaign } from '../components/catalog-campaign';
import {
  campaignThemes,
  defaultCampaign,
  campaignPreset,
  campaignSlides,
} from '../lib/catalog-campaign';
import {
  defaultConfig,
  imageUrl,
  validateCampaign,
  validateConfig,
} from '../lib/catalog-config';
import { getConfig, saveConfig } from '../lib/catalog-repository';
import { database, setIdentity } from './runtime';
import { POST as postConfig } from '../app/api/config/route';
import { offerTimeLabel } from '../components/product-showcase-carousel';

void test('public carousels hide play controls and offer countdown becomes precise in the last 24 hours', () => {
  for (const file of [
    'components/catalog-banners.tsx',
    'components/catalog-campaign.tsx',
    'components/discovery-carousel.tsx',
    'components/product-showcase-carousel.tsx',
  ]) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /<Pause|<Play|Pausar|Retomar|Continuar/);
  }
  const end = '2026-09-10';
  const endTime = new Date(`${end}T23:59:59`).getTime();
  assert.equal(offerTimeLabel(end, endTime - 90_000_000), 'Encerra em 1d 1h');
  assert.equal(
    offerTimeLabel(end, endTime - 18_367_000),
    'Encerra em 05:06:07',
  );
  assert.equal(offerTimeLabel(end, endTime), 'Oferta encerrada');
  const styles = readFileSync('app/globals.css', 'utf8');
  assert.match(styles, /\.offer-perforation[\s\S]*?border-left: 1px dashed/);
  assert.match(styles, /\.offer-card::before,[\s\S]*?\.offer-card::after/);
});

void test('theme is only a background: actual catalog controls occur once and promotional panels are absent', () => {
  const intro = createElement(
    'div',
    null,
    createElement('h1', null, 'Título real do catálogo'),
    createElement('input', { 'aria-label': 'Buscar produtos' }),
    createElement('select', { 'aria-label': 'Filtrar marca' }),
  );
  const children = createElement('p', null, 'RESULTADOS-REAIS');
  for (const enabled of [true, false]) {
    const html = renderToStaticMarkup(
      createElement(
        CatalogCampaign,
        {
          campaign: {
            ...defaultCampaign,
            enabled,
            mode: 'carousel',
            showStats: true,
            slides: [
              {
                id: 'one',
                image: '/themes/natal.png',
                title: 'PROMO-REMOVIDA',
                description: '',
                button: 'CTA-REMOVIDO',
                link: '#catalogo',
                visible: true,
              },
              {
                id: 'two',
                image: '/themes/ano-novo.png',
                title: 'OUTRA-PROMO',
                description: '',
                button: 'CTA-REMOVIDO',
                link: '#catalogo',
                visible: true,
              },
            ],
          },
          intro,
        },
        children,
      ),
    );
    assert.equal((html.match(/aria-label="Buscar produtos"/g) ?? []).length, 1);
    assert.equal((html.match(/aria-label="Filtrar marca"/g) ?? []).length, 1);
    assert.ok(
      html.indexOf('Título real do catálogo') <
        html.indexOf('RESULTADOS-REAIS'),
    );
    assert.ok(html.includes('id="catalogo"'));
    assert.ok(
      !html.includes('PROMO-REMOVIDA') && !html.includes('CTA-REMOVIDO'),
    );
    assert.ok(
      !html.includes('campaign-institution') && !html.includes('campaign-copy'),
    );
    assert.equal(html.includes('campaign-background-carousel'), enabled);
  }
});

void test('campaign reading panels and closed filters are transparent while native options remain opaque', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  const rules = css.slice(
    css.indexOf('Campaign controls sit directly on the artwork'),
  );
  assert.match(
    rules,
    /\.has-background \.section-heading[\s\S]*?background: transparent/,
  );
  assert.match(
    rules,
    /\.has-background \.search-field[\s\S]*?background: transparent/,
  );
  assert.match(
    rules,
    /\.has-background \.filter-field select[\s\S]*?background: transparent/,
  );
  assert.match(rules, /text-shadow:[\s\S]*?var\(--theme-panel/);
  assert.match(
    rules,
    /\.has-background \.filter-field option[\s\S]*?background: var\(--theme-panel/,
  );
});

void test('public catalog keeps one header search and only hierarchy filters in one taxonomy row', () => {
  const source = readFileSync('components/catalog-app.tsx', 'utf8');
  assert.equal((source.match(/aria-label="Buscar produtos"/g) ?? []).length, 1);
  assert.match(source, /className="header-search"/);
  const taxonomy = source.slice(
    source.indexOf('catalog-toolbar catalog-taxonomy-toolbar'),
    source.indexOf(
      '<section',
      source.indexOf('catalog-toolbar catalog-taxonomy-toolbar'),
    ),
  );
  assert.match(taxonomy, /aria-label="Departamento"/);
  assert.match(taxonomy, /label="Seção"/);
  assert.match(taxonomy, /label="Categoria"/);
  assert.doesNotMatch(
    taxonomy,
    /label="Marca"|label="Segmento"|Limpar filtros|search-field/,
  );
  const css = readFileSync('app/globals.css', 'utf8');
  assert.match(
    css,
    /Page-background bands visually separate[\s\S]*?solid var\(--background\)/,
  );
});

void test('seven complete reusable themes have local artwork and preserve unrelated settings', () => {
  assert.equal(campaignThemes.length, 7);
  assert.equal(new Set(campaignThemes.map((t) => t.id)).size, 7);
  for (const theme of campaignThemes) {
    assert.ok(existsSync(`public${theme.image}`));
    assert.equal(imageUrl(theme.image), theme.image);
    const preset = campaignPreset(theme.id, {
      ...defaultCampaign,
      scope: 'catalog',
      showStats: false,
    });
    assert.equal(preset.theme, theme.id);
    assert.equal(preset.scope, 'catalog');
    assert.equal(preset.showStats, false);
    assert.equal(validateCampaign(preset).title, theme.title);
    assert.equal(campaignSlides(preset)[0].image, theme.image);
  }
  assert.throws(() => imageUrl('/themes/../../secret.png'));
  const config = validateConfig({
    ...defaultConfig,
    name: 'Distribuidora do cliente',
    primary: '#394bea',
    campaign: campaignPreset('carnaval', defaultCampaign),
  });
  assert.equal(config.name, 'Distribuidora do cliente');
  assert.equal(config.primary, '#394bea');
});

void test('campaign image, carousel, ordering and safety validation', () => {
  assert.throws(() =>
    validateCampaign({ ...defaultCampaign, theme: 'invented' }),
  );
  assert.throws(
    () => validateCampaign({ ...defaultCampaign, mode: 'image', image: '' }),
    /Envie uma imagem/,
  );
  assert.throws(() =>
    validateCampaign({
      ...defaultCampaign,
      mode: 'image',
      image: 'javascript:alert(1)',
    }),
  );
  assert.throws(
    () => validateCampaign({ ...defaultCampaign, mode: 'carousel' }),
    /ao menos um/,
  );
  for (const value of [-1, 71, NaN])
    assert.throws(() =>
      validateCampaign({ ...defaultCampaign, overlay: value }),
    );
  for (const value of [0, 2, 31])
    assert.throws(() =>
      validateCampaign({ ...defaultCampaign, interval: value }),
    );
  const slide = {
    id: 'one',
    title: 'Primeiro',
    description: '',
    image: '/themes/natal.png',
    link: '#catalogo',
    button: 'Explorar',
    visible: true,
  };
  const c = validateCampaign({
    ...defaultCampaign,
    mode: 'carousel',
    slides: [
      slide,
      { ...slide, id: 'hidden', visible: false },
      { ...slide, id: 'two', title: 'Segundo', image: '/themes/ano-novo.png' },
    ],
  });
  assert.deepEqual(
    campaignSlides(c).map((s) => s.id),
    ['one', 'two'],
  );
  assert.throws(
    () => validateCampaign({ ...c, slides: [slide, slide] }),
    /duplicados/,
  );
  assert.throws(() =>
    validateCampaign({ ...c, slides: [{ ...slide, image: '' }] }),
  );
  assert.throws(() =>
    validateCampaign({
      ...c,
      slides: [{ ...slide, link: 'javascript:alert(1)' }],
    }),
  );
  assert.equal(
    validateCampaign({ ...defaultCampaign, enabled: false, mode: 'carousel' })
      .enabled,
    false,
  );
});

void test('legacy settings receive campaign defaults without overwriting saved identity; campaign persists with revision protection', async () => {
  const { campaign: _campaign, ...legacy } = defaultConfig;
  const stored = { ...legacy, name: 'Minha distribuidora', primary: '#394bea' };
  database
    .prepare(
      'INSERT OR REPLACE INTO catalog_config (id,body,revision) VALUES (1,?,1)',
    )
    .run(JSON.stringify(stored));
  const current = await getConfig();
  assert.equal(current.config.campaign.theme, 'natal');
  assert.equal(current.config.name, stored.name);
  assert.equal(current.config.primary, stored.primary);
  assert.equal(
    String(
      database.prepare('SELECT body FROM catalog_config WHERE id=1').get()
        ?.body ?? '',
    ).includes('campaign'),
    false,
  );
  const saved = await saveConfig(
    {
      ...current.config,
      campaign: campaignPreset('dia-das-maes', current.config.campaign),
    },
    current.revision,
  );
  assert.equal((await getConfig()).config.campaign.theme, 'dia-das-maes');
  assert.equal(saved.config.primary, stored.primary);
  await assert.rejects(
    () => saveConfig(current.config, current.revision),
    /mudaram/,
  );
  const req = (origin: string) =>
    new Request('https://catalog.test/api/config', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ config: saved.config, revision: saved.revision }),
    });
  setIdentity();
  assert.equal((await postConfig(req('https://catalog.test'))).status, 403);
  setIdentity('admin@example.test');
  assert.equal((await postConfig(req('https://other.test'))).status, 403);
});
