import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProductGrid } from '@/components/ProductGrid';
import { PanelHeading, ThemedPanel } from '@/components/ThemedPanel';
import { useCatalog } from '@/lib/catalog-store';
import { activeOffers, offerTimeLabel, type Product } from '@/lib/api';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';
import { useAppTheme } from '@/lib/theme-provider';
import { spacing, typography } from '@/lib/theme';

export default function OfertasScreen() {
  const { products, refreshing, refresh } = useCatalog();
  const { tokens, copy } = useAppTheme();
  const ready = useAfterFirstFrame();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const offers = useMemo(() => ready ? activeOffers(products) : [], [ready, products]);
  const styles = useMemo(() => StyleSheet.create({
    timer: {
      padding: spacing.sm,
      backgroundColor: tokens.soft,
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
    },
    timerText: { ...typography.small, color: tokens.link, fontWeight: '700' },
  }), [tokens]);

  const renderFooter = useCallback((product: Product) => {
    const offer = product.details?.offer;
    if (!offer) return null;
    return (
      <View style={styles.timer}>
        <Text style={styles.timerText}>{offerTimeLabel(offer.endsAt, now)}</Text>
      </View>
    );
  }, [now, styles]);

  return (
    <ProductGrid
      products={offers}
      ready={ready}
      refreshing={refreshing}
      onRefresh={refresh}
      renderFooter={renderFooter}
      emptyMessage="Nenhuma oferta ativa no momento."
      header={
        <ThemedPanel variant="ofertas">
          <PanelHeading
            title={copy.offers}
            subtitle={ready
              ? `${offers.length} ${offers.length === 1 ? 'oferta ativa' : 'ofertas ativas'}`
              : 'Carregando…'}
          />
        </ThemedPanel>
      }
    />
  );
}
