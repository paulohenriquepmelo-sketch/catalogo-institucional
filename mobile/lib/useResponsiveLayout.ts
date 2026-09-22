import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Hook para auto-ajuste responsivo em diferentes tamanhos de tela.
 * Suporta phones (360-430px), tablets (600px+) e rotações — usa
 * useWindowDimensions (reativo) em vez de Dimensions.get() (estático).
 */
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  // Objeto memoizado: este hook é usado dentro de cada card da lista, e
  // devolver um objeto novo a cada render anulava a memoização dos cards.
  return useMemo(() => {
    const isTablet = width >= 600;

    const columns =
      width < 360 ? 1 :
      width < 430 ? 2 :
      width < 600 ? 2 :
      width < 900 ? 3 :
      4;

    const totalPadding = 32; // 16 * 2 (esquerda + direita)
    const totalGaps = (columns - 1) * 8; // 8px de gap entre cards
    const cardWidth = (width - totalPadding - totalGaps) / columns;

    const spacingMultiplier = isTablet ? 1.2 : 1;

    return {
      width,
      height,
      isTablet,
      isSmallPhone: width < 360,
      columns,
      cardWidth,
      bannerWidth: width - 64,
      spacing: {
        xs: Math.floor(4 * spacingMultiplier),
        sm: Math.floor(8 * spacingMultiplier),
        md: Math.floor(12 * spacingMultiplier),
        lg: Math.floor(16 * spacingMultiplier),
        xl: Math.floor(24 * spacingMultiplier),
        xxl: Math.floor(32 * spacingMultiplier),
      },
      fontSizeMultiplier: isTablet ? 1.15 : 1,
      isPortrait: height >= width,
      isLandscape: width > height,
    };
  }, [width, height]);
}
