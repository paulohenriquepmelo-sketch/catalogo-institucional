import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProductGrid } from '@/components/ProductGrid';
import { PanelHeading, ThemedPanel } from '@/components/ThemedPanel';
import { isDiscontinued, useCatalog, useCatalogSearch } from '@/lib/catalog-store';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';
import { useAppTheme } from '@/lib/theme-provider';
import { readableColor } from '@/lib/theme-contrast';
import { radius, spacing, typography } from '@/lib/theme';
import type { Product } from '@/lib/api';

const ALL = 'Todos';

function normalize(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function compareLabels(a?: string, b?: string) {
  return (a ?? '').localeCompare(b ?? '', 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function sortKeyOf(...parts: (string | undefined)[]) {
  return parts
    .map((part) => normalize(part ?? '').replace(/\d+/g, (number) => number.padStart(6, '0')))
    .join('\u0000');
}

type IndexedProduct = { product: Product; sortKey: string; haystack: string };

function optionsFrom(values: (string | undefined)[]) {
  const unique = Array.from(new Set(values.filter(
    (value): value is string => Boolean(value && value.trim()),
  )));
  return [ALL, ...unique.sort(compareLabels)];
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function useStyles() {
  const { tokens } = useAppTheme();
  return useMemo(() => StyleSheet.create({
    filters: {
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: tokens.soft,
    },
    notice: { ...typography.body, color: tokens.ink },
    group: { gap: spacing.sm },
    label: { ...typography.small, fontWeight: '700', color: tokens.muted },
    chips: { gap: spacing.sm },
    chip: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.soft,
      justifyContent: 'center',
      maxWidth: 300,
    },
    active: { backgroundColor: tokens.accent, borderColor: tokens.accent },
    chipText: { ...typography.body, color: tokens.ink },
    activeText: { color: readableColor(tokens.onAccent, tokens.accent), fontWeight: '700' },
    clear: {
      minHeight: 44,
      minWidth: 44,
      padding: spacing.md,
      alignSelf: 'flex-start',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.soft,
    },
    clearText: { ...typography.body, color: tokens.link, fontWeight: '700' },
    result: {
      ...typography.small,
      color: tokens.muted,
      borderTopColor: tokens.border,
      borderTopWidth: 1,
      paddingTop: spacing.md,
    },
  }), [tokens]);
}

export default function CatalogoScreen() {
  const { products, refreshing, refresh, offline } = useCatalog();
  const { searchQuery, setSearchQuery } = useCatalogSearch();
  const ready = useAfterFirstFrame();
  const styles = useStyles();
  const params = useLocalSearchParams<{
    query?: string | string[];
    brand?: string | string[];
    section?: string | string[];
  }>();

  const [selectedBrand, setSelectedBrand] = useState(() => firstParam(params.brand) ?? '');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSection, setSelectedSection] = useState(() => firstParam(params.section) ?? '');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    const query = firstParam(params.query);
    const brand = firstParam(params.brand);
    const section = firstParam(params.section);
    if (query !== undefined || brand !== undefined || section !== undefined) {
      setSearchQuery(query ?? '');
      setSelectedBrand(brand ?? '');
      setSelectedSection(section ?? '');
      setSelectedDepartment('');
      setSelectedCategory('');
    }
  }, [params.query, params.brand, params.section, setSearchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) return;
    setSelectedBrand('');
    setSelectedDepartment('');
    setSelectedSection('');
    setSelectedCategory('');
  }, [searchQuery]);

  const deferredSearch = useDeferredValue(searchQuery);

  // O tema não participa das dependências do índice nem dos filtros.
  const indexed = useMemo<IndexedProduct[]>(() => {
    if (!ready) return [];
    const rows = products
      .filter((product) => product.published !== false || isDiscontinued(product))
      .map((product) => ({
        product,
        sortKey: sortKeyOf(
          product.department,
          product.section,
          product.category,
          product.name,
          String(product.id),
        ),
        haystack: normalize([
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
        ].filter(Boolean).join(' | ')),
      }));
    rows.sort((a, b) => a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0);
    return rows;
  }, [ready, products]);

  const byDepartment = useMemo(
    () => selectedDepartment
      ? indexed.filter((row) => row.product.department === selectedDepartment)
      : indexed,
    [indexed, selectedDepartment],
  );
  const bySection = useMemo(
    () => selectedSection
      ? byDepartment.filter((row) => row.product.section === selectedSection)
      : byDepartment,
    [byDepartment, selectedSection],
  );
  const byCategory = useMemo(
    () => selectedCategory
      ? bySection.filter((row) => row.product.category === selectedCategory)
      : bySection,
    [bySection, selectedCategory],
  );
  const departments = useMemo(
    () => optionsFrom(indexed.map((row) => row.product.department)), [indexed],
  );
  const sections = useMemo(
    () => optionsFrom(byDepartment.map((row) => row.product.section)), [byDepartment],
  );
  const categories = useMemo(
    () => optionsFrom(bySection.map((row) => row.product.category)), [bySection],
  );
  const brandNames = useMemo(
    () => optionsFrom(byCategory.map((row) => row.product.brand)), [byCategory],
  );

  const filtered = useMemo(() => {
    let rows = byCategory;
    if (selectedBrand && selectedBrand !== ALL) {
      rows = rows.filter((row) => row.product.brand === selectedBrand);
    }
    const terms = normalize(deferredSearch).split(/\s+/).filter(Boolean);
    if (terms.length) {
      rows = rows.filter((row) => terms.every((term) => row.haystack.includes(term)));
    }
    return rows.map((row) => row.product);
  }, [byCategory, selectedBrand, deferredSearch]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedBrand('');
    setSelectedDepartment('');
    setSelectedSection('');
    setSelectedCategory('');
  };
  const hasActiveFilters = Boolean(
    searchQuery || selectedBrand || selectedDepartment || selectedSection || selectedCategory,
  );
  const clearButton = (
    <Pressable accessibilityRole="button" onPress={clearFilters} style={styles.clear}>
      <Text style={styles.clearText}>Limpar filtros</Text>
    </Pressable>
  );

  return (
    <ProductGrid
      products={filtered}
      ready={ready}
      refreshing={refreshing}
      onRefresh={refresh}
      emptyMessage="Nenhum produto encontrado. Tente ajustar os filtros ou sua busca."
      emptyAction={hasActiveFilters ? clearButton : null}
      header={
        <>
          <ThemedPanel>
            <PanelHeading title="Todos os produtos" />
          </ThemedPanel>
          <View style={styles.filters}>
            {offline ? (
              <Text style={styles.notice}>Sem conexão — mostrando o último catálogo salvo.</Text>
            ) : null}
            <FilterGroup
              label="DEPARTAMENTO"
              options={departments}
              selected={selectedDepartment || ALL}
              onSelect={(value) => {
                setSelectedDepartment(value === ALL ? '' : value);
                setSelectedSection('');
                setSelectedCategory('');
                setSelectedBrand('');
              }}
            />
            {selectedDepartment ? (
              <>
                <FilterGroup
                  label="SEÇÃO"
                  options={sections}
                  selected={selectedSection || ALL}
                  onSelect={(value) => {
                    setSelectedSection(value === ALL ? '' : value);
                    setSelectedCategory('');
                    setSelectedBrand('');
                  }}
                />
                <FilterGroup
                  label="CATEGORIA"
                  options={categories}
                  selected={selectedCategory || ALL}
                  onSelect={(value) => {
                    setSelectedCategory(value === ALL ? '' : value);
                    setSelectedBrand('');
                  }}
                />
              </>
            ) : null}
            <FilterGroup
              label="MARCA"
              options={brandNames}
              selected={selectedBrand || ALL}
              onSelect={(value) => setSelectedBrand(value === ALL ? '' : value)}
            />
            {hasActiveFilters ? clearButton : null}
            <Text style={styles.result}>
              {ready
                ? `${filtered.length} produto${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`
                : 'Carregando produtos…'}
            </Text>
          </View>
        </>
      }
    />
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
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
      >
        {options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: option === selected }}
            onPress={() => onSelect(option)}
            style={[styles.chip, option === selected && styles.active]}
          >
            <Text style={[styles.chipText, option === selected && styles.activeText]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
