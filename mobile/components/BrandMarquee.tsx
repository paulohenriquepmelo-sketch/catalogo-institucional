import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { CachedImage } from '@/components/CachedImage';
import type { Brand } from '@/lib/api';
import { market } from '@/lib/theme';

const SPEED = 40; // pontos por segundo

/** Faixa de marcas que corre sozinha, como no modelo. Para quem pede menos movimento, fica parada e rolável. */
export function BrandMarquee({ brands }: { brands: Brand[] }) {
  const [reduce, setReduce] = useState(false);
  const [setWidth, setSetWidth] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduce(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduce || setWidth <= 0) return;
    offset.setValue(0);
    const loop = Animated.loop(
      Animated.timing(offset, {
        toValue: -setWidth,
        duration: (setWidth / SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, setWidth, offset]);

  const items = useMemo(() => brands.map((brand) => (
    <Pressable
      key={brand.name}
      accessibilityRole="button"
      accessibilityLabel={`Ver produtos de ${brand.name}`}
      onPress={() => router.navigate({ pathname: '/(tabs)/catalogo', params: { brand: brand.name } })}
      style={styles.item}
    >
      {brand.logo ? (
        <CachedImage uri={brand.logo} style={styles.logo} resizeMode="contain" />
      ) : (
        <Text style={styles.name}>{brand.name}</Text>
      )}
    </Pressable>
  )), [brands]);

  if (reduce) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.box} contentContainerStyle={styles.set}>
        {items}
      </ScrollView>
    );
  }

  return (
    <View style={styles.box}>
      <Animated.View style={[styles.track, { transform: [{ translateX: offset }] }]}>
        <View
          style={styles.set}
          onLayout={(event) => setSetWidth(Math.round(event.nativeEvent.layout.width))}
        >
          {items}
        </View>
        {/* Cópia para emendar o giro; o leitor de tela ignora. */}
        <View style={styles.set} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {items}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 12,
    borderRadius: market.radius,
    backgroundColor: market.imageBg,
    borderWidth: 1,
    borderColor: market.line,
    overflow: 'hidden',
  },
  track: { flexDirection: 'row', width: 'auto', alignSelf: 'flex-start' },
  set: { flexDirection: 'row', flexShrink: 0, alignItems: 'center', gap: 28, paddingVertical: 10, paddingHorizontal: 14 },
  item: { minHeight: 48, justifyContent: 'center' },
  logo: { width: 92, height: 44 },
  name: { fontSize: 15, fontWeight: '800', color: '#748078' },
});
