import { useCallback } from 'react';
import { FlatList, StyleSheet, type ListRenderItem } from 'react-native';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import type { Product } from '@/lib/api';
import { ProductCard } from './ProductCard';

export function ProductRow({ products }: { products: Product[] }) {
  const { cardWidth, spacing: adaptiveSpacing } = useResponsiveLayout();
  const renderProduct = useCallback<ListRenderItem<Product>>(
    ({ item }) => <ProductCard product={item} width={cardWidth} />,
    [cardWidth],
  );

  return (
    <FlatList
      data={products}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => String(item.id)}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      updateCellsBatchingPeriod={80}
      windowSize={5}
      removeClippedSubviews
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: adaptiveSpacing.lg, gap: adaptiveSpacing.md },
      ]}
      renderItem={renderProduct}
    />
  );
}

const styles = StyleSheet.create({
  content: {},
});
