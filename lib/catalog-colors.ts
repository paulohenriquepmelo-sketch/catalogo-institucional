import type { CSSProperties } from 'react';
import type { CatalogConfig } from './catalog-config';
import { campaignThemes } from './catalog-campaign';

export const defaultColors = {
  text: 'auto',
  heading: 'auto',
  muted: 'auto',
  highlight: 'auto',
  primaryText: 'auto',
  themeText: 'auto',
  themeHeading: 'auto',
  footerBackground: 'auto',
  footerText: 'auto',
  segmentBorder: 'auto',
  segmentSectionBackground: 'auto',
  segmentSectionText: 'auto',
  brandSectionBackground: 'auto',
  brandSectionText: 'auto',
  brandCardBackground: 'auto',
  brandCardText: 'auto',
  offerSectionBackground: 'auto',
  offerSectionText: 'auto',
  newSectionBackground: 'auto',
  newSectionText: 'auto',
};
export type CatalogColors = typeof defaultColors;

export const laurenciniColors: CatalogColors = {
  text: '#15213d',
  heading: '#203770',
  muted: '#60708d',
  highlight: '#ef312f',
  primaryText: '#ffffff',
  themeText: 'auto',
  themeHeading: 'auto',
  footerBackground: '#172f6f',
  footerText: '#ffffff',
  segmentBorder: '#7892d1',
  segmentSectionBackground: '#203976',
  segmentSectionText: '#ffffff',
  brandSectionBackground: '#f7f9fd',
  brandSectionText: '#203770',
  brandCardBackground: '#ffffff',
  brandCardText: '#203770',
  offerSectionBackground: '#203976',
  offerSectionText: '#ffffff',
  newSectionBackground: '#f5f7fb',
  newSectionText: '#203770',
};
export function validateColors(value: unknown): CatalogColors {
  if (value === undefined) return { ...defaultColors };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Revise as cores dos textos.');
  const input = value as Record<string, unknown>;
  const result = { ...defaultColors };
  for (const key of Object.keys(defaultColors) as (keyof CatalogColors)[]) {
    const color = input[key] ?? 'auto';
    if (
      typeof color !== 'string' ||
      (color !== 'auto' && !/^#[0-9a-f]{6}$/i.test(color))
    )
      throw new Error('Use uma cor válida ou o ajuste automático.');
    result[key] = color;
  }
  return result;
}
const rgb = (hex: string) =>
  [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
export function luminance(hex: string) {
  const channels = rgb(hex)
    .map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function contrastRatio(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
export function mixColor(a: string, b: string, amount: number) {
  const other = rgb(b);
  return (
    '#' +
    rgb(a)
      .map((v, i) =>
        Math.round(v * (1 - amount) + other[i] * amount)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function readableText(background: string) {
  if (contrastRatio('#18252b', background) >= 7) return '#18252b';
  return contrastRatio('#000000', background) >=
    contrastRatio('#ffffff', background)
    ? '#000000'
    : '#ffffff';
}
export function readableAccent(accent: string, background: string) {
  const target = readableText(background);
  for (let step = 0; step <= 20; step++) {
    const candidate = mixColor(accent, target, step / 20);
    if (contrastRatio(candidate, background) >= 4.5) return candidate;
  }
  return target;
}

export function resolveColors(
  config: Pick<
    CatalogConfig,
    'background' | 'primary' | 'accent' | 'campaign'
  > & { colors?: CatalogColors },
) {
  const choices = { ...defaultColors, ...config.colors };
  const choose = (value: string, fallback: string) =>
    value === 'auto' ? fallback : value;
  const theme =
    campaignThemes.find((t) => t.id === config.campaign?.theme) ??
    campaignThemes[0];
  // An opaque reading surface avoids guessing contrast from an arbitrary photograph.
  const themePanel =
    config.campaign?.mode === 'theme' ? theme.background : config.background;
  const footerBackground = choose(
    choices.footerBackground,
    mixColor(config.background, '#d1c9ba', 0.2),
  );
  const text = choose(choices.text, readableText(config.background));
  const brandSectionBackground = choose(
    choices.brandSectionBackground,
    config.primary,
  );
  const segmentSectionBackground = choose(
    choices.segmentSectionBackground,
    config.primary,
  );
  const offerSectionBackground = choose(
    choices.offerSectionBackground,
    config.primary,
  );
  const newSectionBackground = choose(
    choices.newSectionBackground,
    config.primary,
  );
  const brandCardBackground = choose(
    choices.brandCardBackground,
    mixColor(
      brandSectionBackground,
      readableText(brandSectionBackground),
      0.08,
    ),
  );
  const heading = choose(choices.heading, readableText(config.background));
  const muted = choose(
    choices.muted,
    readableAccent('#647368', config.background),
  );
  return {
    text,
    heading,
    muted,
    highlight: choose(
      choices.highlight,
      readableAccent(config.accent, config.background),
    ),
    primaryText: choose(choices.primaryText, readableText(config.primary)),
    themePanel,
    themeText: choose(choices.themeText, readableText(themePanel)),
    themeHeading: choose(choices.themeHeading, readableText(themePanel)),
    themeHighlight: readableAccent(config.accent, themePanel),
    footerBackground,
    footerText: choose(choices.footerText, readableText(footerBackground)),
    accentInk: readableText(config.accent),
    segmentBorder: choose(choices.segmentBorder, readableText(config.primary)),
    segmentSectionBackground,
    segmentSectionText: choose(
      choices.segmentSectionText,
      readableText(segmentSectionBackground),
    ),
    brandSectionBackground,
    brandSectionText: choose(
      choices.brandSectionText,
      readableText(brandSectionBackground),
    ),
    brandCardBackground,
    brandCardText: choose(
      choices.brandCardText,
      readableText(brandCardBackground),
    ),
    offerSectionBackground,
    offerSectionText: choose(
      choices.offerSectionText,
      readableText(offerSectionBackground),
    ),
    newSectionBackground,
    newSectionText: choose(
      choices.newSectionText,
      readableText(newSectionBackground),
    ),
  };
}

export function catalogColorStyle(
  config: Parameters<typeof resolveColors>[0],
): CSSProperties {
  const c = resolveColors(config);
  const safeInk = (ink: string, background: string) =>
    contrastRatio(ink, background) >= 4.5 ? ink : readableText(background);
  return {
    '--primary': config.primary,
    '--accent': config.accent,
    '--background': config.background,
    '--foreground': c.text,
    '--muted-foreground': c.muted,
    '--primary-foreground': c.primaryText,
    '--popover': config.background,
    '--popover-foreground': c.text,
    '--catalog-ink': c.text,
    '--catalog-heading': c.heading,
    '--catalog-muted': c.muted,
    '--catalog-highlight': c.highlight,
    '--on-primary': c.primaryText,
    '--on-accent': c.accentInk,
    '--segment-border': c.segmentBorder,
    '--segment-section-background': c.segmentSectionBackground,
    '--segment-section-text': safeInk(
      c.segmentSectionText,
      c.segmentSectionBackground,
    ),
    '--brand-section-background': c.brandSectionBackground,
    '--brand-section-text': safeInk(
      c.brandSectionText,
      c.brandSectionBackground,
    ),
    '--brand-card-background': c.brandCardBackground,
    '--brand-card-text': safeInk(c.brandCardText, c.brandCardBackground),
    '--offer-section-background': c.offerSectionBackground,
    '--offer-section-text': safeInk(
      c.offerSectionText,
      c.offerSectionBackground,
    ),
    '--new-section-background': c.newSectionBackground,
    '--new-section-text': safeInk(c.newSectionText, c.newSectionBackground),
    '--theme-panel': c.themePanel,
    '--theme-text': c.themeText,
    '--theme-heading': c.themeHeading,
    '--theme-highlight': c.themeHighlight,
    '--footer-background': c.footerBackground,
    '--footer-ink': c.footerText,
    '--border': mixColor(
      config.background,
      readableText(config.background),
      0.3,
    ),
    '--muted': mixColor(
      config.background,
      readableText(config.background),
      0.06,
    ),
  } as CSSProperties;
}

export function colorWarnings(config: Parameters<typeof resolveColors>[0]) {
  const c = resolveColors(config);
  const pairs = [
    ['Texto principal', c.text, config.background],
    ['Títulos', c.heading, config.background],
    ['Textos secundários', c.muted, config.background],
    ['Destaques', c.highlight, config.background],
    ['Textos sobre a cor principal', c.primaryText, config.primary],
    [
      'Texto da seção de segmentos',
      c.segmentSectionText,
      c.segmentSectionBackground,
    ],
    ['Texto do rodapé', c.footerText, c.footerBackground],
    ['Texto da seção de marcas', c.brandSectionText, c.brandSectionBackground],
    ['Texto dos cards das marcas', c.brandCardText, c.brandCardBackground],
    [
      'Texto da vitrine de ofertas',
      c.offerSectionText,
      c.offerSectionBackground,
    ],
    ['Texto da vitrine de novidades', c.newSectionText, c.newSectionBackground],
    ...(config.campaign?.enabled
      ? [
          ['Texto sobre o tema', c.themeText, c.themePanel],
          ['Título sobre o tema', c.themeHeading, c.themePanel],
        ]
      : []),
  ];
  return pairs
    .filter(([, color, background]) => contrastRatio(color, background) < 4.5)
    .map(([label]) => label);
}
