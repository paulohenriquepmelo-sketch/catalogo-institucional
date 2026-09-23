import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import type { AppIconName } from '@/components/AppIcon';
import { BASE_URL, campaignBackground } from '@/lib/api';
import { useCatalog } from '@/lib/catalog-store';
import { defaultColors, type ThemeColors } from '@/lib/theme';

/**
 * Temas do app, iguais às campanhas do site (lib/catalog-campaign.ts do site):
 * o app usa o tema da campanha ATIVA no editor. Campanha desligada → Padrão.
 * Cada tema troca as cores do app, o selo temático, a frase do topo e a tela
 * de abertura.
 */
export type AppThemeId =
  | 'padrao'
  | 'natal'
  | 'ano-novo'
  | 'black-friday'
  | 'dia-das-maes'
  | 'aniversario'
  | 'carnaval'
  | 'dia-das-criancas';

export type AppTheme = {
  id: AppThemeId;
  name: string;
  colors: ThemeColors;
  /** Selo temático (null no Padrão). */
  badge: { label: string; icon: AppIconName } | null;
  /** Frase do topo: a da campanha no editor, ou a padrão do tema. */
  eyebrow: string;
  title: string;
  /** Imagem do topo da Início (undefined → imagem do próprio app). */
  heroImage?: string;
  /**
   * Onde vai a frase no topo: nas artes de tema (enfeites nas laterais) fica
   * no centro; nas fotos de campanha, à direita, sobre o céu.
   */
  heroTextPosition: 'right' | 'center';
};

// Cor do tema (destaque), tinta (escuro) e fundo claro: as mesmas do site.
type Seasonal = {
  name: string;
  color: string;
  ink: string;
  background: string;
  badge: { label: string; icon: AppIconName };
  eyebrow: string;
  title: string;
};

const SEASONAL: Record<Exclude<AppThemeId, 'padrao'>, Seasonal> = {
  natal: {
    name: 'Natal',
    color: '#b32336',
    ink: '#172b50',
    background: '#eaf0f8',
    badge: { label: 'Especial de Natal', icon: 'tree' },
    eyebrow: 'Um Natal cheio de possibilidades',
    title: 'Seu negócio pronto para a magia do Natal.',
  },
  'ano-novo': {
    name: 'Ano Novo',
    color: '#806019',
    ink: '#17243d',
    background: '#f5f1e7',
    badge: { label: 'Especial de Ano Novo', icon: 'sparkles' },
    eyebrow: 'Novos ciclos, novas possibilidades',
    title: 'Um novo ano. Muitas oportunidades.',
  },
  'black-friday': {
    name: 'Black Friday',
    color: '#a84415',
    ink: '#202128',
    background: '#edebe7',
    badge: { label: 'Black Friday', icon: 'percent' },
    eyebrow: 'Prepare sua operação',
    title: 'Seu mix preparado para a Black Friday.',
  },
  'dia-das-maes': {
    name: 'Dia das Mães',
    color: '#a2305c',
    ink: '#563345',
    background: '#fff0f3',
    badge: { label: 'Especial Dia das Mães', icon: 'heart' },
    eyebrow: 'Carinho em cada detalhe',
    title: 'Um dia especial merece uma seleção especial.',
  },
  aniversario: {
    name: 'Aniversário da empresa',
    color: '#c42e42',
    ink: '#193862',
    background: '#edf2fb',
    badge: { label: 'Aniversário Laurencini', icon: 'cake' },
    eyebrow: 'Celebramos nossa história com você',
    title: 'Nossa parceria é motivo de celebração.',
  },
  carnaval: {
    name: 'Carnaval',
    color: '#7540a4',
    ink: '#453060',
    background: '#f5eefa',
    badge: { label: 'Especial de Carnaval', icon: 'music' },
    eyebrow: 'Mais cor para o seu negócio',
    title: 'Entre no ritmo de novas possibilidades.',
  },
  'dia-das-criancas': {
    name: 'Dia das Crianças',
    color: '#126d87',
    ink: '#21475a',
    background: '#edf9fb',
    badge: { label: 'Especial Dia das Crianças', icon: 'balloon' },
    eyebrow: 'Pequenos momentos, grandes sorrisos',
    title: 'Uma data para colorir de alegria.',
  },
};

// Escurece uma cor #rrggbb (0 a 1) para o tom "escuro" do tema.
function darken(hex: string, amount: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((value >> shift) & 255) * (1 - amount))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

