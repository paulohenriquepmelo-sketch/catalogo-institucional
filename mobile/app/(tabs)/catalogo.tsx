import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { ProductGrid } from '@/components/ProductGrid';
import { ThemedPanel, usePanelSurface } from '@/components/ThemedPanel';
import { isDiscontinued, useCatalog, useCatalogSearch } from '@/lib/catalog-store';
import { useAfterFirstFrame } from '@/lib/useAfterFirstFrame';
import { useAppTheme } from '@/lib/theme-provider';
import { readableColor } from '@/lib/theme-contrast';
import { market } from '@/lib/theme';
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
  const surface = usePanelSurface();
  return useMemo(() => StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    title: { fontSize: 16, fontWeight: '700', color: readableColor(tokens.ink, surface) },
    result: { fontSize: 12, color: readableColor('#777777', surface) },
    notice: { fontSize: 12, color: readableColor('#5c3b00', surface), marginTop: 6 },
    selects: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    select: {
      flexGrow: 1,
      flexBasis: '45%',
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      borderRadius: market.radius,
      borderWidth: 1,
      borderColor: '#dddddd',
      backgroundColor: '#ffffff',
    },
    selectOn: { borderColor: tokens.link, backgroundColor: '#eaf0fb' },
    selectText: { flex: 1, minWidth: 0 },
    selectLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: '#888888' },
    selectValue: { fontSize: 13, color: '#333333' },
    selectValueOn: { color: readableColor(tokens.link, '#eaf0fb'), fontWeight: '700' },
    clear: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
    clearText: { fontSize: 12, fontWeight: '700', color: readableColor(tokens.link, surface) },
    backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
    sheet: {
      maxHeight: '75%',
      backgroundColor: '#ffffff',
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      paddingTop: 14,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    sheetTitle: { fontSize: 16, fontWeight: '700', color: '#25332c' },
    close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    sheetSearch: {
      marginHorizontal: 16,
      marginBottom: 8,
      height: 42,
      paddingHorizontal: 12,
      borderRadius: market.radius,
      borderWidth: 1,
      borderColor: '#dddddd',
      fontSize: 14,
      color: '#333333',
    },
    option: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderTopWidth: 1,
      borderTopColor: '#f0f0f0',
    },
    optionOn: { backgroundColor: '#eaf0fb' },
    optionText: { fontSize: 14, color: '#333333' },
    optionTextOn: { color: readableColor(tokens.link, '#eaf0fb'), fontWeight: '700' },
  }), [tokens, surface]);
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
        <ThemedPanel>
          <View style={styles.head}>
            <Text accessibilityRole="header" style={styles.title}>Todos os produtos</Text>
            <Text style={styles.result}>
              {ready
                ? `${filtered.length} produto${filtered.length !== 1 ? 's' : ''}`
                : 'Carregando…'}
            </Text>
          </View>
          {offline ? (
            <Text style={styles.notice}>Sem conexão — mostrando o último catálogo salvo.</Text>
          ) : null}
          {/* Filtros compactos: cada botão abre a lista de opções. */}
          <View style={styles.selects}>
            <FilterSelect
              label="Departamento"
              options={departments}
              selected={selectedDepartment}
              onSelect={(value) => {
                setSelectedDepartment(value);
                setSelectedSection('');
                setSelectedCategory('');
                setSelectedBrand('');
              }}
            />
            {selectedDepartment ? (
              <>
                <FilterSelect
                  label="Seção"
                  options={sections}
                  selected={selectedSection}
                  onSelect={(value) => {
                    setSelectedSection(value);
                    setSelectedCategory('');
                    setSelectedBrand('');
                  }}
                />
                <FilterSelect
                  label="Categoria"
                  options={categories}
                  selected={selectedCategory}
                  onSelect={(value) => {
                    setSelectedCategory(value);
                    setSelectedBrand('');
                  }}
                />
              </>
            ) : null}
            <FilterSelect
              label="Marca"
              options={brandNames}
              selected={selectedBrand}
              onSelect={setSelectedBrand}
            />
          </View>
          {hasActiveFilters ? clearButton : null}
        </ThemedPanel>
      }
    />
  );
}

function FilterSelect({
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
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const visible = useMemo(() => {
    const query = normalize(term);
    return query ? options.filter((option) => normalize(option).includes(query)) : options;
  }, [options, term]);
  if (options.length <= 1) return null;

  const on = Boolean(selected);
  const close = () => {
    setOpen(false);
    setTerm('');
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected || ALL}. Toque para escolher`}
        onPress={() => setOpen(true)}
        style={[styles.select, on && styles.selectOn]}
      >
        <View style={styles.selectText}>
          <Text style={styles.selectLabel}>{label.toUpperCase()}</Text>
          <Text style={[styles.selectValue, on && styles.selectValueOn]} numberOfLines={1}>
            {selected || ALL}
          </Text>
        </View>
        <AppIcon name="chevron-down" size={18} color="#666666" />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Fechar">
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]} onPress={() => undefined}>
            <View style={styles.sheetHead}>
              <Text accessibilityRole="header" style={styles.sheetTitle}>{label}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={close} style={styles.close}>
                <AppIcon name="close-circle" size={24} color="#666666" />
              </Pressable>
            </View>
            {options.length > 8 ? (
              <TextInput
                value={term}
                onChangeText={setTerm}
                placeholder={`Buscar ${label.toLowerCase()}`}
                placeholderTextColor="#888888"
                accessibilityLabel={`Buscar ${label.toLowerCase()}`}
                style={styles.sheetSearch}
              />
            ) : null}
            <FlatList
              data={visible}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item === (selected || ALL);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      onSelect(item === ALL ? '' : item);
                      close();
                    }}
                    style={[styles.option, active && styles.optionOn]}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextOn]}>{item}</Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
