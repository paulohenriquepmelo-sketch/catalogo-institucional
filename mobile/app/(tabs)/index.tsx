import { useEffect, useMemo, useState } from 'react';
import { router, useNavigation } from 'expo-router';
import type { NavigationProp, ParamListBase } from 'expo-router/react-navigation';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { BrandMarquee } from '@/components/BrandMarquee';
import { ProductCard } from '@/components/ProductCard';
import { PromoStrip } from '@/components/PromoStrip';
import { ThemedBackground } from '@/components/ThemedBackground';
import { PanelHeading, ThemedPanel, usePanelSurface } from '@/components/ThemedPanel';
import { useCatalog } from '@/lib/catalog-store';
import {
  activeOffers,
  BASE_URL,
  newProducts,
  publishedBrands,
  type Product,
} from '@/lib/api';
import { useAppTheme } from '@/lib/theme-provider';
import { readableColor } from '@/lib/theme-contrast';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import { market } from '@/lib/theme';

const PRELOAD_TABS = ['catalogo', 'segmentos', 'novidades', 'marcas'] as const;
const GUTTER = 15;
const HIGHLIGHTS = 8;

type Filtro = 'todos' | 'novidades' | 'ofertas';

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
  if (/biscoit|bomb|doce|choc/.test(normalized)) return 'candy';
  return 'grid';
}

