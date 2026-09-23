import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { useAppTheme, type AppThemeId } from '@/lib/app-theme';

/**
 * Enfeites dos temas: pisca-pisca animado no cabeçalho, enfeite no canto dos
 * cards e nas abas (ex.: gorro de Papai Noel no Natal). O Padrão não tem
 * enfeite nenhum.
 */

type Bulb = 'bulb' | 'star' | 'heart' | 'confetti' | 'balloon';

type Decor = {
  bulb: Bulb;
  lights: string[];
  card: 'santa-hat' | AppIconName;
  tab?: 'santa-hat' | AppIconName;
};

const DECOR: Partial<Record<AppThemeId, Decor>> = {
  natal: {
    bulb: 'bulb',
    lights: ['#e53935', '#43a047', '#fdd835', '#1e88e5'],
    card: 'santa-hat',
    tab: 'santa-hat',
  },
  'ano-novo': {
    bulb: 'star',
    lights: ['#f5d06f', '#ffffff', '#e8b93b'],
    card: 'sparkles',
    tab: 'sparkles',
  },
  'black-friday': { bulb: 'bulb', lights: ['#ff7a1a', '#ffd23f', '#ffffff'], card: 'percent' },
  'dia-das-maes': {
    bulb: 'heart',
    lights: ['#ec407a', '#f8bbd0', '#ffffff'],
    card: 'heart',
    tab: 'heart',
  },
  aniversario: { bulb: 'confetti', lights: ['#ef5350', '#42a5f5', '#fdd835', '#66bb6a'], card: 'cake' },
  carnaval: { bulb: 'confetti', lights: ['#ab47bc', '#26c6da', '#ffca28', '#ec407a'], card: 'music' },
  'dia-das-criancas': {
    bulb: 'balloon',
    lights: ['#29b6f6', '#ffca28', '#ef5350', '#66bb6a'],
    card: 'balloon',
    tab: 'balloon',
  },
};

export function useThemeDecor() {
  return DECOR[useAppTheme().id];
}

/** Gorro de Papai Noel (vetor, sem imagem). */
export function SantaHat({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* Corpo com a ponta caída para o lado */}
      <Path
        d="M9 44 C 11 27, 23 11, 39 10 C 50 9.5, 58 16, 58 27 C 58 32, 56 36, 53 38 C 51 31, 47 25, 41 25 C 42 32, 45 39, 49 44 Z"
        fill="#d62828"
      />
      <Path d="M41 25 C 42 32, 45 39, 49 44 L 44 44 C 40 38, 38 31, 38 25 Z" fill="#a61b1b" opacity={0.55} />
      <Path
        d="M16 34 C 20 24, 28 16, 38 14"
        stroke="#ff7b7b"
        strokeWidth={2.6}
        fill="none"
        strokeLinecap="round"
        opacity={0.8}
      />
      {/* Aba e pompom brancos com contorno: aparecem até sobre fundo branco */}
      <Rect x={4} y={41} width={50} height={14} rx={7} fill="#ffffff" stroke="#c9d3df" strokeWidth={2} />
      <Circle cx={54} cy={40} r={7.5} fill="#ffffff" stroke="#c9d3df" strokeWidth={2} />
    </Svg>
  );
}

// Respeita "reduzir movimento" do aparelho: as luzes ficam acesas, paradas.
function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => active && setReduce(value));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

function BulbShape({ kind, color, size }: { kind: Bulb; color: string; size: number }) {
  switch (kind) {
    case 'star':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 2 L14.6 8.6 L21.6 9.2 L16.3 13.8 L17.9 20.7 L12 17 L6.1 20.7 L7.7 13.8 L2.4 9.2 L9.4 8.6 Z"
            fill={color}
          />
        </Svg>
      );
    case 'heart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 21 C 5 15, 2 11.5, 2 8 C 2 5, 4.4 3, 7 3 C 9 3, 11 4.2, 12 6 C 13 4.2, 15 3, 17 3 C 19.6 3, 22 5, 22 8 C 22 11.5, 19 15, 12 21 Z"
            fill={color}
          />
        </Svg>
      );
    case 'confetti':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x={7} y={3} width={10} height={18} rx={2} fill={color} transform="rotate(25 12 12)" />
        </Svg>
      );
    case 'balloon':
      return (
        <Svg width={size} height={size * 1.4} viewBox="0 0 24 34">
          <Ellipse cx={12} cy={11} rx={9} ry={11} fill={color} />
          <Path d="M12 22 L10 25 L14 25 Z" fill={color} />
          <Path d="M12 25 C 10 28, 14 30, 12 34" stroke="#ffffffaa" strokeWidth={1} fill="none" />
        </Svg>
      );
    default:
      // Lâmpada de pisca-pisca: bocal + bulbo com brilho.
      return (
        <Svg width={size} height={size * 1.3} viewBox="0 0 20 26">
          <Rect x={7} y={0} width={6} height={6} rx={1} fill="#2e3b2e" />
          <Ellipse cx={10} cy={15} rx={7} ry={10} fill={color} />
          <Ellipse cx={7.5} cy={11} rx={2} ry={3.5} fill="#ffffff66" />
        </Svg>
      );
  }
}

