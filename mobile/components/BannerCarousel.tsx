import { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CachedImage } from '@/components/CachedImage';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import { useAppTheme } from '@/lib/theme-provider';
import { radius, spacing, typography } from '@/lib/theme';
import type { Banner } from '@/lib/api';

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const { tokens } = useAppTheme();
  const { width, spacing: adaptiveSpacing } = useResponsiveLayout();
  const visible = useMemo(() => banners.filter((banner) => banner.visible !== false), [banners]);
  const [active, setActive] = useState(0);
  const slideWidth = width - adaptiveSpacing.lg * 2;
  const gap = adaptiveSpacing.md;

  const styles = useMemo(() => StyleSheet.create({
    root: { marginVertical: spacing.sm },
    slide: {
      minHeight: 44,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: tokens.soft,
      borderColor: tokens.border,
      borderWidth: 1,
    },
    image: { width: '100%', aspectRatio: 2, backgroundColor: '#ffffff' },
    caption: { padding: spacing.md, gap: spacing.xs, backgroundColor: tokens.dark },
    title: { ...typography.subtitle, color: '#ffffff' },
    description: { ...typography.body, color: '#ffffff' },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
    },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.border },
    active: { width: 20, backgroundColor: tokens.link },
  }), [tokens]);

  if (!visible.length) return null;

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={slideWidth + gap}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: adaptiveSpacing.lg, gap }}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / (slideWidth + gap));
          setActive(Math.min(visible.length - 1, Math.max(0, index)));
        }}
      >
        {visible.map((banner) => (
          <Pressable
            key={banner.id}
            accessibilityRole={banner.link ? 'link' : undefined}
            accessibilityLabel={banner.title || 'Banner da distribuidora'}
            disabled={!banner.link}
            onPress={() => {
              if (banner.link) void Linking.openURL(banner.link);
            }}
            style={[styles.slide, { width: slideWidth }]}
          >
            <CachedImage uri={banner.image} style={styles.image} />
            {banner.title || banner.description ? (
              <View style={styles.caption}>
                {banner.title ? <Text style={styles.title}>{banner.title}</Text> : null}
                {banner.description ? (
                  <Text style={styles.description}>{banner.description}</Text>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
      {visible.length > 1 ? (
        <View style={styles.dots} accessible accessibilityLabel={`Banner ${Math.min(active + 1, visible.length)} de ${visible.length}`}>
          {visible.map((banner, index) => (
            <View key={banner.id} style={[styles.dot, index === active && styles.active]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
