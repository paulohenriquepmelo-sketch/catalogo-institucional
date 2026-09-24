// Identidade visual da Distribuidora Laurencini — mesmas cores usadas no
// catálogo institucional (site público), para o app ficar visualmente
// consistente com o site.
export const colors = {
  primary: '#263f85',
  primaryDark: '#172f6f',
  accent: '#ef312f',
  background: '#ffffff',
  surface: '#ffffff',
  border: '#e2e6f0',
  text: '#1a2033',
  textMuted: '#5b6478',
  textOnPrimary: '#ffffff',
  success: '#1f9d55',
  warning: '#b8860b',
};

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
