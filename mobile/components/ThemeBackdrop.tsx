import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useIsFocused } from 'expo-router';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop, Circle } from 'react-native-svg';
import type { ThemeId } from '@/lib/theme-registry';

type Festive = Exclude<ThemeId, 'padrao'>;

/** Foto de cada tema comemorativo, como no modelo enviado. */
const PHOTOS: Record<Festive, ImageSourcePropType> = {
  natal: require('@/assets/temas/fundo-natal.jpg'),
  'ano-novo': require('@/assets/temas/fundo-ano-novo.jpg'),
  'dia-das-maes': require('@/assets/temas/fundo-dia-das-maes.jpg'),
  aniversario: require('@/assets/temas/fundo-aniversario.jpg'),
  carnaval: require('@/assets/temas/fundo-carnaval.jpg'),
  'dia-das-criancas': require('@/assets/temas/fundo-dia-das-criancas.jpg'),
  'black-friday': require('@/assets/temas/fundo-black-friday.jpg'),
};

const PHOTO_OPACITY: Partial<Record<Festive, number>> = {
  'black-friday': 0.42,
  carnaval: 0.38,
  natal: 0.38,
};

const GLOW_OPACITY: Partial<Record<Festive, number>> = {
  'black-friday': 0.28,
  carnaval: 0.24,
  'dia-das-maes': 0.21,
};

const SYMBOLS: Record<Festive, string[]> = {
  aniversario: ['✦', '✧', '·', '🎈', '🎉'],
  'ano-novo': ['✦', '✧', '⋆', '✨', '✴'],
  'black-friday': ['%', '✦', '·', '◦', '✧'],
  carnaval: ['✦', '✧', '♫', '●', '🎭'],
  'dia-das-criancas': ['★', '✦', '●', '🎈', '🧸'],
  'dia-das-maes': ['♡', '❀', '✧', '·', '🌸'],
  natal: ['❄', '✦', '⋆', '·', '❄'],
};

const COLORS: Record<Festive, string[]> = {
  aniversario: ['#edc746', '#1972bf', '#ffffff'],
  'ano-novo': ['#f5d262', '#ffffff', '#77b8ff'],
  'black-friday': ['#ed1c31', '#791522', '#ff5264'],
  carnaval: ['#f2cf45', '#e337a0', '#25b8db', '#8f43d5'],
  'dia-das-criancas': ['#f3b82c', '#e95041', '#208ac4', '#79b94b'],
  'dia-das-maes': ['#d94f7c', '#f0a8c0', '#fff0f5'],
  natal: ['#ffffff', '#e4c24b', '#cf3340'],
};

const PARTICLES = 14;

/** Sorteio fixo por posição: as partículas não pulam de lugar quando a tela redesenha. */
function seeded(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Só anima com a tela à vista, o app aberto e sem o pedido de menos movimento do aparelho. */
function useMotionAllowed() {
  const focused = useIsFocused();
  const [reduce, setReduce] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduce(value);
    }).catch(() => {
      if (alive) setReduce(false);
    });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    const app = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => {
      alive = false;
      motion.remove();
      app.remove();
    };
  }, []);
  return focused && foreground && !reduce;
}

function Particle({ index, symbol, color, width, height }: {
  index: number; symbol: string; color: string; width: number; height: number;
}) {
  const progress = useRef(new Animated.Value(seeded(index + 1))).current;
  const spec = useMemo(() => ({
    x: (0.03 + seeded(index + 11) * 0.94) * width,
    size: 10 + seeded(index + 21) * 16,
    opacity: 0.1 + seeded(index + 31) * 0.14,
    duration: (22 + seeded(index + 41) * 28) * 1000,
    sway: -42 + seeded(index + 51) * 84,
  }), [index, width]);

  useEffect(() => {
    // Começa no meio do caminho, como o atraso negativo do modelo, e depois repete do topo.
    const start = seeded(index + 1);
    progress.setValue(start);
    const first = Animated.timing(progress, {
      toValue: 1, duration: (1 - start) * spec.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
    });
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.timing(progress, { toValue: 1, duration: spec.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const all = Animated.sequence([first, loop]);
    all.start();
    return () => all.stop();
  }, [index, progress, spec.duration]);

  const travel = height * 1.12;
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: spec.x,
        top: -height * 0.08,
        fontSize: spec.size,
        lineHeight: spec.size * 1.1,
        color,
        opacity: spec.opacity,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }) },
          { translateX: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, spec.sway, -spec.sway] }) },
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '330deg'] }) },
        ],
      }}
    >
      {symbol}
    </Animated.Text>
  );
}

