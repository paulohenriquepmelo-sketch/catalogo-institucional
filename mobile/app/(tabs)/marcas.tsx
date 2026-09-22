import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { CachedImage } from '@/components/CachedImage';
import { useCatalog } from '@/lib/catalog-store';
import { publishedBrands } from '@/lib/api';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import { colors, radius, spacing, typography } from '@/lib/theme';

export default function MarcasScreen() {
  const router = useRouter();
  const { config, products, refreshing, refresh } = useCatalog();
  const { columns } = useResponsiveLayout();

  const brands = useMemo(() => {
    const list = publishedBrands(config?.brands ?? []);
    const counts = new Map<string, number>();
    for (const p of products) {
      if (p.published === false) continue;
      counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
    }
    return list
      .map((b) => ({ ...b, count: counts.get(b.name) ?? 0 }))
      .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.name.localeCompare(b.name));
  }, [config?.brands, products]);
  const renderBrand = useCallback<ListRenderItem<(typeof brands)[number]>>(
    ({ item }) => (
      <Pressable
        style={styles.card}
        onPress={() =>
          router.navigate({ pathname: '/(tabs)/catalogo', params: { brand: item.name } })
        }
      >
        {item.logo ? <CachedImage uri={item.logo} style={styles.logo} /> : null}
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.count}>
          {item.count} {item.count === 1 ? 'produto' : 'produtos'}
        </Text>
      </Pressable>
    ),
    [router],
  );
  const renderBatchSize = Math.max(4, columns * 2);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Marcas</Text>
        <Text style={styles.subtitle}>
          {brands.length} {brands.length === 1 ? 'marca parceira' : 'marcas parceiras'}
        </Text>
      </View>
      <FlatList
        key={`marcas-grid-${columns}`}
        data={brands}
        keyExtractor={(item) => item.name}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        initialNumToRender={renderBatchSize}
        maxToRenderPerBatch={renderBatchSize}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={styles.grid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        renderItem={renderBrand}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppIcon name="pricetags" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>Nenhuma marca cadastrada.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { gap: spacing.md, marginBottom: spacing.md },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 118,
  },
  logo: { width: '100%', height: 42 },
  name: { ...typography.body, color: colors.text, textAlign: 'center', fontWeight: '600' },
  count: { ...typography.small, color: colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted },
});
