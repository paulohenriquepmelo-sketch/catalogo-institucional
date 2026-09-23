// Identidade visual da Distribuidora Laurencini — mesmas cores usadas no
// catálogo institucional (site público), para o app ficar visualmente
// consistente com o site.
// Cores do tema Padrão. Os temas de campanha (lib/app-theme.tsx) trocam
// primary, primaryDark, accent, header e soft; o resto é comum a todos.
// Nos componentes, as cores vêm do tema ativo: useThemeColors() ou
// createThemedStyles() — nunca direto daqui.
export const defaultColors = {
  primary: '#263f85',
  primaryDark: '#172f6f',
  accent: '#ef312f',
  /** Barra do topo do app. */
  header: '#034598',
  /** Fundo claro de apoio (ícones, faixas suaves). */
  soft: '#eef2fb',
  // Tons específicos da Início e do Catálogo (no Padrão, os valores originais).
  offerTint: '#fff2f2',
  offerTimer: '#ed172a',
  newsTint: '#eef7ff',
  newsBadge: '#159ee9',
  iconTint: '#e7f0fb',
  background: '#ffffff',
  surface: '#ffffff',
  border: '#e2e6f0',
  text: '#1a2033',
  textMuted: '#5b6478',
  textOnPrimary: '#ffffff',
  success: '#1f9d55',
  warning: '#b8860b',
};

export type ThemeColors = typeof defaultColors;

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
