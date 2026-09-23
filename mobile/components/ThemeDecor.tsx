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

type Bulb = 'bulb' | 'glow' | 'star' | 'heart' | 'confetti' | 'balloon';

type Decor = {
  bulb: Bulb;
  /** Corda do pisca-pisca: fio simples ou guirlanda de pinheiro com fita. */
  rope?: 'wire' | 'pine';
  lights: string[];
  card: 'santa-hat' | AppIconName;
  tab?: 'santa-hat' | AppIconName;
};

const DECOR: Partial<Record<AppThemeId, Decor>> = {
  natal: {
    // Como no esboço: luzes quentes sobre guirlanda de pinheiro com fita.
    bulb: 'glow',
    rope: 'pine',
    lights: ['#ffd36b', '#ffe7a3', '#ffc14d'],
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
    case 'glow':
      // Luz quente com brilho em volta (halo).
      return (
        <Svg width={size * 2} height={size * 2} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={11} fill={color} opacity={0.18} />
          <Circle cx={12} cy={12} r={7} fill={color} opacity={0.35} />
          <Circle cx={12} cy={12} r={4.2} fill={color} />
          <Circle cx={12} cy={12} r={2.2} fill="#fffbe8" />
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

  const pine = decor?.rope === 'pine';
  const step = pine ? 30 : 30;
  const count = Math.max(6, Math.floor(width / step));
  const bulbs = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const x = (i + 0.5) * (width / count);
        // O fio "cai" entre os pontos de apoio (a cada 4 lâmpadas).
        const sag = pine ? Math.sin(x / 26) * 3 + 7 : Math.sin(((i % 4) / 4) * Math.PI) * 5;
        return { i, x, y: sag };
      }),
    [count, width, pine],
  );
  const pinePaths = useMemo(() => (pine ? buildPineRope(width) : null), [pine, width]);
  if (!decor) return null;

  const wire = `M 0 2 ${bulbs.map((b) => `L ${b.x.toFixed(1)} ${(b.y + 2).toFixed(1)}`).join(' ')} L ${width} 2`;
  const size = decor.bulb === 'balloon' ? 11 : decor.bulb === 'glow' ? 10 : 12;
  // Três grupos que se revezam (mais natural que só pares/ímpares).
  const ranges = [
    [1, 0.35, 0.7, 1],
    [0.35, 1, 0.55, 0.35],
    [0.7, 0.5, 1, 0.7],
  ];

  return (
    <View style={pine ? styles.garlandPine : styles.garland} pointerEvents="none">
      {pinePaths ? (
        <Svg width={width} height={28} style={StyleSheet.absoluteFill}>
          {/* Fundo verde, galhos escuros, fita, e os galhos claros por cima
              (a fita some entre os galhos, dando profundidade). */}
          <Path d={pinePaths.core} stroke="#123320" strokeWidth={7} strokeLinecap="round" fill="none" />
          <Path d={pinePaths.needles[0]} stroke={PINE_GREENS[0]} strokeWidth={1.8} strokeLinecap="round" fill="none" />
          <Path d={pinePaths.needles[1]} stroke={PINE_GREENS[1]} strokeWidth={1.8} strokeLinecap="round" fill="none" />
          <Path d={pinePaths.ribbon} stroke="#c62828" strokeWidth={3.4} strokeLinecap="round" fill="none" />
          <Path d={pinePaths.ribbon} stroke="#ff6b6b" strokeWidth={1} strokeLinecap="round" fill="none" opacity={0.6} />
          <Path d={pinePaths.needles[2]} stroke={PINE_GREENS[2]} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.85} />
        </Svg>
      ) : (
        <Svg width={width} height={10} style={StyleSheet.absoluteFill}>
          <Path d={wire} stroke="#1b2a1b" strokeWidth={1.2} fill="none" opacity={0.7} />
        </Svg>
      )}
      {bulbs.map((b) => {
        const range = ranges[b.i % 3];
        const opacity = reduceMotion
          ? 1
          : clock.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: range });
        const scale = reduceMotion || decor.bulb !== 'glow'
          ? 1
          : clock.interpolate({
              inputRange: [0, 0.33, 0.66, 1],
              outputRange: range.map((v) => 0.8 + v * 0.3),
            });
        const half = decor.bulb === 'glow' ? size : size / 2;
        return (
          <Animated.View
            key={b.i}
            style={[
              styles.bulb,
              { left: b.x - half, top: b.y - (decor.bulb === 'glow' ? half - 2 : 0), opacity },
              decor.bulb === 'glow' ? { transform: [{ scale }] } : null,
            ]}
          >
            <BulbShape kind={decor.bulb} color={decor.lights[b.i % decor.lights.length]} size={size} />
          </Animated.View>
        );
      })}
    </View>
  );
});

const PINE_GREENS = ['#173f24', '#23572f', '#347a42'];

