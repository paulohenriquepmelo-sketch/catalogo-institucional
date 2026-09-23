import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { useCatalog } from '@/lib/catalog-store';
import { newProducts } from '@/lib/api';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import { colors, spacing, typography } from '@/lib/theme';
import { ProductCard } from '@/components/ProductCard';

export default function NovidadesScreen() {
  const { config, products, refreshing, refresh } = useCatalog();
  const { columns } = useResponsiveLayout();
  const ready = useAfterFirstFrame();

  const news = useMemo(
    () => (ready ? newProducts(products, config?.newProducts.days ?? 30) : []),
    [ready, products, config?.newProducts.days],
  );
  const renderProduct = useCallback<ListRenderItem<(typeof news)[number]>>(
    ({ item }) => (
      <View style={styles.gridItem}>
        <ProductCard product={item} style={styles.cardFill} />
      </View>
    ),
    [],
  );
  const renderBatchSize = Math.max(4, columns * 2);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{config?.newProducts.title ?? 'Novidades'}</Text>
        <Text style={styles.subtitle}>
          {ready
            ? `${news.length} ${news.length === 1 ? 'produto novo' : 'produtos novos'}`
            : 'Carregando…'}
        </Text>
      </View>
      <FlatList
        key={`novidades-grid-${columns}`}
        data={news}
        keyExtractor={(item) => String(item.id)}
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
        renderItem={renderProduct}
        ListEmptyComponent={
          ready ? (
            <View style={styles.empty}>
              <AppIcon name="sparkles" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nenhuma novidade no momento.</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )
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
  gridItem: { flex: 1 },
  cardFill: { width: '100%' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted },
});
