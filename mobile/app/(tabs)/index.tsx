import { useEffect, useMemo, useState } from 'react';
import { router, useNavigation } from 'expo-router';
import type { NavigationProp, ParamListBase } from 'expo-router/react-navigation';
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { useCatalog } from '@/lib/catalog-store';
import { activeOffers, BASE_URL, newProducts, publishedBrands } from '@/lib/api';
import { useLocalImageUri } from '@/lib/image-cache';
import { radius, spacing, typography } from '@/lib/theme';
import { ProductRow } from '@/components/ProductRow';
import { BannerCarousel } from '@/components/BannerCarousel';
import { CachedImage } from '@/components/CachedImage';
import {
  createThemedStyles,
  THEME_OPTIONS,
  useAppTheme,
  useThemeColors,
  useThemePreview,
} from '@/lib/app-theme';

function normalizeText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Escolhe um ícone coerente para a seção pelo nome dela. Como as seções
// vêm do catálogo publicado (ex.: "1-ALIMENTOS", "1.3-BISCOITOS"), o
// casamento é por palavra-chave, com um ícone genérico como reserva.
function iconForSection(name: string): AppIconName {
  const n = normalizeText(name);
  if (n.includes('bebid')) return 'beer';
  if (n.includes('aliment') || n.includes('merceari') || n.includes('food')) return 'basket';
  if (n.includes('higien')) return 'medkit';
  if (n.includes('limpez') || n.includes('saneant')) return 'spray';
  if (n.includes('perfum') || n.includes('cosmet')) return 'flask';
  if (n.includes('descart') || n.includes('copo')) return 'cafe';
  if (n.includes('biscoit') || n.includes('bomb') || n.includes('doce') || n.includes('choc'))
    return 'cube';
  return 'grid';
}

function countdown(end?: string, now = Date.now()) {
  const endTime = end ? new Date(`${end}T23:59:59`).getTime() : now;
  const remaining = Math.max(0, endTime - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining / 3_600_000) % 24);
  const minutes = Math.floor((remaining / 60_000) % 60);
  const seconds = Math.floor((remaining / 1000) % 60);
  return [days, hours, minutes, seconds].map((value) => String(value).padStart(2, '0'));
}

// Abas pré-carregadas em segundo plano, da mais usada para a menos usada.
const PRELOAD_TABS = ['catalogo', 'segmentos', 'ofertas', 'novidades', 'marcas'] as const;

