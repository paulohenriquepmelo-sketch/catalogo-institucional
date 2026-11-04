import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
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

type TreeNode = { name: string; count: number; children: TreeNode[] };

/** Agrupa os produtos em Departamento → Seção → Categoria, em ordem natural. */
function buildTree(products: Product[]): TreeNode[] {
  const root = new Map<string, { count: number; kids: Map<string, { count: number; kids: Map<string, number> }> }>();
  for (const product of products) {
    const department = product.department?.trim();
    if (!department) continue;
    const dep = root.get(department) ?? { count: 0, kids: new Map() };
    dep.count += 1;
    root.set(department, dep);
    const section = product.section?.trim();
    if (!section) continue;
    const sec = dep.kids.get(section) ?? { count: 0, kids: new Map() };
    sec.count += 1;
    dep.kids.set(section, sec);
    const category = product.category?.trim();
    if (category) sec.kids.set(category, (sec.kids.get(category) ?? 0) + 1);
  }
  const sorted = <T,>(entries: [string, T][]) => entries.sort((a, b) => compareLabels(a[0], b[0]));
  return sorted(Array.from(root.entries())).map(([name, dep]) => ({
    name,
    count: dep.count,
    children: sorted(Array.from(dep.kids.entries())).map(([sectionName, sec]) => ({
      name: sectionName,
      count: sec.count,
      children: sorted(Array.from(sec.kids.entries())).map(([categoryName, count]) => ({
        name: categoryName,
        count,
        children: [],
      })),
    })),
  }));
}

