import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, validateConfig } from '../lib/catalog-config';
import { campaignThemes } from '../lib/catalog-campaign';
import {
  contrastRatio,
  defaultColors,
  resolveColors,
  colorWarnings,
  catalogColorStyle,
  validateColors,
} from '../lib/catalog-colors';
import { getConfig, saveConfig } from '../lib/catalog-repository';
import { database } from './runtime';

void test('automatic text, buttons, secondary text and footer retain contrast for light/dark/bright palettes', () => {
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
  for (const background of [
    '#ffffff',
    '#000000',
    '#ffff00',
    '#777777',
    '#00ccff',
    '#ff00ff',
    '#224422',
  ]) {
    const config = {
      ...defaultConfig,
      background,
      primary: background,
      accent: '#ffff99',
      colors: {
        ...defaultColors,
        footerBackground: background,
        brandSectionBackground: background,
        brandCardBackground: background,
        offerSectionBackground: background,
        newSectionBackground: background,
      },
    };
    const c = resolveColors(config);
    assert.ok(contrastRatio(c.text, background) >= 4.5);
    assert.ok(contrastRatio(c.heading, background) >= 4.5);
    assert.ok(contrastRatio(c.muted, background) >= 4.5);
    assert.ok(contrastRatio(c.highlight, background) >= 4.5);
    assert.ok(contrastRatio(c.primaryText, background) >= 4.5);
    assert.ok(contrastRatio(c.footerText, background) >= 4.5);
    assert.ok(contrastRatio(c.brandCardText, c.brandCardBackground) >= 4.5);
    assert.ok(contrastRatio(c.segmentBorder, config.primary) >= 4.5);
    assert.ok(
      contrastRatio(c.brandSectionText, c.brandSectionBackground) >= 4.5,
    );
    assert.ok(
      contrastRatio(c.offerSectionText, c.offerSectionBackground) >= 4.5,
    );
    assert.ok(contrastRatio(c.newSectionText, c.newSectionBackground) >= 4.5);
    assert.deepEqual(colorWarnings(config), []);
  }
  for (const theme of campaignThemes) {
    const config = {
      ...defaultConfig,
      campaign: { ...defaultConfig.campaign, theme: theme.id },
    };
    const c = resolveColors(config);
    assert.ok(contrastRatio(c.themeText, c.themePanel) >= 4.5);
    assert.ok(contrastRatio(c.themeHeading, c.themePanel) >= 4.5);
    assert.ok(contrastRatio(c.themeHighlight, c.themePanel) >= 4.5);
  }
});

void test('manual colors persist exactly, warn when unreadable, and legacy settings default safely', async () => {
  assert.deepEqual(validateColors(undefined), defaultColors);
  assert.throws(() => validateColors({ text: 'url(https://evil.test)' }));
  assert.throws(() => validateColors([]));
  const config = {
    ...defaultConfig,
    background: '#ffffff',
    colors: {
      ...defaultColors,
      text: '#ffffff',
      heading: '#123456',
      footerBackground: '#000000',
      footerText: '#222222',
      segmentBorder: '#00ff00',
      brandSectionBackground: '#990000',
      brandSectionText: '#ffffff',
      brandCardBackground: '#003366',
      brandCardText: '#ffffff',
      offerSectionBackground: '#111111',
      offerSectionText: '#ffffff',
      newSectionBackground: '#eeeeee',
      newSectionText: '#111111',
    },
  };
  assert.equal(resolveColors(config).text, '#ffffff');
  assert.equal(resolveColors(config).segmentBorder, '#00ff00');
  assert.equal(resolveColors(config).brandSectionBackground, '#990000');
  assert.equal(resolveColors(config).brandSectionText, '#ffffff');
  assert.equal(resolveColors(config).brandCardBackground, '#003366');
  assert.equal(resolveColors(config).brandCardText, '#ffffff');
  assert.equal(resolveColors(config).offerSectionBackground, '#111111');
  assert.equal(resolveColors(config).newSectionText, '#111111');
  assert.equal(validateColors({ text: '#123456' }).brandCardBackground, 'auto');
  assert.throws(() => validateColors({ segmentBorder: 'red' }));
  assert.throws(() => validateColors({ brandCardBackground: '#123' }));
  assert.throws(() => validateColors({ brandSectionBackground: 'red' }));
  assert.ok(colorWarnings(config).includes('Texto principal'));
  assert.ok(colorWarnings(config).includes('Texto do rodapé'));
  assert.equal(
    catalogColorStyle(config)[
      '--catalog-heading' as keyof ReturnType<typeof catalogColorStyle>
    ],
    '#123456',
  );
  const { colors: _old, ...legacy } = defaultConfig;
  assert.deepEqual(validateConfig(legacy).colors, defaultColors);
  database
    .prepare('UPDATE catalog_config SET body=? WHERE id=1')
    .run(JSON.stringify(legacy));
  const before = await getConfig();
  assert.deepEqual(before.config.colors, defaultColors);
  const saved = await saveConfig(config, before.revision);
  assert.deepEqual(saved.config.colors, config.colors);
  assert.deepEqual((await getConfig()).config.colors, config.colors);
});