export default function HomeScreen() {
  const styles = useStyles();
  const colors = useThemeColors();
  const { config, products, refreshing, refresh, offline } = useCatalog();

  // Monta as outras abas em segundo plano, uma de cada vez, depois que o
  // catálogo chegou e a Início já está na tela. Quando o usuário toca numa
  // aba, a lista dela já está pronta e a troca é instantânea.
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const hasProducts = products.length > 0;
  useEffect(() => {
    if (!hasProducts) return;
    const timers = PRELOAD_TABS.map((name, i) =>
      setTimeout(() => navigation.preload(name), 1_200 + i * 500),
    );
    return () => timers.forEach(clearTimeout);
  }, [navigation, hasProducts]);

  const offers = useMemo(
    () => activeOffers(products, config?.offers.limit ?? 12),
    [products, config?.offers.limit],
  );
  const news = useMemo(
    () => newProducts(products, config?.newProducts.days ?? 30, config?.newProducts.limit ?? 12),
    [products, config?.newProducts.days, config?.newProducts.limit],
  );
  const brands = useMemo(
    () => publishedBrands(config?.brands ?? []).slice(0, 10),
    [config?.brands],
  );
  // Imagem do topo: a da campanha do site (ou a arte do tema na prévia).
  const theme = useAppTheme();
  const heroUri = useLocalImageUri(theme.heroImage);
  // Tamanho real do mix, arredondado para baixo na centena ("Mais de 2.500").
  const catalogSizeLabel = useMemo(() => {
    const count = products.filter((product) => product.published !== false).length;
    if (count < 100) return 'Mix completo\npara o seu negócio';
    const rounded = Math.floor(count / 100) * 100;
    // Ponto de milhar sem depender do suporte a idiomas do aparelho.
    return `Mais de ${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}\nprodutos`;
  }, [products]);
  // Atalhos de categoria montados a partir das seções que realmente existem
  // no catálogo (as mais numerosas primeiro). Antes eram nomes fixos no
  // código ("bebidas", "higiene"…) que podiam não existir nos dados — e aí
  // o atalho abria o catálogo sem nenhum resultado.
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
      .map(([name]) => ({ label: name, icon: iconForSection(name) }));
  }, [products]);
  const nextOfferEnd = useMemo(
    () => offers.map((product) => product.details?.offer?.endsAt).filter(Boolean).sort()[0],
    [offers],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
    >
      {offline ? (
        <View style={styles.offlineBanner}>
          <AppIcon name="cloud-offline" size={16} color="#7a5b00" />
          <Text style={styles.offlineText}>Sem conexão — mostrando o último catálogo salvo.</Text>
        </View>
      ) : null}

      {__DEV__ ? <ThemePreviewPicker /> : null}

      {theme.badge ? (
        <View style={styles.themeBadge}>
          <AppIcon name={theme.badge.icon} size={16} color="#fff" />
          <Text style={styles.themeBadgeText}>{theme.badge.label}</Text>
          <AppIcon name={theme.badge.icon} size={16} color="#fff" />
        </View>
      ) : null}

      <HeroBanner uri={heroUri} catalogSizeLabel={catalogSizeLabel} />

      {/* Banners publicados no editor do site — antes o componente existia
          mas não era usado em lugar nenhum, então nada do que era publicado
          como banner chegava a aparecer no app. */}
      {config?.banners?.length ? <BannerCarousel banners={config.banners} /> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {shortcuts.map((shortcut) => (
          <Pressable
            key={shortcut.label}
            onPress={() =>
              router.navigate({
                pathname: '/(tabs)/catalogo',
                params: { section: shortcut.label },
              })
            }
            style={styles.categoryCard}
          >
            <AppIcon name={shortcut.icon} size={28} color={colors.primaryDark} />
            <Text style={styles.categoryLabel} numberOfLines={2}>
              {shortcut.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => router.navigate('/(tabs)/catalogo')}
          style={[styles.categoryCard, styles.categoryCardActive]}
        >
          <AppIcon name="grid" size={28} color={colors.accent} />
          <Text style={[styles.categoryLabel, styles.categoryLabelActive]} numberOfLines={2}>
            Ver tudo
          </Text>
        </Pressable>
      </ScrollView>

      {config?.offers.published && offers.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.offerCallout}>
            <View style={styles.percentSeal}>
              <AppIcon name="percent" size={37} color="#fff" />
            </View>
            <View style={styles.offerCopy}>
              <Text style={styles.offerTitle}>OFERTA DA SEMANA</Text>
              <Text style={styles.offerSubtitle}>Aproveite nossas promoções semanais!</Text>
              <Text style={styles.offerFootnote}>Qualidade e economia para o seu negócio.</Text>
            </View>
            <OfferCountdown endsAt={nextOfferEnd} />
          </View>
          <ProductRow products={offers} />
        </View>
      ) : null}

      {config?.newProducts.published && news.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle
            icon="cube"
            title="NOVIDADES NO CATÁLOGO"
            subtitle="Produtos que acabaram de chegar!"
            badge="NOVO"
            onPress={() => router.navigate('/(tabs)/novidades')}
          />
          <ProductRow products={news} />
        </View>
      ) : null}

      {brands.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle
            icon="handshake"
            title="Marcas parceiras"
            subtitle="Qualidade que você já conhece."
            onPress={() => router.navigate('/(tabs)/marcas')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandRow}>
            {brands.map((brand) => (
              <Pressable
                key={brand.name}
                onPress={() => router.navigate({ pathname: '/(tabs)/catalogo', params: { brand: brand.name } })}
                style={styles.brandCard}
              >
                {brand.logo ? (
                  <CachedImage uri={brand.logo} style={styles.brandLogo} />
                ) : (
                  <Text style={styles.brandFallback} numberOfLines={1}>{brand.name}</Text>
                )}
              </Pressable>
            ))}
            <Pressable onPress={() => router.navigate('/(tabs)/marcas')} style={styles.brandNext}>
              <AppIcon name="chevron-forward" size={24} color={colors.primary} />
            </Pressable>
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.clientBanner}>
        <AppIcon name="business" size={42} color="#fff" />
        <View style={styles.clientCopy}>
          <Text style={styles.clientTitle}>Seja um cliente Laurencini</Text>
          <Text style={styles.clientText}>Condições especiais para atacado.{`\n`}Fale com nossa equipe!</Text>
        </View>
        <Pressable
          onPress={() => Linking.openURL(config?.email ? `mailto:${config.email}` : BASE_URL)}
          style={styles.clientButton}
        >
          <Text style={styles.clientButtonText}>Quero ser cliente</Text>
          <AppIcon name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const LOCAL_HERO = require('../../assets/hero-laurencini.png');
const LOCAL_HERO_SIZE = Image.resolveAssetSource(LOCAL_HERO);

/**
 * Topo da Início: a imagem do site INTEIRA (sem corte), com a frase à
 * direita, sobre o céu, em faixas no mesmo estilo da faixa da própria arte.
 * Os destaques ficam numa faixa logo abaixo, para não cobrir a imagem.
 */
function HeroBanner({ uri, catalogSizeLabel }: { uri?: string; catalogSizeLabel: string }) {
  const styles = useStyles();
  const theme = useAppTheme();
  // Proporção lida da própria imagem: se a campanha mudar, o quadro acompanha.
  const [ratio, setRatio] = useState(3);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!uri) {
      setRatio(LOCAL_HERO_SIZE.width / LOCAL_HERO_SIZE.height);
      return;
    }
    let active = true;
    Image.getSize(
      uri,
      (w, h) => active && h > 0 && setRatio(w / h),
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [uri]);

  // Texto proporcional à largura do quadro (celular, tablet), com limites.
  const centered = theme.heroTextPosition === 'center';
  const fontSize = Math.min(24, Math.max(10, width * (centered ? 0.04 : 0.03)));

  return (
    <View style={styles.heroCard}>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <Image
          source={uri ? { uri } : LOCAL_HERO}
          style={[styles.heroImage, { aspectRatio: ratio }]}
          resizeMode="cover"
          fadeDuration={0}
        />
        {width > 0 ? (
          <View style={centered ? styles.heroCopyCenter : styles.heroCopy} pointerEvents="none">
            <Text style={[styles.heroRibbon, styles.heroRibbonDark, { fontSize }, centered && styles.heroRibbonCenter]}>
              {theme.eyebrow.toUpperCase()}
            </Text>
            <Text style={[
                styles.heroRibbon,
                styles.heroRibbonAccent,
                { fontSize: fontSize * 1.08 },
                centered && styles.heroRibbonCenter,
              ]}>
              {/* No Padrão a quebra de linha é fixa; nos temas, o texto quebra sozinho. */}
              {theme.id === 'padrao' ? 'PARCERIA PARA\nO SEU NEGÓCIO.' : theme.title.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.heroBenefits}>
        <Benefit icon="truck" label={'Entrega no Norte\ne Serrana do ES'} />
        <Benefit icon="cube" label={catalogSizeLabel} />
        <Benefit icon="pricetags" label={'Preço de atacado\npara revenda'} />
      </View>
    </View>
  );
}

/**
 * Seletor de temas SÓ PARA TESTE: aparece apenas no modo de desenvolvimento
 * (Expo Go). No APK final __DEV__ é false e ele não é mostrado.
 */
function ThemePreviewPicker() {
  const styles = useStyles();
  const { preview, setPreview } = useThemePreview();
  return (
    <View style={styles.previewBox}>
      <Text style={styles.previewTitle}>Prévia de temas · só no teste (não vai para o app final)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewChips}>
        <Pressable
          onPress={() => setPreview(null)}
          style={[styles.previewChip, preview === null && styles.previewChipActive]}
        >
          <Text style={[styles.previewChipText, preview === null && styles.previewChipTextActive]}>
            Campanha do site
          </Text>
        </Pressable>
        {THEME_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => setPreview(option.id)}
            style={[styles.previewChip, preview === option.id && styles.previewChipActive]}
          >
            <Text
              style={[styles.previewChipText, preview === option.id && styles.previewChipTextActive]}
            >
              {option.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Benefit({ icon, label }: { icon: AppIconName; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.benefit}>
      <AppIcon name={icon} size={26} color="#fff" />
      <Text style={styles.benefitText}>{label}</Text>
    </View>
  );
}

// O relógio precisa atualizar a cada segundo, mas isolado num componente
// próprio: antes o estado do tempo ficava na Home e re-renderizava a tela
// inteira — hero, banners e as duas listas de produtos — 60 vezes por
// minuto, que era boa parte da lentidão.
function OfferCountdown({ endsAt }: { endsAt?: string }) {
  const styles = useStyles();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [days, hours, minutes, seconds] = countdown(endsAt, now);

  return (
    <View style={styles.timerPanel}>
      <View style={styles.timerIntro}>
        <AppIcon name="alarm" size={21} color="#fff" />
        <Text style={styles.timerIntroText}>Termina em:</Text>
      </View>
      <TimeUnit value={days} label="dias" />
      <TimeUnit value={hours} label="horas" />
      <TimeUnit value={minutes} label="min" />
      <TimeUnit value={seconds} label="seg" />
    </View>
  );
}

function TimeUnit({ value, label }: { value: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.timeUnit}>
      <Text style={styles.timeValue}>{value}</Text>
      <Text style={styles.timeLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
  badge,
  onPress,
}: {
  icon: AppIconName;
  title: string;
  subtitle: string;
  badge?: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const colors = useThemeColors();
  return (
    <View style={styles.sectionTitle}>
      <AppIcon name={icon} size={29} color={colors.primary} />
      <View style={styles.sectionTitleCopy}>
        <View style={styles.sectionTitleLine}>
          <Text style={styles.sectionHeading}>{title}</Text>
          {badge ? <Text style={styles.newBadge}>{badge}</Text> : null}
        </View>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <Pressable onPress={onPress} hitSlop={8} style={styles.seeAll}>
        <Text style={styles.seeAllText}>Ver todas</Text>
        <AppIcon name="chevron-forward" size={18} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: '#f6f9fd' },
  content: { paddingBottom: spacing.xl },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: '#fff3cd', padding: spacing.sm, paddingHorizontal: spacing.lg,
  },
  offlineText: { ...typography.small, color: '#7a5b00', flex: 1 },
  themeBadge: {
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  themeBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  previewBox: {
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.warning,
    backgroundColor: '#fffbea',
    gap: 6,
  },
  previewTitle: { color: '#7a5b00', fontSize: 11, fontWeight: '700' },
  previewChips: { gap: 6 },
  previewChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  previewChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  previewChipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  previewChipTextActive: { color: '#fff' },
  heroCard: {
    margin: spacing.sm,
    marginBottom: 6,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.primaryDark,
  },
  heroImage: { width: '100%' },
  // Canto superior direito: é céu nas duas artes (site e app).
  heroCopy: {
    position: 'absolute',
    top: '7%',
    right: '3%',
    width: '46%',
    alignItems: 'flex-end',
    gap: 4,
  },
  // Artes de tema: enfeites nas laterais, frase no meio.
  heroCopyCenter: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '14%',
    right: '14%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroRibbon: {
    color: '#fff',
    fontWeight: '900',
    textAlign: 'right',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  heroRibbonCenter: { textAlign: 'center' },
  heroRibbonDark: { backgroundColor: colors.primaryDark },
  heroRibbonAccent: { backgroundColor: colors.accent },
  heroBenefits: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs,
  },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '32%' },
  benefitText: { color: '#fff', fontSize: 10, lineHeight: 13, fontWeight: '600' },
  categories: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: spacing.sm },
  categoryCard: {
    width: 88, height: 92, borderRadius: radius.md, borderWidth: 1,
    borderColor: '#e2eaf4', backgroundColor: '#fff', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: 6,
  },
  categoryCardActive: { borderColor: colors.accent, borderWidth: 1.5 },
  categoryLabel: { color: colors.primaryDark, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  categoryLabelActive: { color: colors.accent },
  section: { marginBottom: spacing.md },
  offerCallout: {
    marginHorizontal: spacing.sm, marginBottom: spacing.sm, padding: spacing.sm,
    borderRadius: radius.md, backgroundColor: colors.soft, flexDirection: 'row',
    alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap',
  },
  percentSeal: {
    width: 58, height: 58, borderRadius: 18, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }],
  },
  offerCopy: { flex: 1, minWidth: 190 },
  offerTitle: { color: colors.accent, fontSize: 20, fontWeight: '900' },
  offerSubtitle: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  offerFootnote: { color: '#60708d', fontSize: 11, marginTop: 2 },
  timerPanel: {
    flexGrow: 1, minWidth: 300, minHeight: 68, borderRadius: radius.md,
    backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-around', paddingHorizontal: spacing.sm,
  },
  timerIntro: { alignItems: 'center', marginRight: 4 },
  timerIntroText: { color: '#fff', fontSize: 9, marginTop: 2 },
  timeUnit: { alignItems: 'center' },
  timeValue: {
    minWidth: 39, paddingVertical: 5, borderRadius: 6, overflow: 'hidden',
    backgroundColor: '#fff', color: colors.accent, fontSize: 20, fontWeight: '900', textAlign: 'center',
  },
  timeLabel: { color: '#fff', fontSize: 9, marginTop: 2 },
  sectionTitle: {
    minHeight: 66, marginHorizontal: spacing.sm, marginBottom: spacing.sm,
    borderRadius: radius.md, backgroundColor: colors.soft, flexDirection: 'row',
    alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md,
  },
  sectionTitleCopy: { flex: 1 },
  sectionTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionHeading: { color: colors.primaryDark, fontSize: 16, fontWeight: '900' },
  sectionSubtitle: { color: '#587092', fontSize: 11, marginTop: 2 },
  newBadge: {
    color: '#fff', backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingHorizontal: 9, paddingVertical: 2, fontSize: 9, fontWeight: '800', overflow: 'hidden',
  },
  seeAll: { flexDirection: 'row', alignItems: 'center' },
  seeAllText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  brandRow: { paddingHorizontal: spacing.sm, gap: spacing.sm, alignItems: 'center' },
  brandCard: {
    width: 104, height: 68, borderRadius: radius.md, borderWidth: 1,
    borderColor: '#e0e8f2', backgroundColor: '#fff', padding: spacing.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  brandLogo: { width: '100%', height: '100%' },
  brandFallback: { color: colors.primary, fontWeight: '800', textAlign: 'center' },
  brandNext: {
    width: 50, height: 68, borderRadius: 25, backgroundColor: colors.soft,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.xs,
  },
  clientBanner: {
    marginHorizontal: spacing.sm, marginTop: spacing.sm, padding: spacing.lg,
    borderRadius: radius.md, backgroundColor: colors.header, flexDirection: 'row',
    alignItems: 'center', gap: spacing.md, flexWrap: 'wrap',
  },
  clientCopy: { flex: 1, minWidth: 180 },
  clientTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  clientText: { color: 'rgba(255,255,255,0.86)', fontSize: 11, lineHeight: 15, marginTop: 3 },
  clientButton: {
    minHeight: 42, borderWidth: 1, borderColor: '#fff', borderRadius: radius.sm,
    paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  clientButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
}));
