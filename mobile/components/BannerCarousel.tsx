import { useState } from 'react';
import {
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CachedImage } from '@/components/CachedImage';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import { colors, radius, spacing, typography } from '@/lib/theme';
import type { Banner } from '@/lib/api';

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const visible = banners.filter((b) => b.visible !== false);
  const [active, setActive] = useState(0);
  // useWindowDimensions (dentro do hook) é reativo — recalcula ao girar a
  // tela, diferente de Dimensions.get() que era medido só uma vez.
  const { width: screenWidth, spacing: adaptiveSpacing } = useResponsiveLayout();

  if (!visible.length) return null;

  const slideWidth = screenWidth - adaptiveSpacing.lg * 2;

  return (
    <View>
      <View style={styles.track}>
        <BannerSlider
          banners={visible}
          onIndexChange={setActive}
          slideWidth={slideWidth}
          gap={adaptiveSpacing.md}
          horizontalPadding={adaptiveSpacing.lg}
        />
      </View>
      {visible.length > 1 && (
        <View style={styles.dots}>
          {visible.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

function BannerSlider({
  banners,
  onIndexChange,
  slideWidth,
  gap,
  horizontalPadding,
}: {
  banners: Banner[];
  onIndexChange: (i: number) => void;
  slideWidth: number;
  gap: number;
  horizontalPadding: number;
}) {
  // Altura calculada explicitamente (proporção 2:1) — não usar height:'100%'
  // aqui, pois o ScrollView pai não tem altura própria definida e isso
  // colapsava os banners para 0px de altura.
  const slideHeight = slideWidth * 0.5;

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: horizontalPadding }}
      snapToInterval={slideWidth + gap}
      decelerationRate="fast"
      onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / (slideWidth + gap));
        onIndexChange(Math.min(banners.length - 1, Math.max(0, index)));
      }}
    >
      {banners.map((banner, i) => (
        <Pressable
          key={banner.id}
          style={[
            styles.slideBase,
            { width: slideWidth, height: slideHeight },
            i > 0 && { marginLeft: gap },
          ]}
          onPress={() => banner.link && Linking.openURL(banner.link)}
        >
          <CachedImage uri={banner.image} style={styles.image} resizeMode="contain" />
          {(banner.title || banner.description) && (
            <View style={styles.caption}>
              {banner.title ? (
                <Text style={styles.captionTitle} numberOfLines={1}>
                  {banner.title}
                </Text>
              ) : null}
              {banner.description ? (
                <Text style={styles.captionText} numberOfLines={2}>
                  {banner.description}
                </Text>
              ) : null}
            </View>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: { marginBottom: spacing.sm },
  slideBase: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  image: { width: '100%', height: '100%' },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: 'rgba(23,47,111,0.82)',
  },
  captionTitle: { ...typography.subtitle, color: '#fff' },
  captionText: { ...typography.small, color: '#fff' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary, width: 16 },
});
