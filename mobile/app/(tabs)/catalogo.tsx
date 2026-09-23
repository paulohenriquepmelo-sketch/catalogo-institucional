import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { ProductCard } from '@/components/ProductCard';
import { isDiscontinued, useCatalog, useCatalogSearch } from '@/lib/catalog-store';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';
import { useResponsiveLayout } from '@/lib/useResponsiveLayout';
import { radius, spacing, typography } from '@/lib/theme';
import type { Product } from '@/lib/api';
import { createThemedStyles, useThemeColors } from '@/lib/app-theme';

const ALL = 'Todos';

// Remove acentos e caixa para comparar texto de forma tolerante.
function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Ordena respeitando números no início do nome ("1-ALIMENTOS" antes de
// "2-ART FRITAS", "1.3-BISCOITOS" depois de "1.2-MERCEARIA").
function compareLabels(a?: string, b?: string) {
  return (a ?? '').localeCompare(b ?? '', 'pt-BR', { numeric: true, sensitivity: 'base' });
}

// Chave de ordenação: texto sem acento, em caixa baixa, com os números
// preenchidos com zeros ("2-X" vira "000002-x") para que a comparação
// simples de string já respeite a ordem numérica. Assim a lista é ordenada
// UMA vez, sem chamar comparação de idioma (lenta) a cada filtro.
function sortKeyOf(...parts: (string | undefined)[]) {
  return parts
    .map((part) => normalize(part ?? '').replace(/\d+/g, (n) => n.padStart(6, '0')))
    .join('\u0000');
}

type IndexedProduct = {
  product: Product;
  sortKey: string;
  haystack: string;
};

function optionsFrom(values: (string | undefined)[]) {
  const unique = Array.from(new Set(values.filter((v): v is string => Boolean(v && v.trim()))));
  return [ALL, ...unique.sort(compareLabels)];
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function CatalogoScreen() {
  const styles = useStyles();
  const colors = useThemeColors();
  const { products, refreshing, refresh, offline } = useCatalog();
  const { searchQuery, setSearchQuery } = useCatalogSearch();
  const { columns, spacing: adaptiveSpacing } = useResponsiveLayout();
  // O índice abaixo percorre o catálogo inteiro: fica para o quadro seguinte
  // à abertura da aba, para o toque responder na hora.
  const ready = useAfterFirstFrame();
  const params = useLocalSearchParams<{
    query?: string | string[];
    brand?: string | string[];
    section?: string | string[];
  }>();

  const [selectedBrand, setSelectedBrand] = useState(() => firstParam(params.brand) ?? '');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSection, setSelectedSection] = useState(() => firstParam(params.section) ?? '');
  const [selectedCategory, setSelectedCategory] = useState('');

  // A aba "Catálogo" fica montada em segundo plano, então é preciso reagir a
  // uma nova navegação com parâmetros diferentes.
  useEffect(() => {
    const q = firstParam(params.query);
    const b = firstParam(params.brand);
    const s = firstParam(params.section);
    if (q !== undefined || b !== undefined || s !== undefined) {
      setSearchQuery(q ?? '');
      setSelectedBrand(b ?? '');
      setSelectedSection(s ?? '');
      setSelectedDepartment('');
      setSelectedCategory('');
    }
  }, [params.query, params.brand, params.section, setSearchQuery]);

  // A busca do cabeçalho é global. Ao começar a digitar, remove filtros
  // antigos da aba Catálogo para não esconder resultados de outras marcas
  // ou categorias sem o usuário perceber.
  useEffect(() => {
    if (!searchQuery.trim()) return;
    setSelectedBrand('');
    setSelectedDepartment('');
    setSelectedSection('');
    setSelectedCategory('');
  }, [searchQuery]);

  // Mantém a digitação fluida: a lista é recalculada com o texto "adiado",
  // sem travar a tecla que o usuário acabou de apertar.
  const deferredSearch = useDeferredValue(searchQuery);

  // Índice montado UMA vez por catálogo: texto de busca e chave de ordenação
  // já prontos, e a lista já ordenada por departamento → seção → categoria →
  // nome. Antes isso era refeito a cada tecla digitada, em 2.500 produtos.
  const indexed = useMemo<IndexedProduct[]>(() => {
    if (!ready) return [];
    const rows = products
      .filter((p) => p.published !== false || isDiscontinued(p))
      .map((product) => ({
        product,
        // O id no fim desempata produtos com o mesmo nome e categoria (há
        // alguns no catálogo): sem ele, a posição desses "gêmeos" dependia da
        // ordem em que chegaram e podia trocar a cada atualização.
        sortKey: sortKeyOf(
          product.department,
          product.section,
          product.category,
          product.name,
          String(product.id),
        ),
        haystack: normalize(
          [
            product.name,
            product.brand,
            product.description,
            product.code,
            product.department,
            product.section,
            product.category,
            product.segment,
            product.details?.packaging,
            product.details?.ean,
            product.details?.masterEan,
            ...product.specs,
          ]
            .filter(Boolean)
            .join(' | '),
        ),
      }));
    rows.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
    return rows;
  }, [ready, products]);

  // --- Filtros em cascata: departamento manda nas seções, seção manda nas
  // categorias, e a marca respeita tudo que já foi escolhido. ---
  const byDepartment = useMemo(
    () =>
      selectedDepartment
        ? indexed.filter((r) => r.product.department === selectedDepartment)
        : indexed,
    [indexed, selectedDepartment],
  );

  const bySection = useMemo(
    () =>
      selectedSection
        ? byDepartment.filter((r) => r.product.section === selectedSection)
        : byDepartment,
    [byDepartment, selectedSection],
  );

  const byCategory = useMemo(
    () =>
      selectedCategory
        ? bySection.filter((r) => r.product.category === selectedCategory)
        : bySection,
    [bySection, selectedCategory],
  );

  const departments = useMemo(
    () => optionsFrom(indexed.map((r) => r.product.department)),
    [indexed],
  );
  const sections = useMemo(
    () => optionsFrom(byDepartment.map((r) => r.product.section)),
    [byDepartment],
  );
  const categories = useMemo(
    () => optionsFrom(bySection.map((r) => r.product.category)),
    [bySection],
  );
  const brandNames = useMemo(
    () => optionsFrom(byCategory.map((r) => r.product.brand)),
    [byCategory],
  );

  const filtered = useMemo(() => {
    let rows = byCategory;

    if (selectedBrand && selectedBrand !== ALL) {
      rows = rows.filter((r) => r.product.brand === selectedBrand);
    }

    const terms = normalize(deferredSearch).split(/\s+/).filter(Boolean);
    if (terms.length) {
      rows = rows.filter((r) => terms.every((term) => r.haystack.includes(term)));
    }

    // Nada de reordenar aqui: o índice já veio ordenado na hierarquia
    // departamento → seção → categoria → nome, e filtrar preserva a ordem.
    return rows.map((r) => r.product);
  }, [byCategory, selectedBrand, deferredSearch]);

  const selectDepartment = (value: string) => {
    setSelectedDepartment(value === ALL ? '' : value);
    setSelectedSection('');
    setSelectedCategory('');
    setSelectedBrand('');
  };
  const selectSection = (value: string) => {
    setSelectedSection(value === ALL ? '' : value);
    setSelectedCategory('');
    setSelectedBrand('');
  };
  const selectCategory = (value: string) => {
    setSelectedCategory(value === ALL ? '' : value);
    setSelectedBrand('');
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedBrand('');
    setSelectedDepartment('');
    setSelectedSection('');
    setSelectedCategory('');
  };

  const hasActiveFilters = Boolean(
    searchQuery || selectedBrand || selectedDepartment || selectedSection || selectedCategory,
  );
  const renderProduct = useCallback<ListRenderItem<Product>>(
    ({ item }) => (
      <View style={styles.gridItem}>
        <ProductCard product={item} style={styles.cardFill} />
      </View>
    ),
    [styles],
  );
  const renderBatchSize = Math.max(4, columns * 2);

  return (
    <View style={styles.screen}>
      <FlatList
        key={`catalogo-grid-${columns}`}
        data={filtered}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.columnWrapper : undefined}
        renderItem={renderProduct}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={renderBatchSize}
        maxToRenderPerBatch={renderBatchSize}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={[styles.content, { paddingHorizontal: adaptiveSpacing.sm }]}
        ListHeaderComponent={
          <View style={styles.header}>
            {offline ? (
              <View style={styles.offlineBanner}>
                <AppIcon name="cloud-offline" size={16} color="#7a5b00" />
                <Text style={styles.offlineText}>
                  Sem conexão — mostrando o último catálogo salvo.
                </Text>
              </View>
            ) : null}

            <View style={styles.filtersContainer}>
              <FilterGroup
                label="DEPARTAMENTO"
                options={departments}
                selected={selectedDepartment || ALL}
                onSelect={selectDepartment}
              />

              {/* Seção e categoria só aparecem depois que o departamento é
                  escolhido, e listam apenas o que existe dentro dele. */}
              {selectedDepartment ? (
                <FilterGroup
                  label="SEÇÃO"
                  options={sections}
                  selected={selectedSection || ALL}
                  onSelect={selectSection}
                />
              ) : null}

              {selectedDepartment ? (
                <FilterGroup
                  label="CATEGORIA"
                  options={categories}
                  selected={selectedCategory || ALL}
                  onSelect={selectCategory}
                />
              ) : null}

              <FilterGroup
                label="MARCA"
                options={brandNames}
                selected={selectedBrand || ALL}
                onSelect={(value) => setSelectedBrand(value === ALL ? '' : value)}
              />

              {hasActiveFilters && (
                <Pressable onPress={handleClearFilters} style={styles.clearButton}>
                  <AppIcon name="close-circle" size={14} color={colors.accent} />
                  <Text style={styles.clearText}>Limpar filtros</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.resultInfo}>
              <Text style={styles.resultText}>
                {ready
                  ? `${filtered.length} produto${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`
                  : 'Carregando produtos…'}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          !ready ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <AppIcon name="circle-alert" size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>Nenhum produto encontrado</Text>
              <Text style={styles.emptyText}>Tente ajustar os filtros ou sua busca</Text>
              {hasActiveFilters && (
                <Pressable onPress={handleClearFilters} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>Limpar filtros</Text>
                </Pressable>
              )}
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      />
    </View>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const styles = useStyles();
  if (options.length <= 1) return null;
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {options.map((option) => {
          const active = option === selected;
          return (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text
                style={[styles.filterChipText, active && styles.filterChipTextActive]}
                numberOfLines={1}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  columnWrapper: {
    gap: spacing.sm,
  },
  gridItem: { flex: 1 },
  cardFill: { width: '100%' },
  header: {
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#fff3cd',
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  offlineText: { ...typography.small, color: '#7a5b00', flex: 1 },
  filtersContainer: {
    gap: spacing.md,
  },
  filterGroup: {
    gap: spacing.xs,
  },
  filterLabel: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.xs,
    maxWidth: 180,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.small,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.textOnPrimary,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.offerTint,
    borderWidth: 1,
    borderColor: '#ffe2e2',
    alignSelf: 'flex-start',
  },
  clearText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  resultInfo: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resultText: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xl,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  emptyButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
}));