// Objetos de cores estáveis por tema: os estilos ficam em cache por tema.
const COLORS_BY_THEME: Record<AppThemeId, ThemeColors> = {
  padrao: defaultColors,
  ...(Object.fromEntries(
    Object.entries(SEASONAL).map(([id, t]) => [
      id,
      {
        ...defaultColors,
        primary: t.ink,
        primaryDark: darken(t.ink, 0.25),
        accent: t.color,
        header: t.ink,
        soft: t.background,
        offerTint: t.background,
        offerTimer: t.color,
        newsTint: t.background,
        newsBadge: t.ink,
        iconTint: t.background,
      },
    ]),
  ) as Record<Exclude<AppThemeId, 'padrao'>, ThemeColors>),
};

const PADRAO: AppTheme = {
  id: 'padrao',
  name: 'Padrão Laurencini',
  colors: defaultColors,
  badge: null,
  eyebrow: 'Mais que produtos,',
  title: 'Parceria para o seu negócio.',
  heroTextPosition: 'right',
};

export const THEME_OPTIONS: { id: AppThemeId; name: string }[] = [
  { id: 'padrao', name: PADRAO.name },
  ...Object.entries(SEASONAL).map(([id, t]) => ({ id: id as AppThemeId, name: t.name })),
];

type ThemeState = {
  theme: AppTheme;
  /** Prévia de tema escolhida no seletor de teste (null = segue a campanha). */
  preview: AppThemeId | null;
  setPreview: (id: AppThemeId | null) => void;
};

const ThemeContext = createContext<ThemeState>({
  theme: PADRAO,
  preview: null,
  setPreview: () => undefined,
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { config } = useCatalog();
  const campaign = config?.campaign;
  const campaignId = campaign?.enabled === false ? undefined : String(campaign?.theme ?? '');
  const eyebrow = typeof campaign?.eyebrow === 'string' ? campaign.eyebrow : '';
  const title = typeof campaign?.title === 'string' ? campaign.title : '';
  // Foto da marca: a imagem enviada na campanha do site (galpão com os
  // caminhões). É a imagem do Padrão; sem ela, fica a imagem do próprio app.
  const brandPhoto =
    typeof campaign?.image === 'string' && campaign.image ? campaign.image : undefined;
  // Carrossel de campanha: usa o 1º slide como foto da marca.
  const campaignImage = campaign?.mode === 'carousel' ? campaignBackground(config) : brandPhoto;
  // Seletor de prévia: só existe no modo de desenvolvimento (Expo Go). No APK
  // final __DEV__ é false e o tema vem sempre da campanha do site.
  const [preview, setPreview] = useState<AppThemeId | null>(null);
  const activePreview = __DEV__ ? preview : null;

  const theme = useMemo<AppTheme>(() => {
    const id = activePreview ?? campaignId;
    if (!id || !(id in SEASONAL)) {
      // Padrão: sempre a foto da marca (a mesma do site), frase à direita.
      return { ...PADRAO, heroImage: campaignImage };
    }
    const seasonal = SEASONAL[id as keyof typeof SEASONAL];
    const fromCampaign = !activePreview;
    return {
      id: id as AppThemeId,
      name: seasonal.name,
      colors: COLORS_BY_THEME[id as AppThemeId],
      badge: seasonal.badge,
      // O texto editado na campanha do site vale; sem texto (ou na prévia),
      // usa o do tema.
      eyebrow: (fromCampaign && eyebrow.trim()) || seasonal.eyebrow,
      title: (fromCampaign && title.trim()) || seasonal.title,
      // Tema de data: sempre a arte do tema (enfeites nas laterais, frase no
      // centro), para cada data ter a sua cara.
      heroImage: `${BASE_URL}/themes/${id}.png`,
      heroTextPosition: 'center',
    };
  }, [activePreview, campaignId, eyebrow, title, campaignImage]);

  const value = useMemo(() => ({ theme, preview: activePreview, setPreview }), [theme, activePreview]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext).theme;
}

export function useThemeColors() {
  return useContext(ThemeContext).theme.colors;
}

/** Só para o seletor de prévia (modo de desenvolvimento). */
export function useThemePreview() {
  const { preview, setPreview } = useContext(ThemeContext);
  return { preview, setPreview };
}

/**
 * Estilos que dependem das cores do tema. Uso:
 *   const useStyles = createThemedStyles((colors) => ({ ... }));
 *   const styles = useStyles();   // dentro do componente
 * Cada tema monta os estilos uma vez só (cache por tema).
 */
export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: ThemeColors) => T,
) {
  const cache = new WeakMap<ThemeColors, T>();
  return function useStyles(): T {
    const colors = useThemeColors();
    let styles = cache.get(colors);
    if (!styles) {
      styles = StyleSheet.create(factory(colors));
      cache.set(colors, styles);
    }
    return styles;
  };
}