/** Tira o código da frente ("1.2-MERCEARIA" → "MERCEARIA") só para exibir. */
function displayName(name: string) {
  return name.replace(/^[\d.]+\s*-\s*/, '');
}

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
  return useMemo(() => {
    const ink = readableColor('#25332c', surface);
    const chipOn = tokens.dark;
    return StyleSheet.create({
      head: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
        paddingHorizontal: 2,
      },
      title: { fontSize: 17, fontWeight: '800', color: ink, letterSpacing: -0.2 },
      result: { fontSize: 12, color: readableColor('#777777', surface), fontVariant: ['tabular-nums'] },
      notice: { fontSize: 12, color: readableColor('#5c3b00', surface), marginTop: 6 },
      chips: { gap: 8, paddingTop: 10, paddingRight: 4 },
      chip: {
        height: 34,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingRight: 9,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: '#d9dde5',
        backgroundColor: '#ffffff',
      },
      chipOn: { backgroundColor: chipOn, borderColor: chipOn },
      chipMain: { height: '100%', flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 12 },
      chipText: { fontSize: 13, fontWeight: '600', color: '#3d4553', maxWidth: 150 },
      chipTextOn: { color: readableColor('#ffffff', chipOn) },
      chipClear: { marginLeft: 2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff33' },
      clearAll: { height: 34, justifyContent: 'center', paddingHorizontal: 6 },
      clearAllText: { fontSize: 13, fontWeight: '700', color: readableColor(tokens.link, surface) },
      backdrop: { flex: 1, backgroundColor: '#0b1220aa', justifyContent: 'flex-end' },
      sheet: {
        maxHeight: '78%',
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        paddingTop: 8,
      },
      grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#d9dde5', marginBottom: 8 },
      sheetHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 20,
        paddingRight: 8,
      },
      sheetTitle: { fontSize: 17, fontWeight: '800', color: '#25332c' },
      sheetCount: { fontSize: 12, color: '#7a8392', marginTop: 2 },
      close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
      sheetSearch: {
        marginHorizontal: 16,
        marginTop: 6,
        marginBottom: 6,
        height: 42,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        borderRadius: 21,
        backgroundColor: '#f2f4f7',
      },
      sheetInput: { flex: 1, minWidth: 0, fontSize: 14, color: '#333333', height: 42 },
      option: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 20,
      },
      optionText: { flex: 1, fontSize: 15, color: '#333a45' },
      optionTextOn: { color: readableColor(tokens.link, '#ffffff'), fontWeight: '700' },
      separator: { height: 1, marginLeft: 20, backgroundColor: '#eef0f3' },
      empty: { padding: 20, fontSize: 14, color: '#7a8392' },
      sheetHeadText: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
      sheetTitleBox: { flex: 1, minWidth: 0 },
      back: { width: 36, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
      optionAll: { fontWeight: '600' },
      optionCount: { fontSize: 12, color: '#9aa2ae', fontVariant: ['tabular-nums'] },
    });
  }, [tokens, surface]);
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
  // Árvore Departamento → Seção → Categoria, com a contagem de produtos de cada nó.
  const tree = useMemo(() => buildTree(indexed.map((row) => row.product)), [indexed]);
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
    <Pressable accessibilityRole="button" onPress={clearFilters} style={styles.clearAll}>
      <Text style={styles.clearAllText}>Limpar filtros</Text>
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
                ? `${filtered.length.toLocaleString('pt-BR')} ${filtered.length === 1 ? 'produto' : 'produtos'}`
                : 'Carregando…'}
            </Text>
          </View>
          {offline ? (
            <Text style={styles.notice}>Sem conexão — mostrando o último catálogo salvo.</Text>
          ) : null}
          {/* Filtros em pílulas: cada uma abre a lista; a escolhida fica na cor do tema. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chips}
          >
            <DepartmentSelect
              tree={tree}
              department={selectedDepartment}
              section={selectedSection}
              category={selectedCategory}
              onSelect={(department, section, category) => {
                setSelectedDepartment(department);
                setSelectedSection(section);
                setSelectedCategory(category);
                setSelectedBrand('');
              }}
            />
            <FilterSelect
              label="Marca"
              options={brandNames}
              selected={selectedBrand}
              onSelect={setSelectedBrand}
            />
            {hasActiveFilters ? (
              <Pressable accessibilityRole="button" onPress={clearFilters} style={styles.clearAll}>
                <Text style={styles.clearAllText}>Limpar</Text>
              </Pressable>
            ) : null}
          </ScrollView>
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
  const iconColor = on ? '#ffffff' : '#5b6472';

  return (
    <>
      {/* Pílula e "✕" são botões irmãos: botão dentro de botão quebra no Android e na web. */}
      <View style={[styles.chip, on && styles.chipOn]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selected || ALL}. Toque para escolher`}
          onPress={() => setOpen(true)}
          style={styles.chipMain}
        >
          <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
            {on ? selected : label}
          </Text>
          {on ? null : <AppIcon name="chevron-down" size={16} color={iconColor} />}
        </Pressable>
        {on ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Limpar ${label.toLowerCase()}`}
            hitSlop={10}
            onPress={() => onSelect('')}
            style={styles.chipClear}
          >
            <AppIcon name="close" size={12} color={iconColor} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>
      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Fechar">
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]} onPress={() => undefined}>
            <View style={styles.grip} />
            <View style={styles.sheetHead}>
              <View>
                <Text accessibilityRole="header" style={styles.sheetTitle}>{label}</Text>
                <Text style={styles.sheetCount}>{options.length - 1} opções</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={close} style={styles.close}>
                <AppIcon name="close" size={22} color="#5b6472" />
              </Pressable>
            </View>
            {options.length > 8 ? (
              <View style={styles.sheetSearch}>
                <AppIcon name="search" size={18} color="#7a8392" />
                <TextInput
                  value={term}
                  onChangeText={setTerm}
                  placeholder={`Buscar ${label.toLowerCase()}`}
                  placeholderTextColor="#8a93a1"
                  accessibilityLabel={`Buscar ${label.toLowerCase()}`}
                  style={styles.sheetInput}
                />
              </View>
            ) : null}
            <FlatList
              data={visible}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<Text style={styles.empty}>Nada encontrado.</Text>}
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
                    style={styles.option}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextOn]}>{item}</Text>
                    {active ? <AppIcon name="check" size={18} color={readableColor('#263f85', '#ffffff')} strokeWidth={2.5} /> : null}
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

const LEVELS = ['departamento', 'seção', 'categoria'] as const;

