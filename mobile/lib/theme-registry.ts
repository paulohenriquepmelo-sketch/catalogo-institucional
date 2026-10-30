import {
  campaignThemeHero,
  isCampaignThemeId,
  mediaUrl,
  type CampaignThemeId,
  type CatalogConfig,
} from '@/lib/api';
import { defaultTokens, type ThemeTokens } from '@/lib/theme';

export type ThemeId = CampaignThemeId;

export type ThemeCopy = {
  topbar: string;
  offers: string;
  year: string;
};

export type ThemeArts = {
  hero: string;
  panel: string;
  // Textura destinada à repetição sem emendas.
  background: string;
  extras: Readonly<Record<string, string>>;
};

export type ThemeDefinition = {
  id: ThemeId;
  tokens: Readonly<ThemeTokens>;
  arts: ThemeArts;
  copy: ThemeCopy;
  dark: boolean;
};

export const themeCopy: Record<ThemeId, ThemeCopy> = {
  padrao: {
    topbar: 'DISTRIBUIDORA LAURENCINI',
    offers: 'Ofertas',
    year: '2026',
  },
  natal: {
    topbar: 'Natal na Distribuidora Laurencini',
    offers: 'Seleção de Natal',
    year: '2026',
  },
  'ano-novo': {
    topbar: 'Ano Novo, mais oportunidades para o seu negócio!',
    offers: 'Seleção de Ano Novo',
    year: '2026',
  },
  'dia-das-maes': {
    topbar: 'Dia das Mães: carinho em cada escolha',
    offers: 'Seleção para as mães',
    year: '2026',
  },
  aniversario: {
    topbar: 'Celebramos nossa história com você',
    offers: 'Seleção de Aniversário',
    year: '2026',
  },
  carnaval: {
    topbar: 'O Carnaval chegou na Distribuidora Laurencini!',
    offers: 'Seleção de Carnaval',
    year: '2026',
  },
  'dia-das-criancas': {
    topbar: 'Dia das Crianças: mais sorrisos para o seu negócio',
    offers: 'Seleção para as crianças',
    year: '2026',
  },
  'black-friday': {
    topbar: 'Black Friday na Distribuidora Laurencini',
    offers: 'Seleção Black Friday',
    year: '2026',
  },
};

function artsFor(id: ThemeId): ThemeArts {
  const extras: Record<string, string> = {};

  if (id === 'natal') {
    for (const name of [
      'titulo',
      'selecao',
      'frase',
      'marcas',
      'ofertas',
      'segmentos',
      'contato',
      'borda-lateral',
      'guirlanda',
    ]) {
      extras[name] = mediaUrl(`/themes/natal-${name}.webp`);
    }
  }
  if (id === 'ano-novo') {
    extras.ofertas = mediaUrl('/themes/ano-novo-ofertas.webp');
  }

  return {
    hero: campaignThemeHero(id),
    panel: mediaUrl(`/themes/${id}-painel.webp`),
    background: mediaUrl(`/themes/${id}-fundo.webp`),
    extras,
  };
}

function definition(id: ThemeId, tokens: Readonly<ThemeTokens>): ThemeDefinition {
  return {
    id,
    tokens,
    arts: artsFor(id),
    copy: themeCopy[id],
    dark: id === 'black-friday',
  };
}

