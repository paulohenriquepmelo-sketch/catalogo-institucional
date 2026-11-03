import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ProductGrid } from '@/components/ProductGrid';
import { PanelHeading, ThemedPanel } from '@/components/ThemedPanel';
import { useCatalog } from '@/lib/catalog-store';
import { activeOffers, newProducts, offerTimeLabel, type Product } from '@/lib/api';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';
import { useAppTheme } from '@/lib/theme-provider';
import { readableColor } from '@/lib/theme-contrast';
import { market } from '@/lib/theme';

type Aba = 'novidades' | 'ofertas';

/** "Ofertas e novidades" do modelo: uma tela com os dois filtros. */
export default function NovidadesScreen() {
  const { config, products, refreshing, refresh } = useCatalog();
  const { tokens, copy } = useAppTheme();
  const params = useLocalSearchParams<{ aba?: string }>();
  const ready = useAfterFirstFrame();
  const [aba, setAba] = useState<Aba>(params.aba === 'ofertas' ? 'ofertas' : 'novidades');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (params.aba === 'ofertas' || params.aba === 'novidades') setAba(params.aba);
  }, [params.aba]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const news = useMemo(
    () => ready
      ? newProducts(products, config?.newProducts.fromCode, config?.newProducts.limit)
      : [],
    [ready, products, config?.newProducts.fromCode, config?.newProducts.limit],
  );
  const offers = useMemo(() => ready ? activeOffers(products) : [], [ready, products]);
  const list = aba === 'ofertas' ? offers : news;

  const styles = useMemo(() => StyleSheet.create({
    filters: { flexDirection: 'row', gap: 6, marginTop: 12 },
    filter: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderRadius: market.radius,
      borderWidth: 1,
      borderColor: '#dddddd',
      backgroundColor: '#ffffff',
    },
    filterOn: { borderColor: tokens.link, backgroundColor: '#eaf0fb' },
    filterText: { fontSize: 12, color: '#666666' },
    filterTextOn: { color: readableColor(tokens.link, '#eaf0fb'), fontWeight: '700' },
    timer: { paddingHorizontal: 10, paddingVertical: 6 },
    timerText: { fontSize: 11, color: readableColor(tokens.link, market.page), fontWeight: '700' },
  }), [tokens]);

  const renderFooter = useCallback((product: Product) => {
    const offer = product.details?.offer;
    if (aba !== 'ofertas' || !offer) return null;
    return (
      <View style={styles.timer}>
        <Text style={styles.timerText}>{offerTimeLabel(offer.endsAt, now)}</Text>
      </View>
    );
  }, [aba, now, styles]);

  const subtitle = !ready
    ? 'Carregando…'
    : aba === 'ofertas'
      ? `${offers.length} ${offers.length === 1 ? 'oferta ativa' : 'ofertas ativas'}`
      : `${news.length} ${news.length === 1 ? 'produto novo' : 'produtos novos'}`;

  return (
    <ProductGrid
      products={list}
      ready={ready}
      refreshing={refreshing}
      onRefresh={refresh}
      resetKey={aba}
      tag={aba === 'novidades' ? 'Novidade' : undefined}
      renderFooter={renderFooter}
      emptyMessage={aba === 'ofertas' ? 'Nenhuma oferta ativa no momento.' : 'Nenhuma novidade no momento.'}
      header={
        <ThemedPanel>
          <PanelHeading
            title={aba === 'ofertas' ? copy.offers : 'Acabaram de chegar'}
            subtitle={subtitle}
          />
          <View style={styles.filters} accessibilityRole="tablist">
            {([['novidades', 'Novidades'], ['ofertas', 'Ofertas']] as const).map(([key, label]) => {
              const on = aba === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => setAba(key)}
                  style={[styles.filter, on && styles.filterOn]}
                >
                  <Text style={[styles.filterText, on && styles.filterTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ThemedPanel>
      }
    />
  );
}
