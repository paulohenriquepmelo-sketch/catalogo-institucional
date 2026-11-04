import { useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { CachedImage } from '@/components/CachedImage';
import { useCatalog } from '@/lib/catalog-store';
import { campaignBackground } from '@/lib/api';
import { useLocalImageUri } from '@/lib/image-cache';
import { useAppTheme } from '@/lib/theme-provider';
import { splitThemeTitle } from '@/lib/theme-registry';
import { panelAccent, readableColor } from '@/lib/theme-contrast';
import { market } from '@/lib/theme';

const LOCAL_HERO = require('../assets/hero-laurencini.png');
const HEIGHT = 230;
// Do sólido (28% da largura) ao transparente (80%), como o degradê do modelo.
const FADE_STEPS = Array.from({ length: 14 }, (_, index) => 0.96 * (1 - index / 13));

/**
 * Card principal do modelo. O primeiro slide segue o banner do site público
 * (arte, chamada e textos do tema ativo); os seguintes são os banners do editor.
 */
export function PromoStrip({ width }: { width: number }) {
  const { config } = useCatalog();
  const { id, tokens, arts, year } = useAppTheme();
  const [active, setActive] = useState(0);
  const banners = useMemo(
    () => (config?.banners ?? []).filter((banner) => banner.visible !== false),
    [config?.banners],
  );
  const art = id === 'padrao' ? campaignBackground(config) : arts.hero;
  const uri = useLocalImageUri(art || undefined);
  const campaign = config?.campaign;
  const [first, second, third] = splitThemeTitle(
    campaign?.title?.trim() || 'Distribuidora Laurencini | Seu mix completo',
  );
  const total = 1 + banners.length;

  const styles = useMemo(() => StyleSheet.create({
    root: { marginBottom: 14 },
    slide: {
      minHeight: HEIGHT,
      borderRadius: market.radius,
      overflow: 'hidden',
      backgroundColor: tokens.dark,
    },
    photo: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: '28%',
      right: 0,
      opacity: 0.75,
    },
    fade: { position: 'absolute', top: 0, bottom: 0, left: '28%', width: '52%', flexDirection: 'row' },
    fadeStep: { flex: 1, backgroundColor: tokens.dark },
    copy: { width: '78%', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 34, gap: 9 },
    eyebrow: {
      fontSize: 10,
      letterSpacing: 1.8,
      fontWeight: '700',
      color: '#e2eaff',
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 23,
      lineHeight: 27,
      fontWeight: '800',
      color: '#ffffff',
      textShadowColor: '#00000066',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    titleAccent: { color: panelAccent(tokens.titleAccent, tokens.dark) },
    titleArt: { width: '100%', maxWidth: 230, aspectRatio: 1200 / 703 },
    year: {
      fontSize: 48,
      lineHeight: 52,
      fontWeight: '900',
      color: panelAccent('#f7d273', tokens.dark),
      fontVariant: ['tabular-nums'],
    },
    description: { fontSize: 12, lineHeight: 18, color: '#e1eae3' },
    button: {
      alignSelf: 'flex-start',
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: market.radius,
      backgroundColor: tokens.accent,
      marginTop: 4,
    },
    buttonText: {
      fontSize: 13,
      fontWeight: '700',
      color: readableColor(tokens.onAccent, tokens.accent),
    },
    bannerImage: { ...StyleSheet.absoluteFill },
    dots: {
      position: 'absolute',
      bottom: 10,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 5,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff77' },
    dotOn: { backgroundColor: tokens.accent },
  }), [tokens]);

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={total > 1}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          setActive(Math.min(total - 1, Math.max(0, index)));
        }}
      >
        <View style={[styles.slide, { width }]}>
          <Image
            source={uri ? { uri } : LOCAL_HERO}
            style={styles.photo}
            resizeMode="cover"
            fadeDuration={0}
            accessible={false}
          />
          {/* Degradê em faixas: escurece a foto da esquerda para a direita. */}
          <View style={styles.fade} pointerEvents="none">
            {FADE_STEPS.map((opacity, index) => (
              <View key={index} style={[styles.fadeStep, { opacity }]} />
            ))}
          </View>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>{campaign?.eyebrow || 'Catálogo Laurencini'}</Text>
            {id === 'natal' && arts.extras.titulo ? (
              <View
                accessible
                accessibilityRole="header"
                accessibilityLabel={[first, second, third].filter(Boolean).join(' ')}
              >
                <CachedImage uri={arts.extras.titulo} style={styles.titleArt} resizeMode="contain" />
              </View>
            ) : (
              <Text accessibilityRole="header" style={styles.title}>
                {first}
                {second ? <Text style={styles.titleAccent}>{'\n'}{second}</Text> : null}
                {third ? <Text>{'\n'}{third}</Text> : null}
              </Text>
            )}
            {id === 'ano-novo' ? <Text style={styles.year}>{year}</Text> : null}
            <Text style={styles.description} numberOfLines={4}>
              {campaign?.description || 'Explore produtos de marcas reconhecidas e encontre novas oportunidades para sua loja.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate('/(tabs)/catalogo')}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Ver produtos   →</Text>
            </Pressable>
          </View>
        </View>

        {banners.map((banner) => (
          <Pressable
            key={banner.id}
            accessibilityRole={banner.link ? 'link' : 'image'}
            accessibilityLabel={banner.title || 'Banner da distribuidora'}
            disabled={!banner.link}
            onPress={() => {
              if (banner.link) void Linking.openURL(banner.link);
            }}
            style={[styles.slide, { width }]}
          >
            <CachedImage uri={banner.image} style={styles.bannerImage} resizeMode="cover" />
          </Pressable>
        ))}
      </ScrollView>
      {total > 1 ? (
        <View
          style={styles.dots}
          pointerEvents="none"
          accessible
          accessibilityLabel={`Destaque ${active + 1} de ${total}`}
        >
          {Array.from({ length: total }, (_, index) => (
            <View key={index} style={[styles.dot, index === active && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