export const themeRegistry: Readonly<Record<ThemeId, ThemeDefinition>> = {
  padrao: definition('padrao', defaultTokens),
  natal: definition('natal', {
    dark: '#003a25',
    rgb: '0, 58, 37',
    footer: '#001c13',
    accent: '#e60012',
    onAccent: '#ffffff',
    link: '#b00016',
    titleAccent: '#ffffff',
    support: '#d9a441',
    paper: '#ffffff',
    soft: '#faf6ee',
    tint: '#fcebed',
    border: '#e5ded2',
    ink: '#172c25',
    muted: '#526057',
  }),
  'ano-novo': definition('ano-novo', {
    dark: '#06264c',
    rgb: '6, 38, 76',
    footer: '#031b37',
    accent: '#c99222',
    onAccent: '#031b37',
    link: '#785414',
    titleAccent: '#f7d273',
    support: '#f7d273',
    paper: '#ffffff',
    soft: '#faf8f1',
    tint: '#eef3f8',
    border: '#e3e8ee',
    ink: '#06264c',
    muted: '#536071',
  }),
  'dia-das-maes': definition('dia-das-maes', {
    dark: '#741334',
    rgb: '116, 19, 52',
    footer: '#491329',
    accent: '#d90858',
    onAccent: '#ffffff',
    link: '#ad0845',
    titleAccent: '#c5074b',
    support: '#fce8ec',
    paper: '#fffdfd',
    soft: '#fff3f6',
    tint: '#fce8ec',
    border: '#eddde3',
    ink: '#2d1424',
    muted: '#65505c',
  }),
  aniversario: definition('aniversario', {
    dark: '#042650',
    rgb: '4, 38, 80',
    footer: '#042650',
    accent: '#c79528',
    onAccent: '#042650',
    link: '#795710',
    titleAccent: '#00bcea',
    support: '#c79528',
    paper: '#fcfdff',
    soft: '#f0f7fc',
    tint: '#eaf3fb',
    border: '#dde7ef',
    ink: '#042650',
    muted: '#526078',
  }),
  carnaval: definition('carnaval', {
    dark: '#300849',
    rgb: '48, 8, 73',
    footer: '#230b35',
    accent: '#c90076',
    onAccent: '#ffffff',
    link: '#a80063',
    titleAccent: '#ffd044',
    support: '#ffd044',
    paper: '#fff9fd',
    soft: '#fff3fa',
    tint: '#fce5f2',
    border: '#eddfeb',
    ink: '#182e63',
    muted: '#625568',
  }),
  'dia-das-criancas': definition('dia-das-criancas', {
    dark: '#06346b',
    rgb: '6, 52, 107',
    footer: '#052951',
    accent: '#c83b0d',
    onAccent: '#ffffff',
    link: '#a8310c',
    titleAccent: '#c43b12',
    support: '#ffd43b',
    paper: '#ffffff',
    soft: '#fff8e5',
    tint: '#fff5db',
    border: '#e8e8df',
    ink: '#06346b',
    muted: '#555b63',
  }),
  'black-friday': definition('black-friday', {
    dark: '#030303',
    rgb: '3, 3, 3',
    footer: '#030303',
    accent: '#d90020',
    onAccent: '#ffffff',
    link: '#ff6977',
    titleAccent: '#ff3048',
    support: '#ff001a',
    paper: '#030303',
    soft: '#101010',
    tint: '#310009',
    border: '#343434',
    ink: '#ffffff',
    muted: '#bfbfbf',
  }),
};

export function resolveThemeId(config: CatalogConfig | null): ThemeId {
  const campaign = config?.campaign;
  return campaign?.enabled === true &&
    campaign.mode === 'theme' &&
    isCampaignThemeId(campaign.theme)
    ? campaign.theme
    : 'padrao';
}

export function themeArtUrls(arts: ThemeArts): string[] {
  return [
    arts.hero,
    arts.background,
    arts.panel,
    ...Object.values(arts.extras),
  ];
}

/** Mantém os mesmos separadores e a mesma pontuação do site. */
export function splitThemeTitle(title: string): [string, string?, string?] {
  const bars = title.split(' | ').map((part) => part.trim());
  if (bars.length > 1 && bars[0] && bars[1]) {
    return [bars[0], bars[1], bars.slice(2).join(' ') || undefined];
  }

  for (const separator of [/\r?\n/, /\. /, /, /]) {
    const match = separator.exec(title);
    if (!match) continue;

    const keep =
      match[0].startsWith('.') || match[0].startsWith(',') ? match[0][0] : '';
    const first = (title.slice(0, match.index) + keep).trim();
    const second = title.slice(match.index + match[0].length).trim();
    if (first && second) return [first, second];
  }

  return [title];
}