export default function HomeScreen() {
  const { config, products, refreshing, refresh, offline } = useCatalog();
  const { id, tokens } = useAppTheme();
  const { width, columns } = useResponsiveLayout();
  const surface = usePanelSurface();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const hasProducts = products.length > 0;
  const inner = width - GUTTER * 2;

  useEffect(() => {
    if (!hasProducts) return;
    const timers = PRELOAD_TABS.map((name, index) =>
      setTimeout(() => navigation.preload(name), 1_200 + index * 500),
    );
    return () => timers.forEach(clearTimeout);
  }, [navigation, hasProducts]);

  const offers = useMemo(
    () => config?.offers.published ? activeOffers(products, config.offers.limit ?? 12) : [],
    [products, config?.offers.published, config?.offers.limit],
  );
  const news = useMemo(
    () => config?.newProducts.published
      ? newProducts(products, config.newProducts.fromCode, config.newProducts.limit ?? 12)
      : [],
    [products, config?.newProducts.published, config?.newProducts.fromCode, config?.newProducts.limit],
  );
  const newIds = useMemo(() => new Set(news.map((product) => product.id)), [news]);
  const highlights = useMemo(() => {
    if (filtro === 'ofertas') return offers.slice(0, HIGHLIGHTS);
    if (filtro === 'novidades') return news.slice(0, HIGHLIGHTS);
    // "Todos" intercala ofertas e novidades, sem repetir produto.
    const mixed: Product[] = [];
    const seen = new Set<Product['id']>();
    for (let index = 0; mixed.length < HIGHLIGHTS && (index < offers.length || index < news.length); index++) {
      for (const product of [offers[index], news[index]]) {
        if (product && !seen.has(product.id) && mixed.length < HIGHLIGHTS) {
          seen.add(product.id);
          mixed.push(product);
        }
      }
    }
    return mixed;
  }, [filtro, offers, news]);
  const filtros = useMemo(() => {
    const list: [Filtro, string][] = [['todos', 'Todos']];
    if (news.length) list.push(['novidades', 'Novidades']);
    if (offers.length) list.push(['ofertas', 'Ofertas']);
    return list;
  }, [news.length, offers.length]);
  const brands = useMemo(
    () => publishedBrands(config?.brands ?? []).slice(0, 14),
    [config?.brands],
  );
  const shortcuts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      if (product.published === false) continue;
      const section = product.section?.trim();
      if (section) counts.set(section, (counts.get(section) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .slice(0, 6)
      .map(([label]) => ({ label, icon: iconForSection(label) }));
  }, [products]);

  const catWidth = (inner - 7 * 2) / 3;
  const cardWidth = (inner - 24 - (columns - 1) * 8) / columns;
  // Texto solto sobre a página: no tema escuro o fundo é tokens.paper.
  const page = id === 'padrao' ? market.page : tokens.paper;
  const muted = readableColor('#777777', page);
  const pageInk = readableColor('#333333', page);
  const link = readableColor(tokens.link, surface);

  const styles = useMemo(() => StyleSheet.create({
    scroll: { flex: 1 },
    content: { paddingHorizontal: GUTTER, paddingTop: 13, paddingBottom: 28 },
    notice: {
      padding: 10,
      marginBottom: 12,
      borderRadius: market.radius,
      backgroundColor: '#fff4e5',
    },
    noticeText: { fontSize: 13, color: '#5c3b00' },
    crumbs: { fontSize: 12, color: muted, marginBottom: 14 },
    welcome: { marginBottom: 14 },
    h1: { fontSize: 19, fontWeight: '700', color: pageInk, marginBottom: 4 },
    lead: { fontSize: 13, color: muted },
    cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
    cat: {
      width: catWidth,
      minHeight: 74,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: 6,
      borderRadius: market.radius,
      backgroundColor: surface,
      shadowColor: '#000000',
      shadowOpacity: 0.05,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    catText: {
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
      color: readableColor('#444444', surface),
    },
    panel: { marginBottom: 14 },
    sort: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 10,
      borderRadius: market.radius,
      borderWidth: 1,
      borderColor: '#dddddd',
    },
    sortText: { fontSize: 11, color: readableColor('#555555', surface) },
    toolbar: {
      marginTop: 12,
      marginBottom: 12,
      paddingVertical: 10,
      gap: 8,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#f0f0f0',
    },
    count: { fontSize: 11, color: readableColor('#555555', surface) },
    countSoft: { color: readableColor('#999999', surface) },
    filters: { flexDirection: 'row', gap: 5 },
    filter: {
      minHeight: 34,
      justifyContent: 'center',
      paddingHorizontal: 11,
      borderRadius: market.radius,
      borderWidth: 1,
      borderColor: '#dddddd',
      backgroundColor: surface,
    },
    filterOn: { borderColor: tokens.link, backgroundColor: '#eaf0fb' },
    filterText: { fontSize: 11, color: readableColor('#666666', surface) },
    filterTextOn: { color: readableColor(tokens.link, '#eaf0fb'), fontWeight: '700' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    empty: { fontSize: 13, color: readableColor('#78827d', surface), paddingVertical: 8 },
    contact: { marginBottom: 18, gap: 12 },
    contactTitle: { fontSize: 14, fontWeight: '700', color: readableColor('#333333', surface) },
    contactText: { fontSize: 12, color: readableColor('#888888', surface), marginTop: 4 },
    contactButton: {
      alignSelf: 'flex-start',
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: market.radius,
      backgroundColor: tokens.dark,
    },
    contactButtonText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
    footer: { gap: 5 },
    footerText: { fontSize: 11, color: muted },
  }), [tokens, surface, catWidth, muted, pageInk]);

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

        <Text style={styles.crumbs}>Início   ›   Catálogo</Text>
        <View style={styles.welcome}>
          <Text accessibilityRole="header" style={styles.h1}>Encontre o que sua loja precisa</Text>
          <Text style={styles.lead}>Navegue por segmentos, marcas e novidades do nosso catálogo.</Text>
        </View>

        <PromoStrip width={inner} />

        {shortcuts.length ? (
          <View style={styles.cats}>
            {shortcuts.map((shortcut) => (
              <Pressable
                key={shortcut.label}
                accessibilityRole="button"
                accessibilityLabel={`Ver produtos de ${shortcut.label}`}
                onPress={() => router.navigate({
                  pathname: '/(tabs)/catalogo',
                  params: { section: shortcut.label },
                })}
                style={styles.cat}
              >
                <AppIcon name={shortcut.icon} size={24} color={link} />
                <Text style={styles.catText} numberOfLines={2}>
                  {shortcut.label.replace(/^\d+\s*-\s*/, '')}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {highlights.length || filtro !== 'todos' ? (
          <ThemedPanel style={styles.panel}>
            <View>
              <PanelHeading
                title="Produtos em destaque"
                subtitle="Confira alguns itens selecionados do catálogo"
              />
            </View>
            <View style={styles.toolbar}>
              <Text style={styles.count}>
                Produtos para conhecer <Text style={styles.countSoft}>· sem exibição de preços</Text>
              </Text>
              <View style={styles.filters} accessibilityRole="tablist">
                {filtros.map(([key, label]) => {
                  const on = filtro === key;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      onPress={() => setFiltro(key)}
                      style={[styles.filter, on && styles.filterOn]}
                    >
                      <Text style={[styles.filterText, on && styles.filterTextOn]}>{label}</Text>
                    </Pressable>
                  );
                })}
                <View style={{ flex: 1 }} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.navigate('/(tabs)/catalogo')}
                  style={styles.sort}
                >
                  <Text style={styles.sortText}>Ver catálogo</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.grid}>
              {highlights.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  width={cardWidth}
                  tag={newIds.has(product.id) ? 'Novidade' : 'Destaque'}
                />
              ))}
            </View>
            {!highlights.length ? <Text style={styles.empty}>Nada neste filtro no momento.</Text> : null}
          </ThemedPanel>
        ) : null}

        {brands.length > 0 ? (
          <ThemedPanel style={styles.panel}>
            <PanelHeading
              title="Marcas parceiras"
              subtitle="Qualidade e confiança para o seu negócio"
              actionLabel="Ver todas"
              onAction={() => router.navigate('/(tabs)/marcas')}
            />
            <BrandMarquee brands={brands} />
          </ThemedPanel>
        ) : null}

        <ThemedPanel style={styles.contact}>
          <View>
            <Text accessibilityRole="header" style={styles.contactTitle}>
              Quer saber mais sobre algum produto?
            </Text>
            <Text style={styles.contactText}>
              Fale com nossa equipe comercial para consultar disponibilidade.
            </Text>
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              void Linking.openURL(config?.email ? `mailto:${config.email}` : BASE_URL);
            }}
            style={styles.contactButton}
          >
            <Text style={styles.contactButtonText}>Falar com consultor  ↗</Text>
          </Pressable>
        </ThemedPanel>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© {new Date().getFullYear()} Distribuidora Laurencini</Text>
          <Text style={styles.footerText}>Catálogo institucional para clientes e parceiros</Text>
        </View>
      </ScrollView>
    </ThemedBackground>
  );
}
