import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProductGrid } from '@/components/ProductGrid';
import { PanelHeading, ThemedPanel } from '@/components/ThemedPanel';
import { useCatalog } from '@/lib/catalog-store';
import { buildSegments } from '@/lib/segments';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';
import { useAppTheme } from '@/lib/theme-provider';
import { readableColor } from '@/lib/theme-contrast';
import { radius, spacing, typography } from '@/lib/theme';

const ALL = -1;

export default function SegmentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products } = useCatalog();
  const { tokens } = useAppTheme();
  const ready = useAfterFirstFrame();
  const [groupIndex, setGroupIndex] = useState(ALL);

  useEffect(() => setGroupIndex(ALL), [id]);

  const segment = useMemo(
    () => ready ? buildSegments(products).find((item) => item.rule.id === id) : undefined,
    [ready, products, id],
  );
  const visible = useMemo(() => {
    if (!segment) return [];
    return groupIndex === ALL ? segment.products : segment.groups[groupIndex]?.products ?? [];
  }, [segment, groupIndex]);

  const styles = useMemo(() => StyleSheet.create({
    filters: { padding: spacing.lg, backgroundColor: tokens.soft },
    chips: { gap: spacing.sm },
    chip: {
      minHeight: 44,
      minWidth: 44,
      maxWidth: 300,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.soft,
    },
    active: { backgroundColor: tokens.accent, borderColor: tokens.accent },
    text: { ...typography.body, color: tokens.ink },
    activeText: { color: readableColor(tokens.onAccent, tokens.accent), fontWeight: '700' },
  }), [tokens]);

  const groups = segment ? [
    { index: ALL, label: `Todos (${segment.products.length})` },
    ...segment.groups.map((group, index) => ({
      index,
      label: `${group.name} (${group.products.length})`,
    })),
  ] : [];

  return (
    <ProductGrid
      resetKey={`segmento-${id}-${groupIndex}`}
      products={visible}
      ready={ready}
      emptyMessage={segment ? 'Nenhum produto neste grupo.' : 'Segmento não encontrado.'}
      header={
        <>
          <ThemedPanel variant="segmentos">
            <PanelHeading
              title={segment?.rule.name ?? 'Segmento'}
              subtitle={segment
                ? `${segment.rule.note} · ${segment.products.length} produtos`
                : ready ? undefined : 'Carregando…'}
            />
          </ThemedPanel>
          {segment ? (
            <View style={styles.filters}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {groups.map((group) => (
                  <Pressable
                    key={group.index}
                    accessibilityRole="button"
                    accessibilityState={{ selected: group.index === groupIndex }}
                    onPress={() => setGroupIndex(group.index)}
                    style={[styles.chip, group.index === groupIndex && styles.active]}
                  >
                    <Text style={[styles.text, group.index === groupIndex && styles.activeText]}>
                      {group.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </>
      }
    />
  );
}
