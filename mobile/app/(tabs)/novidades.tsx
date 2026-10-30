import { useMemo } from 'react';
import { ProductGrid } from '@/components/ProductGrid';
import { PanelHeading, ThemedPanel } from '@/components/ThemedPanel';
import { useCatalog } from '@/lib/catalog-store';
import { newProducts } from '@/lib/api';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';

export default function NovidadesScreen() {
  const { config, products, refreshing, refresh } = useCatalog();
  const ready = useAfterFirstFrame();
  const news = useMemo(
    () => ready
      ? newProducts(products, config?.newProducts.fromCode, config?.newProducts.limit)
      : [],
    [ready, products, config?.newProducts.fromCode, config?.newProducts.limit],
  );

  return (
    <ProductGrid
      products={news}
      ready={ready}
      refreshing={refreshing}
      onRefresh={refresh}
      emptyMessage="Nenhuma novidade no momento."
      header={
        <ThemedPanel>
          <PanelHeading
            title="Acabaram de chegar"
            subtitle={ready
              ? `${news.length} ${news.length === 1 ? 'produto novo' : 'produtos novos'}`
              : 'Carregando…'}
          />
        </ThemedPanel>
      }
    />
  );
}
