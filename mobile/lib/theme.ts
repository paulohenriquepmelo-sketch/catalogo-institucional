export type ThemeTokens = {
  dark: string;
  rgb: string;
  footer: string;
  accent: string;
  onAccent: string;
  link: string;
  titleAccent: string;
  support: string;
  paper: string;
  soft: string;
  tint: string;
  border: string;
  ink: string;
  muted: string;
};

// O tema Padrão preserva a identidade atual do aplicativo.
export const defaultTokens: Readonly<ThemeTokens> = {
  dark: '#172f6f',
  rgb: '23, 47, 111',
  footer: '#172f6f',
  accent: '#d92826',
  onAccent: '#ffffff',
  link: '#263f85',
  titleAccent: '#d92826',
  support: '#263f85',
  paper: '#ffffff',
  soft: '#ffffff',
  tint: '#e2e6f0',
  border: '#e2e6f0',
  ink: '#1a2033',
  muted: '#5b6478',
};

/**
 * Compatibilidade temporária com telas que serão migradas na fase 2.
 * Componentes novos e estrutura devem usar useAppTheme().tokens.
 */
export const colors = {
  primary: '#263f85',
  primaryDark: defaultTokens.dark,
  accent: defaultTokens.accent,
  background: defaultTokens.paper,
  surface: defaultTokens.paper,
  border: defaultTokens.border,
  text: defaultTokens.ink,
  textMuted: defaultTokens.muted,
  textOnPrimary: '#ffffff',
  success: '#1f9d55',
  warning: '#b8860b',
};

export type LegacyColors = typeof colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

export const typography = {
  title: { fontSize: 20, fontWeight: '700' as const },
  subtitle: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
};
