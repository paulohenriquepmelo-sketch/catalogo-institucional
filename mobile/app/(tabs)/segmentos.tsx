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
import { AppIcon } from '@/components/AppIcon';
import { useCatalog } from '@/lib/catalog-store';
import { buildSegments, type Segment } from '@/lib/segments';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import { radius, spacing, typography } from '@/lib/theme';
import { createThemedStyles, useThemeColors } from '@/lib/app-theme';

export default function SegmentosScreen() {
  const styles = useStyles();
  const colors = useThemeColors();
  const router = useRouter();
  const { products, refreshing, refresh } = useCatalog();
  const { columns } = useResponsiveLayout();
  // Classificar o catálogo inteiro leva um instante: o topo aparece primeiro.
  const ready = useAfterFirstFrame();

  const segments = useMemo(
    // Coleções de data (ex.: Natal) abrem pelo atalho do tema, não por aqui.
    () => (ready ? buildSegments(products).filter((segment) => !segment.rule.hidden) : []),
    [ready, products],
  );

  const renderSegment = useCallback<ListRenderItem<Segment>>(
    ({ item }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver produtos para ${item.rule.name}`}
        onPress={() => router.push(`/segmento/${item.rule.id}`)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.iconWrap}>
          <AppIcon name={item.rule.icon} size={24} color={colors.primary} />
        </View>
        <Text style={styles.name} numberOfLines={2}>{item.rule.name}</Text>
        <Text style={styles.note} numberOfLines={2}>{item.rule.note}</Text>
        <View style={styles.footer}>
          <Text style={styles.count}>
            {item.products.length} {item.products.length === 1 ? 'produto' : 'produtos'}
          </Text>
          <AppIcon name="arrow-forward" size={14} color={colors.accent} />
        </View>
      </Pressable>
    ),
    [router, styles, colors],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Segmentos</Text>
        <Text style={styles.subtitle}>
          Tudo o que cada tipo de negócio precisa: insumos, embalagens e revenda
        </Text>
      </View>
      <FlatList
        key={`segmentos-grid-${columns}`}
        data={segments}
        keyExtractor={(item) => item.rule.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        initialNumToRender={8}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={styles.grid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        renderItem={renderSegment}
        ListEmptyComponent={
          <View style={styles.empty}>
            {ready ? (
              <Text style={styles.emptyText}>Nenhum produto no catálogo ainda.</Text>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </View>
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
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 168,
  },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  name: { ...typography.body, color: colors.text, fontWeight: '700' },
  note: { ...typography.small, color: colors.textMuted, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { ...typography.small, color: colors.accent, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted },
}));