/**
 * Pisca-pisca no pé do cabeçalho, em todas as telas. Um único relógio anima
 * todas as lâmpadas (acendem/apagam alternadas), no thread nativo.
 */
export const ThemeGarland = memo(function ThemeGarland() {
  const decor = useThemeDecor();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const clock = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!decor || reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(clock, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [decor, reduceMotion, clock]);

  const spacing = 30;
  const count = Math.max(6, Math.floor(width / spacing));
  const bulbs = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const x = (i + 0.5) * (width / count);
        // O fio "cai" entre os pontos de apoio (a cada 4 lâmpadas).
        const sag = Math.sin(((i % 4) / 4) * Math.PI) * 5;
        return { i, x, y: sag };
      }),
    [count, width],
  );
  if (!decor) return null;

  const wire = `M 0 2 ${bulbs.map((b) => `L ${b.x.toFixed(1)} ${(b.y + 2).toFixed(1)}`).join(' ')} L ${width} 2`;
  const size = decor.bulb === 'balloon' ? 11 : 12;

  return (
    <View style={styles.garland} pointerEvents="none">
      <Svg width={width} height={10} style={StyleSheet.absoluteFill}>
        <Path d={wire} stroke="#1b2a1b" strokeWidth={1.2} fill="none" opacity={0.7} />
      </Svg>
      {bulbs.map((b) => {
        // Lâmpadas pares e ímpares se revezam, como um pisca-pisca de verdade.
        const opacity = reduceMotion
          ? 1
          : clock.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: b.i % 2 === 0 ? [1, 0.25, 1] : [0.25, 1, 0.25],
            });
        return (
          <Animated.View
            key={b.i}
            style={[styles.bulb, { left: b.x - size / 2, top: b.y, opacity }]}
          >
            <BulbShape kind={decor.bulb} color={decor.lights[b.i % decor.lights.length]} size={size} />
          </Animated.View>
        );
      })}
    </View>
  );
});

/** Enfeite no canto do card de produto (gorro no Natal, ícone nos outros). */
export function CardOrnament() {
  const decor = useThemeDecor();
  if (!decor) return null;
  if (decor.card === 'santa-hat') {
    return (
      <View style={styles.cardHat} pointerEvents="none">
        <SantaHat size={30} />
      </View>
    );
  }
  return (
    <View style={[styles.cardIcon, { backgroundColor: decor.lights[0] }]} pointerEvents="none">
      <AppIcon name={decor.card} size={12} color="#fff" />
    </View>
  );
}

/** Enfeite sobre o ícone da aba (só nos temas que têm). */
export function TabOrnament() {
  const decor = useThemeDecor();
  if (!decor?.tab) return null;
  return (
    <View style={styles.tabOrnament} pointerEvents="none">
      {decor.tab === 'santa-hat' ? (
        <SantaHat size={16} />
      ) : (
        <AppIcon name={decor.tab} size={10} color={decor.lights[0]} fill={decor.lights[0]} />
      )}
    </View>
  );
}

/** Gorro sobre o logo do cabeçalho (só no Natal). */
export function LogoOrnament() {
  const decor = useThemeDecor();
  if (decor?.card !== 'santa-hat') return null;
  return (
    <View style={styles.logoHat} pointerEvents="none">
      <SantaHat size={26} />
    </View>
  );
}

const styles = StyleSheet.create({
  // O cabeçalho tem 12 px de margem lateral (spacing.md): o fio vai de ponta a ponta.
  garland: { height: 22, marginTop: 4, marginBottom: -6, marginHorizontal: -12 },
  bulb: { position: 'absolute' },
  cardHat: { position: 'absolute', top: 0, right: 0, transform: [{ rotate: '18deg' }] },
  cardIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOrnament: { position: 'absolute', top: -8, right: -9, transform: [{ rotate: '20deg' }] },
  logoHat: { position: 'absolute', top: -14, right: -8, transform: [{ rotate: '22deg' }] },
});