function Glow({ index, color, opacity, width, height }: {
  index: number; color: string; opacity: number; width: number; height: number;
}) {
  const drift = useRef(new Animated.Value(0)).current;
  const size = Math.min(420, Math.max(150, width * 0.6));
  const left = (seeded(index + 61) * 0.85 - 0.05) * width;
  const top = (seeded(index + 71) * 0.9 - 0.05) * height;
  const duration = (18 + seeded(index + 81) * 14) * 1000;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(drift, {
      toValue: 1, duration: duration * 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [drift, duration]);

  const gid = `glow${index}`;
  return (
    <Animated.View
      style={{
        position: 'absolute', left: left - size / 2, top: top - size / 2, width: size, height: size, opacity,
        transform: [
          { translateX: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-12, 34, -12] }) },
          { translateY: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [14, -26, 14] }) },
          { scale: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.82, 1.18, 0.82] }) },
        ],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.69" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

/** Fundo dos temas comemorativos: foto do tema bem suave, véu nas bordas, brilhos e partículas caindo.
 *  Fica atrás das telas; os painéis brancos continuam por cima. */
export function ThemeBackdrop({ id, page }: { id: Festive; page: string }) {
  const moving = useMotionAllowed();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!moving) return;
    const loop = Animated.loop(Animated.timing(drift, {
      toValue: 1, duration: 50000, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [drift, moving]);

  const { width, height } = size;
  const colors = COLORS[id];
  const symbols = SYMBOLS[id];

  return (
    <View
      style={styles.layer}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : { width: next.width, height: next.height }));
      }}
    >
      <Animated.Image
        source={PHOTOS[id]}
        resizeMode="cover"
        fadeDuration={0}
        style={[
          styles.photo,
          {
            opacity: PHOTO_OPACITY[id] ?? 0.34,
            transform: [
              { scale: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.06, 1.2, 1.06] }) },
              { translateX: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-width * 0.02, width * 0.02, -width * 0.02] }) },
              { translateY: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-height * 0.01, height * 0.014, -height * 0.01] }) },
            ],
          },
        ]}
      />
      {width > 0 ? (
        <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
          <Defs>
            <LinearGradient id="veilX" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={page} stopOpacity={0.32} />
              <Stop offset="0.34" stopColor={page} stopOpacity={0} />
              <Stop offset="1" stopColor={page} stopOpacity={0.22} />
            </LinearGradient>
            <LinearGradient id="veilY" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={page} stopOpacity={0.24} />
              <Stop offset="0.28" stopColor={page} stopOpacity={0} />
              <Stop offset="0.72" stopColor={page} stopOpacity={0} />
              <Stop offset="1" stopColor={page} stopOpacity={0.3} />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={height} fill="url(#veilX)" />
          <Rect width={width} height={height} fill="url(#veilY)" />
        </Svg>
      ) : null}
      {width > 0 && moving ? (
        <>
          {[0, 1].map((i) => (
            <Glow key={`g${i}`} index={i} color={colors[i % colors.length]} opacity={GLOW_OPACITY[id] ?? 0.1} width={width} height={height} />
          ))}
          {Array.from({ length: PARTICLES }, (_, i) => (
            <Particle
              key={`${id}-${i}`}
              index={i}
              symbol={symbols[i % symbols.length]}
              color={colors[i % colors.length]}
              width={width}
              height={height}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  photo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
});