// Guirlanda de pinheiro: agulhas curtas ao longo de uma onda suave, em três
// tons de verde (um caminho por tom = só 3 figuras), e a fita vermelha.
function buildPineRope(width: number) {
  const needles = ['', '', ''];
  const center = (x: number) => 9 + Math.sin(x / 26) * 3;
  let core = '';
  for (let x = 0; x <= width; x += 6) core += `${x === 0 ? 'M' : 'L'} ${x} ${center(x).toFixed(1)} `;
  for (let x = -4, k = 0; x < width + 4; x += 2, k++) {
    const y = center(x);
    const tone = k % 3;
    const dx = 4 + (k % 4);
    const up = 6 + (k % 4);
    needles[tone] += `M ${x.toFixed(1)} ${y.toFixed(1)} l ${dx} ${-up} `;
    needles[(tone + 1) % 3] += `M ${x.toFixed(1)} ${y.toFixed(1)} l ${-dx} ${up - 1} `;
    needles[(tone + 2) % 3] += `M ${x.toFixed(1)} ${y.toFixed(1)} l ${dx + 1} ${up} `;
  }
  let ribbon = '';
  for (let x = 0; x <= width; x += 6) {
    const y = center(x) + Math.sin(x / 11) * 3;
    ribbon += `${x === 0 ? 'M' : 'L'} ${x} ${y.toFixed(1)} `;
  }
  return { core, needles, ribbon };
}

// Floco de neve: 3 eixos com pontas em "V".
function snowflakePath(size: number) {
  const r = size / 2;
  let d = '';
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3;
    const [cx, cy] = [Math.cos(a) * r, Math.sin(a) * r];
    d += `M ${(r - cx).toFixed(1)} ${(r - cy).toFixed(1)} L ${(r + cx).toFixed(1)} ${(r + cy).toFixed(1)} `;
    for (const sign of [1, -1]) {
      const [tx, ty] = [r + sign * cx * 0.62, r + sign * cy * 0.62];
      for (const turn of [0.6, -0.6]) {
        const b = a + (sign > 0 ? 0 : Math.PI) + Math.PI + turn;
        d += `M ${tx.toFixed(1)} ${ty.toFixed(1)} l ${(Math.cos(b) * r * 0.3).toFixed(1)} ${(Math.sin(b) * r * 0.3).toFixed(1)} `;
      }
    }
  }
  return d;
}

// Posições fixas (em % da largura/altura) para os flocos do cabeçalho.
const SNOWFLAKES = [
  { x: 0.27, y: 0.12, s: 16 },
  { x: 0.58, y: 0.07, s: 12 },
  { x: 0.7, y: 0.42, s: 20 },
  { x: 0.9, y: 0.55, s: 12 },
  { x: 0.04, y: 0.72, s: 14 },
  { x: 0.46, y: 0.5, s: 10 },
];

// Galho de pinheiro com bolas de Natal, para o canto superior direito.
function PineBranch({ width = 120, height = 76 }: { width?: number; height?: number }) {
  const { needles, ornaments } = useMemo(() => {
    // Galho curvo que entra pelo canto direito e desce para a esquerda.
    const point = (t: number) => ({
      x: width - t * width * 0.95,
      y: 4 + t * t * height * 0.55,
    });
    let d = '';
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const { x, y } = point(t);
      const len = 9 * (1 - t * 0.45);
      for (const [dx, dy] of [
        [-0.5, -1],
        [-0.6, 1],
        [0.2, 1],
      ]) {
        d += `M ${x.toFixed(1)} ${y.toFixed(1)} l ${(dx * len).toFixed(1)} ${(dy * len).toFixed(1)} `;
      }
    }
    const balls = [
      { t: 0.18, r: 7.5, color: '#c62828', drop: 10 },
      { t: 0.45, r: 6, color: '#e0a526', drop: 8 },
      { t: 0.72, r: 5, color: '#c62828', drop: 7 },
    ].map((b) => ({ ...b, ...point(b.t) }));
    return { needles: d, ornaments: balls };
  }, [width, height]);

  return (
    <Svg width={width} height={height}>
      <Path d={needles} stroke="#1f5a30" strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d={needles} stroke="#3d8a4c" strokeWidth={0.9} strokeLinecap="round" fill="none" opacity={0.8} />
      {ornaments.map((o, i) => (
        <Path key={`f${i}`} d={`M ${o.x} ${o.y} L ${o.x} ${o.y + o.drop}`} stroke="#d9b45b" strokeWidth={1} />
      ))}
      {ornaments.map((o, i) => (
        <Circle key={`b${i}`} cx={o.x} cy={o.y + o.drop + o.r} r={o.r} fill={o.color} />
      ))}
      {ornaments.map((o, i) => (
        <Circle
          key={`h${i}`}
          cx={o.x - o.r * 0.35}
          cy={o.y + o.drop + o.r * 0.65}
          r={o.r * 0.32}
          fill="#ffffff"
          opacity={0.55}
        />
      ))}
    </Svg>
  );
}

/**
 * Fundo temático do cabeçalho (Natal): flocos de neve e galho de pinheiro
 * no canto. Fica atrás do conteúdo e não recebe toques.
 */
export function HeaderDecor() {
  const decor = useThemeDecor();
  const [box, setBox] = useState({ width: 0, height: 0 });
  if (decor?.rope !== 'pine') return null;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setBox(e.nativeEvent.layout)}
    >
      {box.width > 0
        ? SNOWFLAKES.map((f, i) => (
            <Svg
              key={i}
              width={f.s}
              height={f.s}
              style={{ position: 'absolute', left: f.x * box.width, top: f.y * box.height }}
            >
              <Path d={snowflakePath(f.s)} stroke="#ffffff" strokeWidth={1.1} strokeLinecap="round" opacity={0.28} />
            </Svg>
          ))
        : null}
      <View style={styles.pineCorner}>
        <PineBranch />
      </View>
    </View>
  );
}

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
  garlandPine: { height: 28, marginTop: 6, marginBottom: -8, marginHorizontal: -12 },
  bulb: { position: 'absolute' },
  pineCorner: { position: 'absolute', top: 0, right: 0 },
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
