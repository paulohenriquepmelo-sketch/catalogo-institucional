import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { activeOffers, offerTimeLabel } from '@/lib/api';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import { spacing, typography } from '@/lib/theme';
import { ProductCard } from '@/components/ProductCard';
import { createThemedStyles, useThemeColors } from '@/lib/app-theme';

export default function OfertasScreen() {
  const styles = useStyles();
  const colors = useThemeColors();
  const { config, products, refreshing, refresh } = useCatalog();
  const { columns } = useResponsiveLayout();
  const ready = useAfterFirstFrame();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const offers = useMemo(() => (ready ? activeOffers(products) : []), [ready, products]);
  const renderOffer = useCallback<ListRenderItem<(typeof offers)[number]>>(
    ({ item }) => (
      <View style={styles.gridItem}>
        <ProductCard product={item} style={styles.cardFill} />
        <View style={styles.timer}>
          <AppIcon name="time" size={12} color={colors.accent} />
          <Text style={styles.timerText}>
            {offerTimeLabel(item.details!.offer!.endsAt, now)}
          </Text>
        </View>
      </View>
    ),
    [now, styles, colors],
  );
  const renderBatchSize = Math.max(4, columns * 2);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{config?.offers.title ?? 'Ofertas'}</Text>
        <Text style={styles.subtitle}>
          {ready
            ? `${offers.length} ${offers.length === 1 ? 'oferta ativa' : 'ofertas ativas'}`
            : 'Carregando…'}
        </Text>
      </View>
      <FlatList
        key={`ofertas-grid-${columns}`}
        data={offers}
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
        renderItem={renderOffer}
        ListEmptyComponent={
          ready ? (
            <View style={styles.empty}>
              <AppIcon name="pricetag" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nenhuma oferta ativa no momento.</Text>
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

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { gap: spacing.md, marginBottom: spacing.md },
  gridItem: { flex: 1 },
  cardFill: { width: '100%' },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  timerText: { ...typography.small, color: colors.accent, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted },
}));
