import { memo, useCallback, useMemo } from 'react';
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
import { CachedImage } from '@/components/CachedImage';
import { ThemedBackground } from '@/components/ThemedBackground';
import { PanelHeading, ThemedPanel } from '@/components/ThemedPanel';
import { useCatalog } from '@/lib/catalog-store';
import { buildSegments, type Segment } from '@/lib/segments';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import { useAppTheme } from '@/lib/theme-provider';
import { radius, spacing, typography } from '@/lib/theme';

export default function SegmentosScreen() {
  const { products, refreshing, refresh } = useCatalog();
  const { width } = useResponsiveLayout();
  const { tokens } = useAppTheme();
  const ready = useAfterFirstFrame();
  const segments = useMemo(() => ready ? buildSegments(products) : [], [ready, products]);
  const cardWidth = Math.max(1, (width - 44) / 2);
  const styles = useMemo(() => StyleSheet.create({
    list: { flex: 1 },
    grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    row: { gap: spacing.md, marginBottom: spacing.md },
    header: { marginHorizontal: -spacing.lg, marginBottom: spacing.lg },
    empty: {
      padding: spacing.xl,
      backgroundColor: tokens.soft,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    emptyText: { ...typography.body, color: tokens.muted },
  }), [tokens]);

  const renderSegment = useCallback<ListRenderItem<Segment>>(
    ({ item }) => <SegmentCard segment={item} width={cardWidth} />,
    [cardWidth],
  );

  return (
    <ThemedBackground>
      <FlatList
        style={styles.list}
        data={segments}
        keyExtractor={(item) => item.rule.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={renderSegment}
        ListHeaderComponent={
          // Mesmo encaixe da grade de produtos: o painel ocupa a largura toda.
          <View style={styles.header}>
            <ThemedPanel variant="segmentos">
              <PanelHeading
                title="Segmentos"
                subtitle="Insumos, embalagens e revenda para cada tipo de negócio."
              />
            </ThemedPanel>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={tokens.link}
            colors={[tokens.link]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {ready
              ? <Text style={styles.emptyText}>Nenhum produto no catálogo ainda.</Text>
              : <ActivityIndicator color={tokens.link} />}
          </View>
        }
      />
    </ThemedBackground>
  );
}

const SegmentCard = memo(function SegmentCard({
  segment,
  width,
}: {
  segment: Segment;
  width: number;
}) {
  const router = useRouter();
  const { tokens } = useAppTheme();

  // A estrutura enviada não informa uma foto própria do segmento.
  // Usamos uma foto real de seu catálogo, mantendo o cache existente.
  const image = useMemo(
    () => segment.products.find((product) => Boolean(product.image))?.image,
    [segment.products],
  );
  const styles = useMemo(() => StyleSheet.create({
    card: {
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.soft,
      padding: spacing.md,
      gap: spacing.sm,
    },
    pressed: { opacity: 0.85 },
    photo: {
      width: '100%',
      aspectRatio: 1.2,
      borderRadius: radius.sm,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: { width: '100%', height: '100%' },
    name: { ...typography.subtitle, color: tokens.ink },
    note: { ...typography.body, color: tokens.muted },
    count: { ...typography.small, color: tokens.link, fontWeight: '700' },
  }), [tokens]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver produtos para ${segment.rule.name}`}
      onPress={() => router.push(`/segmento/${segment.rule.id}`)}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={styles.photo}>
        {image
          ? <CachedImage uri={image} style={styles.image} />
          : <AppIcon name={segment.rule.icon} size={36} color="#526057" />}
      </View>
      <Text style={styles.name}>{segment.rule.name}</Text>
      <Text style={styles.note}>{segment.rule.note}</Text>
      <Text style={styles.count}>
        {segment.products.length} {segment.products.length === 1 ? 'produto' : 'produtos'}
      </Text>
    </Pressable>
  );
});
