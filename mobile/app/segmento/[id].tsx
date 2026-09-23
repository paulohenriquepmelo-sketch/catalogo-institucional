import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { ProductCard } from '@/components/ProductCard';
import { useCatalog } from '@/lib/catalog-store';
import { buildSegments } from '@/lib/segments';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import { radius, spacing, typography } from '@/lib/theme';
import type { Product } from '@/lib/api';
import { createThemedStyles, useThemeColors } from '@/lib/app-theme';

const ALL = -1;

export default function SegmentoScreen() {
  const styles = useStyles();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products } = useCatalog();
  const { columns } = useResponsiveLayout();
  // Vindo da aba Segmentos o cálculo já está pronto (fica em cache); aberto
  // direto, ele roda no quadro seguinte para a tela aparecer na hora.
  const ready = useAfterFirstFrame();
  const [groupIndex, setGroupIndex] = useState(ALL);

  const segment = useMemo(
    () => (ready ? buildSegments(products).find((s) => s.rule.id === id) : undefined),
    [ready, products, id],
  );
  const visible = useMemo(() => {
    if (!segment) return [];
    return groupIndex === ALL ? segment.products : segment.groups[groupIndex]?.products ?? [];
  }, [segment, groupIndex]);

  const renderProduct = useCallback<ListRenderItem<Product>>(
    ({ item }) => (
      <View style={styles.gridItem}>
        <ProductCard product={item} style={styles.cardFill} />
      </View>
    ),
    [styles],
  );
  const renderBatchSize = Math.max(4, columns * 2);

  if (ready && !segment) {
    return (
      <View style={styles.notFound}>
        <AppIcon name="circle-alert" size={32} color={colors.textMuted} />
        <Text style={styles.emptyText}>Segmento não encontrado.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        // Trocar de grupo volta a lista para o topo.
        key={`segmento-${id}-${groupIndex}-${columns}`}
        data={visible}
        keyExtractor={(item) => String(item.id)}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        initialNumToRender={renderBatchSize}
        maxToRenderPerBatch={renderBatchSize}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={styles.grid}
        renderItem={renderProduct}
        ListHeaderComponent={
          segment ? (
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={styles.iconWrap}>
                  <AppIcon name={segment.rule.icon} size={24} color={colors.primary} />
                </View>
                <View style={styles.titleText}>
                  <Text style={styles.title}>{segment.rule.name}</Text>
                  <Text style={styles.subtitle}>
                    {segment.rule.note} · {segment.products.length} produtos
                  </Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                <Chip
                  label={`Todos (${segment.products.length})`}
                  active={groupIndex === ALL}
                  onPress={() => setGroupIndex(ALL)}
                />
                {segment.groups.map((group, index) => (
                  <Chip
                    key={group.name}
                    label={`${group.name} (${group.products.length})`}
                    active={groupIndex === index}
                    onPress={() => setGroupIndex(index)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {ready ? (
              <Text style={styles.emptyText}>Nenhum produto neste grupo.</Text>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </View>
        }
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { gap: spacing.md, marginBottom: spacing.md },
  gridItem: { flex: 1 },
  cardFill: { width: '100%' },
  header: { paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.small, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.textOnPrimary },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
}));
