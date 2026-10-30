import { useEffect, useMemo, useState } from 'react';
import { router, useNavigation } from 'expo-router';
import type { NavigationProp, ParamListBase } from 'expo-router/react-navigation';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { BannerCarousel } from '@/components/BannerCarousel';
import { CachedImage } from '@/components/CachedImage';
import { ProductRow } from '@/components/ProductRow';
import { ThemedBackground } from '@/components/ThemedBackground';
import { PanelHeading, ThemedPanel } from '@/components/ThemedPanel';
import { useCatalog } from '@/lib/catalog-store';
import {
  activeOffers,
  BASE_URL,
  campaignBackground,
  newProducts,
  publishedBrands,
} from '@/lib/api';
import { useLocalImageUri } from '@/lib/image-cache';
import { useAppTheme } from '@/lib/theme-provider';
import { splitThemeTitle } from '@/lib/theme-registry';
import { panelAccent, readableColor } from '@/lib/theme-contrast';
import { radius, spacing, typography } from '@/lib/theme';

const LOCAL_HERO = require('../../assets/hero-laurencini.png');
// O navegador não implementa resolveAssetSource. A proporção de reserva
// só define o quadro; contain mantém a arte institucional inteira.
const LOCAL_SOURCE = Platform.OS === 'web' ? undefined : Image.resolveAssetSource(LOCAL_HERO);
const LOCAL_RATIO = LOCAL_SOURCE?.height
  ? LOCAL_SOURCE.width / LOCAL_SOURCE.height
  : 3;
const PRELOAD_TABS = ['catalogo', 'segmentos', 'ofertas', 'novidades', 'marcas'] as const;