function DepartmentSelect({
  tree,
  department,
  section,
  category,
  onSelect,
}: {
  tree: TreeNode[];
  department: string;
  section: string;
  category: string;
  onSelect: (department: string, section: string, category: string) => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  // Caminho aberto na lista: [] = departamentos, [dep] = seções, [dep, seção] = categorias.
  const [path, setPath] = useState<string[]>([]);
  if (tree.length === 0) return null;

  const on = Boolean(department || section || category);
  const label = category || section || department;
  const iconColor = on ? '#ffffff' : '#5b6472';

  const depNode = path[0] ? tree.find((node) => node.name === path[0]) : undefined;
  const secNode = path[1] ? depNode?.children.find((node) => node.name === path[1]) : undefined;
  const level = path.length;
  const nodes = level === 0 ? tree : level === 1 ? depNode?.children ?? [] : secNode?.children ?? [];
  const parent = level === 1 ? depNode : level === 2 ? secNode : undefined;

  const openSheet = () => {
    // Reabre no nível já escolhido, para ajustar sem recomeçar.
    setPath(section && department ? [department, section] : department ? [department] : []);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const choose = (next: string[]) => {
    onSelect(next[0] ?? '', next[1] ?? '', next[2] ?? '');
    close();
  };
  const current = [department, section, category].filter(Boolean);
  const isCurrent = (candidate: string[]) =>
    candidate.length === current.length && candidate.every((value, index) => value === current[index]);

  return (
    <>
      <View style={[styles.chip, on && styles.chipOn]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Departamento: ${label || 'Todos'}. Toque para escolher`}
          onPress={openSheet}
          style={styles.chipMain}
        >
          <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
            {on ? displayName(label) : 'Departamento'}
          </Text>
          {on ? null : <AppIcon name="chevron-down" size={16} color={iconColor} />}
        </Pressable>
        {on ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Limpar departamento"
            hitSlop={10}
            onPress={() => onSelect('', '', '')}
            style={styles.chipClear}
          >
            <AppIcon name="close" size={12} color={iconColor} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>
      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Fechar">
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]} onPress={() => undefined}>
            <View style={styles.grip} />
            <View style={styles.sheetHead}>
              <View style={styles.sheetHeadText}>
                {level > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Voltar um nível"
                    onPress={() => setPath(path.slice(0, -1))}
                    style={styles.back}
                  >
                    <AppIcon name="arrow-back" size={20} color="#25332c" />
                  </Pressable>
                ) : null}
                <View style={styles.sheetTitleBox}>
                  <Text accessibilityRole="header" style={styles.sheetTitle} numberOfLines={1}>
                    {parent ? displayName(parent.name) : 'Departamento'}
                  </Text>
                  <Text style={styles.sheetCount} numberOfLines={1}>
                    {level === 0
                      ? 'Escolha o departamento'
                      : level === 1
                        ? 'Escolha a seção'
                        : `${displayName(path[0])} › escolha a categoria`}
                  </Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={close} style={styles.close}>
                <AppIcon name="close" size={22} color="#5b6472" />
              </Pressable>
            </View>
            <FlatList
              data={nodes}
              keyExtractor={(item) => item.name}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListHeaderComponent={
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isCurrent(path) }}
                    onPress={() => choose(path)}
                    style={styles.option}
                  >
                    <Text style={[styles.optionText, styles.optionAll, isCurrent(path) && styles.optionTextOn]}>
                      {parent
                        ? `Tudo de ${displayName(parent.name)}`
                        : 'Todos os departamentos'}
                    </Text>
                    {parent ? <Text style={styles.optionCount}>{parent.count}</Text> : null}
                    {isCurrent(path) ? <AppIcon name="check" size={18} color="#263f85" strokeWidth={2.5} /> : null}
                  </Pressable>
                  <View style={styles.separator} />
                </>
              }
              renderItem={({ item }) => {
                const next = [...path, item.name];
                const deeper = item.children.length > 0 && level < LEVELS.length - 1;
                const active = isCurrent(next);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityHint={deeper ? `Abre as opções de ${LEVELS[level + 1]}` : undefined}
                    onPress={() => (deeper ? setPath(next) : choose(next))}
                    style={styles.option}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextOn]}>{displayName(item.name)}</Text>
                    <Text style={styles.optionCount}>{item.count}</Text>
                    {deeper
                      ? <AppIcon name="chevron-forward" size={18} color="#9aa2ae" />
                      : active ? <AppIcon name="check" size={18} color="#263f85" strokeWidth={2.5} /> : null}
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
