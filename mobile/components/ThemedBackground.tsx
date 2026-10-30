import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  ImageBackground,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useLocalImageUri } from '@/lib/image-cache';
import { useAppTheme } from '@/lib/theme-provider';

const TILE_SIZE = 240;

export function ThemedBackground({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { id, tokens, arts, dark } = useAppTheme();
  const uri = useLocalImageUri(id !== 'padrao' && !dark ? arts.background : undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: tokens.paper },
    decoration: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
    tile: { position: 'absolute', width: TILE_SIZE, height: TILE_SIZE },
  }), [tokens]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) =>
      previous.width === width && previous.height === height
        ? previous
        : { width, height },
    );
  }, []);

  const tiles = useMemo(() => {
    const columns = Math.ceil(size.width / TILE_SIZE);
    const rows = Math.ceil(size.height / TILE_SIZE);
    return Array.from({ length: columns * rows }, (_, index) => ({
      key: index,
      left: (index % columns) * TILE_SIZE,
      top: Math.floor(index / columns) * TILE_SIZE,
    }));
  }, [size]);

  return (
    <View style={[styles.root, style]} onLayout={onLayout}>
      {uri ? (
        <View
          style={styles.decoration}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* A malha pertence ao fundo da tela, nunca aos cards.
              Cada ImageBackground limita a unidade da textura a 240 pontos. */}
          {tiles.map((tile) => (
            <ImageBackground
              key={tile.key}
              source={{ uri }}
              resizeMode="repeat"
              fadeDuration={0}
              style={[styles.tile, { left: tile.left, top: tile.top }]}
            />
          ))}
        </View>
      ) : null}
      {children}
    </View>
  );
}