function normalizeText(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function iconForSection(name: string): AppIconName {
  const normalized = normalizeText(name);
  if (normalized.includes('bebid')) return 'beer';
  if (/aliment|merceari|food/.test(normalized)) return 'basket';
  if (normalized.includes('higien')) return 'medkit';
  if (/limpez|saneant/.test(normalized)) return 'spray';
  if (/perfum|cosmet/.test(normalized)) return 'flask';
  if (/descart|copo/.test(normalized)) return 'cafe';
  if (/biscoit|bomb|doce|choc/.test(normalized)) return 'cube';
  return 'grid';
}

function useHomeStyles() {
  const { tokens } = useAppTheme();
  return useMemo(() => StyleSheet.create({
    scroll: { flex: 1 },
    content: { paddingBottom: spacing.xl, gap: spacing.lg },
    notice: { padding: spacing.md, backgroundColor: tokens.soft },
    noticeText: { ...typography.body, color: tokens.ink },
    heroText: { padding: spacing.xl, gap: spacing.md },
    eyebrow: {
      ...typography.small,
      color: '#ffffff',
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 30,
      fontWeight: '800',
      color: '#ffffff',
      textShadowColor: '#000000',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    titleArt: { width: '100%', maxWidth: 340, aspectRatio: 1200 / 703 },
    titleAccent: { color: panelAccent(tokens.titleAccent, tokens.dark) },
    description: { ...typography.body, color: '#ffffff' },
    year: {
      fontSize: 64,
      fontWeight: '900',
      color: panelAccent('#f7d273', tokens.dark),
      fontVariant: ['tabular-nums'],
    },
    heroImage: { width: '100%' },
    button: {
      minHeight: 48,
      minWidth: 44,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: tokens.accent,
      borderRadius: radius.md,
    },
    buttonText: {
      ...typography.body,
      fontWeight: '800',
      color: readableColor(tokens.onAccent, tokens.accent),
    },
    benefits: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: spacing.lg,
      gap: spacing.lg,
    },
    benefit: { flexGrow: 1, flexBasis: 140, gap: spacing.sm },
    benefitText: { ...typography.small, color: '#ffffff' },
    categories: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    category: {
      width: 148,
      minHeight: 100,
      backgroundColor: tokens.soft,
      borderColor: tokens.border,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    categoryText: { ...typography.body, color: tokens.ink, fontWeight: '700' },
    section: { paddingBottom: spacing.lg, gap: spacing.sm },
    brandRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
    brandCard: {
      width: 144,
      minHeight: 112,
      backgroundColor: tokens.soft,
      borderColor: tokens.border,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.sm,
      gap: spacing.sm,
      alignItems: 'center',
    },
    brandLogo: { width: '100%', height: 64, backgroundColor: '#ffffff' },
    brandName: { ...typography.body, color: tokens.ink, textAlign: 'center' },
    contact: { padding: spacing.lg, gap: spacing.md },
    contactTitle: { ...typography.title, color: '#ffffff' },
    countdown: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      color: '#ffffff',
      ...typography.body,
      fontVariant: ['tabular-nums'],
    },
  }), [tokens]);
}

export default function HomeScreen() {
  const { config, products, refreshing, refresh, offline } = useCatalog();
  const { tokens, copy } = useAppTheme();
  const styles = useHomeStyles();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const hasProducts = products.length > 0;

  useEffect(() => {
    if (!hasProducts) return;
    const timers = PRELOAD_TABS.map((name, index) =>
      setTimeout(() => navigation.preload(name), 1_200 + index * 500),
    );
    return () => timers.forEach(clearTimeout);
  }, [navigation, hasProducts]);

  const offers = useMemo(
    () => activeOffers(products, config?.offers.limit ?? 12),
    [products, config?.offers.limit],
  );
  const news = useMemo(
    () => newProducts(products, config?.newProducts.fromCode, config?.newProducts.limit ?? 12),
    [products, config?.newProducts.fromCode, config?.newProducts.limit],
  );
  const brands = useMemo(
    () => publishedBrands(config?.brands ?? []).slice(0, 10),
    [config?.brands],
  );
  const catalogSizeLabel = useMemo(() => {
    const count = products.filter((product) => product.published !== false).length;
    if (count < 100) return 'Mix completo para o seu negócio';
    const rounded = Math.floor(count / 100) * 100;
    return `Mais de ${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} produtos`;
  }, [products]);
  const shortcuts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      if (product.published === false) continue;
      const section = product.section?.trim();
      if (section) counts.set(section, (counts.get(section) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .slice(0, 8)
      .map(([label]) => ({ label, icon: iconForSection(label) }));
  }, [products]);
  const nextOfferEnd = useMemo(
    () => offers
      .map((product) => product.details?.offer?.endsAt)
      .filter((value): value is string => Boolean(value))
      .sort()[0],
    [offers],
  );

  return (
    <ThemedBackground>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={tokens.link}
            colors={[tokens.link]}
          />
        }
      >
        {offline ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Sem conexão — mostrando o último catálogo salvo.
            </Text>
          </View>
        ) : null}

        <HeroBanner catalogSizeLabel={catalogSizeLabel} />
        {config?.banners?.length ? <BannerCarousel banners={config.banners} /> : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {shortcuts.map((shortcut) => (
            <Pressable
              key={shortcut.label}
              accessibilityRole="button"
              onPress={() => router.navigate({
                pathname: '/(tabs)/catalogo',
                params: { section: shortcut.label },
              })}
              style={styles.category}
            >
              <AppIcon name={shortcut.icon} size={26} color={tokens.link} />
              <Text style={styles.categoryText}>{shortcut.label}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/(tabs)/catalogo')}
            style={styles.category}
          >
            <AppIcon name="grid" size={26} color={tokens.link} />
            <Text style={styles.categoryText}>Ver todos os produtos</Text>
          </Pressable>
        </ScrollView>

        {config?.offers.published && offers.length > 0 ? (
          <ThemedPanel variant="ofertas" style={styles.section}>
            <PanelHeading
              title={copy.offers}
              subtitle="Qualidade e economia para o seu negócio."
              actionLabel="Ver todas as ofertas"
              onAction={() => router.navigate('/(tabs)/ofertas')}
            />
            {nextOfferEnd ? <OfferCountdown endsAt={nextOfferEnd} /> : null}
            <ProductRow products={offers} />
          </ThemedPanel>
        ) : null}

        {config?.newProducts.published && news.length > 0 ? (
          <ThemedPanel style={styles.section}>
            <PanelHeading
              title="Acabaram de chegar"
              subtitle="Novidades para completar seu mix."
              actionLabel="Ver todas as novidades"
              onAction={() => router.navigate('/(tabs)/novidades')}
            />
            <ProductRow products={news} />
          </ThemedPanel>
        ) : null}

        {brands.length > 0 ? (
          <ThemedPanel variant="marcas" style={styles.section}>
            <PanelHeading
              title="Marcas"
              subtitle="Qualidade que você já conhece."
              actionLabel="Ver todas as marcas"
              onAction={() => router.navigate('/(tabs)/marcas')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.brandRow}
            >
              {brands.map((brand) => (
                <Pressable
                  key={brand.name}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver produtos de ${brand.name}`}
                  onPress={() => router.navigate({
                    pathname: '/(tabs)/catalogo',
                    params: { brand: brand.name },
                  })}
                  style={styles.brandCard}
                >
                  {brand.logo ? <CachedImage uri={brand.logo} style={styles.brandLogo} /> : null}
                  <Text style={styles.brandName}>{brand.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </ThemedPanel>
        ) : null}

        <ThemedPanel style={styles.contact}>
          <Text accessibilityRole="header" style={styles.contactTitle}>
            Seja um cliente Laurencini
          </Text>
          <Text style={styles.description}>
            Fale com nossa equipe e conheça as condições para o seu negócio.
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              void Linking.openURL(config?.email ? `mailto:${config.email}` : BASE_URL);
            }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Quero ser cliente</Text>
          </Pressable>
        </ThemedPanel>
      </ScrollView>
    </ThemedBackground>
  );
}

function HeroBanner({ catalogSizeLabel }: { catalogSizeLabel: string }) {
  const { config } = useCatalog();
  const { id, arts, year } = useAppTheme();
  const styles = useHomeStyles();
  const campaign = config?.campaign;
  const configuredArt = id === 'padrao' ? campaignBackground(config) : arts.hero;
  const uri = useLocalImageUri(configuredArt || undefined);
  const [ratio, setRatio] = useState(LOCAL_RATIO);

  useEffect(() => {
    setRatio(LOCAL_RATIO);
    if (!uri) return;
    let active = true;
    Image.getSize(uri, (width, height) => {
      if (active && width > 0 && height > 0) setRatio(width / height);
    }, () => undefined);
    return () => { active = false; };
  }, [uri]);

  const [first, second, third] = splitThemeTitle(
    campaign?.title?.trim() || 'Distribuidora Laurencini | Seu mix completo',
  );

  return (
    <ThemedPanel art={id === 'padrao' ? undefined : arts.hero}>
      <View style={styles.heroText}>
        {campaign?.eyebrow ? <Text style={styles.eyebrow}>{campaign.eyebrow}</Text> : null}
        {id === 'natal' && arts.extras.titulo ? (
          // Natal: título em arte fixa, igual ao esboço aprovado no site.
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
        <Text style={styles.description}>
          {campaign?.description || 'Atacado e distribuição para abastecer o seu negócio.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => router.navigate('/(tabs)/catalogo')}
        >
          <Text style={styles.buttonText}>Explorar catálogo</Text>
        </Pressable>
      </View>

      {/* No celular, a arte inteira vem abaixo do texto, sem faixas fixas. */}
      <Image
        source={uri ? { uri } : LOCAL_HERO}
        style={[styles.heroImage, { aspectRatio: ratio }]}
        resizeMode="contain"
        fadeDuration={0}
        accessible={false}
      />
      <View style={styles.benefits}>
        <Benefit icon="truck" label="Entrega no Norte e na região Serrana do ES" />
        <Benefit icon="cube" label={catalogSizeLabel} />
        <Benefit icon="business" label="Atacado e distribuição para o seu negócio" />
      </View>
    </ThemedPanel>
  );
}

function Benefit({ icon, label }: { icon: AppIconName; label: string }) {
  const styles = useHomeStyles();
  return (
    <View style={styles.benefit}>
      <AppIcon name={icon} size={24} color="#ffffff" />
      <Text style={styles.benefitText}>{label}</Text>
    </View>
  );
}

function OfferCountdown({ endsAt }: { endsAt: string }) {
  const styles = useHomeStyles();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const end = new Date(`${endsAt}T23:59:59`).getTime();
  if (!Number.isFinite(end)) return null;
  const remaining = Math.max(0, end - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor(remaining / 3_600_000) % 24;
  const minutes = Math.floor(remaining / 60_000) % 60;
  const seconds = Math.floor(remaining / 1000) % 60;

  return (
    <Text style={styles.countdown}>
      {remaining > 0
        ? `Termina em ${days} dias, ${hours}h ${minutes}min ${seconds}s`
        : 'Prazo encerrado'}
    </Text>
  );
}
