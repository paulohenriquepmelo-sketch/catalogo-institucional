import { useCallback, useMemo, type ReactNode } from 'react';
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
import { ProductCard } from '@/components/ProductCard';
import { ThemedBackground } from '@/components/ThemedBackground';
import { useAppTheme } from '@/lib/theme-provider';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import { spacing, typography } from '@/lib/theme';
import type { Product } from '@/lib/api';

export function ProductGrid({
  products,
  ready,
  header,
  emptyMessage,
  emptyAction,
  refreshing = false,
  onRefresh,
  renderFooter,
  resetKey = 'produtos',
}: {
  products: Product[];
  ready: boolean;
  header?: ReactNode;
  emptyMessage: string;
  emptyAction?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  renderFooter?: (product: Product) => ReactNode;
  resetKey?: string;
}) {
  const { tokens } = useAppTheme();
  const { columns, width } = useResponsiveLayout();
  const cellWidth = Math.max(1, (width - 32 - (columns - 1) * 12) / columns);
  const styles = useMemo(() => StyleSheet.create({
    list: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    row: { gap: spacing.md },
    item: { marginBottom: spacing.md },
    card: { width: '100%' },
    header: { marginHorizontal: -spacing.lg, marginBottom: spacing.lg },
    empty: {
      padding: spacing.xl,
      gap: spacing.md,
      alignItems: 'center',
      backgroundColor: tokens.soft,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tokens.border,
    },
    emptyText: { ...typography.body, color: tokens.muted, textAlign: 'center' },
  }), [tokens]);

  const renderProduct = useCallback<ListRenderItem<Product>>(
    ({ item }) => (
      <View style={[styles.item, { width: cellWidth }]}>
        <ProductCard product={item} style={styles.card} />
        {renderFooter?.(item)}
      </View>
    ),
    [cellWidth, renderFooter, styles],
  );

  const batch = Math.max(4, columns * 2);

  return (
    <ThemedBackground>
      <FlatList
        key={`${resetKey}-${columns}`}
        style={styles.list}
        data={products}
        numColumns={columns}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderProduct}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={batch}
        maxToRenderPerBatch={batch}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={header ? <View style={styles.header}>{header}</View> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            {ready ? (
              <>
                <Text style={styles.emptyText}>{emptyMessage}</Text>
                {emptyAction}
              </>
            ) : <ActivityIndicator color={tokens.link} />}
          </View>
        }
        refreshControl={onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.link}
            colors={[tokens.link]}
          />
        ) : undefined}
      />
    </ThemedBackground>
  );
}
