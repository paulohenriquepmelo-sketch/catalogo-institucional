import type { Product } from '@/lib/api';
import { SEGMENT_RULES, type SegmentRule } from '@/lib/segment-rules';

export type SegmentGroup = { name: string; products: Product[] };

export type Segment = {
  rule: SegmentRule;
  /** Todos os produtos do segmento, sem repetição, na ordem dos grupos. */
  products: Product[];
  /** Só os grupos que têm produto. */
  groups: SegmentGroup[];
};

// Sem acento, minúsculo e com espaços simples. `keepTrailingSpace` preserva o
// espaço final das palavras-chave ("copo " exige a palavra inteira).
export function normalize(text: string, keepTrailingSpace = false) {
  const plain = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return keepTrailingSpace ? plain.trimStart() : plain.trim();
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Uma expressão por lista: a palavra precisa começar no início do nome ou
// logo depois de um caractere que não seja letra/número.
export function wordStartPattern(words: string[]) {
  const parts = words.map((word) => normalize(word, true)).filter(Boolean).map(escapeRegExp);
  return parts.length ? new RegExp(`(?:^|[^a-z0-9])(?:${parts.join('|')})`) : null;
}

// Quantidade no nome, em gramas ou ml: "1,01KG", "5,01 LTS", "900ML", "1,700 KG".
// Se houver mais de uma, vale a maior.
const SIZE_PATTERN = /(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|grs|gramas|lt|lts|l|litro|litros|ml)(?![a-z])/g;
// Embalagem grande sem tamanho escrito: bag, galão, balde, bombona ou "(GR)".
const BULK_PATTERN = /(?:^|[^a-z0-9])(?:bag|galao|balde|bombona)(?![a-z])|\(gr\)/;

export function sizeOf(name: string): number | null {
  let largest: number | null = null;
  for (const [, amount, unit] of name.matchAll(SIZE_PATTERN)) {
    let value = Number(amount.replace(',', '.'));
    if (unit.startsWith('k') || unit.startsWith('l')) value *= 1000;
    largest = largest === null ? value : Math.max(largest, value);
  }
  return largest;
}

type CompiledGroup = {
  name: string;
  categories: Set<string>;
  keywords: RegExp | null;
  exclude: RegExp | null;
  minSize: number;
};

const compiled = SEGMENT_RULES.map((rule) => ({
  rule,
  groups: rule.groups.map<CompiledGroup>((group) => ({
    name: group.name,
    categories: new Set(group.categories.map((category) => normalize(category))),
    keywords: wordStartPattern(group.keywords),
    exclude: wordStartPattern(group.exclude),
    minSize: group.minSize,
  })),
}));

// Calculado uma vez por catálogo (a lista de produtos só muda quando algo é
// publicado): trocar de segmento ou de grupo não refaz nada.
const cache = new WeakMap<Product[], Segment[]>();

/** Segmentos com os produtos de cada grupo. Produtos sem publicação ficam de fora. */
export function buildSegments(products: Product[]): Segment[] {
  const cached = cache.get(products);
  if (cached) return cached;

  const hits = compiled.map((segment) => segment.groups.map<Product[]>(() => []));
  for (const product of products) {
    if (product.published === false) continue;
    // Espaço nas pontas: "copo " também casa quando "copo" é a última palavra.
    const name = ` ${normalize(product.name ?? '')} `;
    const category = normalize(product.category ?? '');
    // Lidos só se algum grupo pedir tamanho mínimo, e uma vez por produto.
    let size: number | null | undefined;
    let bulk: boolean | undefined;
    compiled.forEach((segment, s) => {
      segment.groups.forEach((group, g) => {
        if (group.exclude?.test(name)) return;
        if (!group.categories.has(category) && !group.keywords?.test(name)) return;
        if (group.minSize > 0) {
          bulk ??= BULK_PATTERN.test(name);
          if (!bulk) {
            if (size === undefined) size = sizeOf(name);
            if (size === null || size < group.minSize) return;
          }
        }
        hits[s][g].push(product);
      });
    });
  }

  const segments = compiled.map<Segment>((segment, s) => {
    const groups = segment.groups
      .map((group, g) => ({ name: group.name, products: hits[s][g] }))
      .filter((group) => group.products.length > 0);
    const seen = new Set<number>();
    const all: Product[] = [];
    for (const group of groups) {
      for (const product of group.products) {
        if (seen.has(product.id)) continue;
        seen.add(product.id);
        all.push(product);
      }
    }
    return { rule: segment.rule, products: all, groups };
  });

  cache.set(products, segments);
  return segments;
}
