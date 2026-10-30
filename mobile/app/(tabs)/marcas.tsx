import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { CachedImage } from '@/components/CachedImage';
import { ThemedBackground } from '@/components/ThemedBackground';
import { PanelHeading, ThemedPanel } from '@/components/ThemedPanel';
import { useCatalog } from '@/lib/catalog-store';
import { publishedBrands } from '@/lib/api';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import { useAppTheme } from '@/lib/theme-provider';
import { radius, spacing, typography } from '@/lib/theme';

export default function MarcasScreen() {
  const router = useRouter();
  const { config, products, refreshing, refresh } = useCatalog();
  const { columns, width } = useResponsiveLayout();
  const { tokens } = useAppTheme();
  const ready = useAfterFirstFrame();
  const cardWidth = Math.max(1, (width - 32 - (columns - 1) * 12) / columns);

  const brands = useMemo(() => {
    if (!ready) return [];
    const counts = new Map<string, number>();
    for (const product of products) {
      if (product.published === false) continue;
      counts.set(product.brand, (counts.get(product.brand) ?? 0) + 1);
    }
    return publishedBrands(config?.brands ?? [])
      .map((brand) => ({ ...brand, count: counts.get(brand.name) ?? 0 }))
      .sort((a, b) =>
        (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.name.localeCompare(b.name),
      );
  }, [ready, config?.brands, products]);

  const styles = useMemo(() => StyleSheet.create({
    list: { flex: 1 },
    grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    row: { gap: spacing.md },
    header: { marginHorizontal: -spacing.lg, marginBottom: spacing.lg },
    card: {
      marginBottom: spacing.md,
      minHeight: 140,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.soft,
      padding: spacing.md,
      alignItems: 'center',
      gap: spacing.sm,
    },
    logo: { width: '100%', height: 64, backgroundColor: '#ffffff' },
    name: { ...typography.body, color: tokens.ink, textAlign: 'center', fontWeight: '700' },
    count: { ...typography.small, color: tokens.muted, textAlign: 'center' },
    empty: {
      padding: spacing.xl,
      backgroundColor: tokens.soft,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    emptyText: { ...typography.body, color: tokens.muted },
  }), [tokens]);

  const renderBrand = useCallback<ListRenderItem<(typeof brands)[number]>>(
    ({ item }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver produtos de ${item.name}`}
        style={[styles.card, { width: cardWidth }]}
        onPress={() => router.navigate({
          pathname: '/(tabs)/catalogo',
          params: { brand: item.name },
        })}
      >
        {item.logo ? <CachedImage uri={item.logo} style={styles.logo} /> : null}
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.count}>
          {item.count} {item.count === 1 ? 'produto' : 'produtos'}
        </Text>
      </Pressable>
    ),
    [router, styles, cardWidth],
  );

  const batch = Math.max(4, columns * 2);
  return (
    <ThemedBackground>
      <FlatList
        key={`marcas-${columns}`}
        style={styles.list}
        data={brands}
        keyExtractor={(item) => item.name}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.grid}
        initialNumToRender={batch}
        maxToRenderPerBatch={batch}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={renderBrand}
        ListHeaderComponent={
          <ThemedPanel variant="marcas" style={styles.header}>
            <PanelHeading
              title="Marcas"
              subtitle={ready
                ? `${brands.length} ${brands.length === 1 ? 'marca parceira' : 'marcas parceiras'}`
                : 'Carregando…'}
            />
          </ThemedPanel>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={tokens.link}
            colors={[tokens.link]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {ready
              ? <Text style={styles.emptyText}>Nenhuma marca cadastrada.</Text>
              : <ActivityIndicator color={tokens.link} />}
          </View>
        }
      />
    </ThemedBackground>
  );
}
