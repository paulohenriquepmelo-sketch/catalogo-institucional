import type { Product } from './catalog-data';
import { compareBySimilarity } from './product-family';

/**
 * Plano das páginas do catálogo em PDF, no layout do catálogo impresso da
 * Laurencini (A4): faixa vermelha com trapézio azul no topo (título da seção
 * e categoria no canto), divisórias entre categorias, grade de produtos com
 * foto, código e nome, e rodapé azul com o número da página. Só calcula
 * posições; o desenho fica em catalog-pdf-render.ts.
 */
export const PAGE = { width: 595.28, height: 841.89 } as const;
export const GRID = {
  columns: 5,
  marginX: 28,
  top: 50,
  bottom: 800,
  /** Foto + código + até duas linhas de nome. */
  rowHeight: 122,
  /** Divisória de categoria (faixa + trapézio) com o respiro em volta. */
  barHeight: 44,
} as const;

export type PdfProduct = Pick<
  Product,
  'id' | 'code' | 'name' | 'department' | 'section' | 'category' | 'brand' | 'image'
>;
export type PdfBlock =
  | { type: 'bar'; title: string; y: number }
  | { type: 'row'; products: PdfProduct[]; y: number };
export type PdfPage = {
  number: number;
  /** Seção (vai no trapézio do topo). */
  title: string;
  /** Categoria do início da página (canto superior direito). */
  label: string;
  blocks: PdfBlock[];
};

const SMALL_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'p/', 'c/']);
const ACRONYMS = new Set(['pvc', 'eps', 'pp', 'pet', 'uht']);
/** "2.1-BALAS & DROPS" → "Balas & Drops"; "4-YOKI & KITANO" → "Yoki & Kitano". */
export function displayName(value: string) {
  const text = value.replace(/^\s*[\d.]+\s*-\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase();
  return text
    .split(' ')
    .map((word, i) =>
      ACRONYMS.has(word.replace(/[^a-z]/g, ''))
        ? word.toUpperCase()
        : i > 0 && SMALL_WORDS.has(word)
          ? word
          : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

// "1.10-X" vem depois de "1.9-X": compara os números do prefixo, não o texto.
function prefixKey(value: string) {
  const match = /^\s*([\d.]+)\s*-/.exec(value);
  return match ? match[1].split('.').filter(Boolean).map(Number) : [Number.MAX_SAFE_INTEGER];
}
function compareByPrefix(a: string, b: string) {
  const pa = prefixKey(a);
  const pb = prefixKey(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (diff) return diff;
  }
  return a.localeCompare(b, 'pt-BR');
}

/**
 * Ordem igual à do catálogo impresso: primeiro a Distribuição (marcas
 * próprias: Dona Benta, Yoki, Hershey's...), depois o Atacado; dentro de
 * cada um, seções e categorias pela numeração do ERP. Dentro da categoria,
 * produtos por semelhança (tipo do produto, veja product-family.ts) e nome.
 */
export function sortForCatalog(products: PdfProduct[]) {
  const departmentRank = (d: string) => (/distribui/i.test(d) ? 0 : 1);
  return [...products].sort(
    (a, b) =>
      departmentRank(a.department) - departmentRank(b.department) ||
      compareByPrefix(a.department, b.department) ||
      compareByPrefix(a.section, b.section) ||
      compareByPrefix(a.category, b.category) ||
      compareBySimilarity(a.name, b.name) ||
      a.code.localeCompare(b.code, 'pt-BR', { numeric: true }),
  );
}

/** Páginas de produtos (a capa não conta: a primeira página de produtos é a 01). */
export function planCatalogPdf(products: PdfProduct[]): PdfPage[] {
  const pages: PdfPage[] = [];
  let page: PdfPage | null = null;
  let y = 0;
  let department = '';
  let section = '';
  const sorted = sortForCatalog(products.filter((p) => p.image));
  const newPage = (title: string, label: string): PdfPage => {
    const created: PdfPage = { number: pages.length + 1, title, label, blocks: [] };
    pages.push(created);
    page = created;
    y = GRID.top;
    return created;
  };
  const fits = (height: number) => y + height <= GRID.bottom;

  let index = 0;
  while (index < sorted.length) {
    const first = sorted[index];
    const group: PdfProduct[] = [];
    while (
      index < sorted.length &&
      sorted[index].department === first.department &&
      sorted[index].section === first.section &&
      sorted[index].category === first.category
    )
      group.push(sorted[index++]);

    const sectionTitle = displayName(first.section);
    const categoryTitle = displayName(first.category);
    const rows = Math.ceil(group.length / GRID.columns);
    const newSection = first.section !== section || first.department !== department;
    let current = page as PdfPage | null;
    if (!current) current = newPage(sectionTitle, categoryTitle);
    else if (current.blocks.length) {
      // Seção pequena não ganha página só para ela (era o maior buraco do
      // PDF): entra na mesma página com uma divisória, se couberem a
      // divisória e uma fileira de produtos.
      const needed = GRID.barHeight + Math.min(rows, 1) * GRID.rowHeight;
      if (!fits(needed)) current = newPage(sectionTitle, categoryTitle);
      else {
        current.blocks.push({
          type: 'bar',
          title: newSection ? `${sectionTitle} · ${categoryTitle}` : categoryTitle,
          y,
        });
        y += GRID.barHeight;
      }
    }
    department = first.department;
    section = first.section;
    for (let i = 0; i < group.length; i += GRID.columns) {
      if (!fits(GRID.rowHeight)) current = newPage(sectionTitle, categoryTitle);
      current!.blocks.push({ type: 'row', products: group.slice(i, i + GRID.columns), y });
      y += GRID.rowHeight;
    }
  }
  pages.forEach((p, i) => i < pages.length - 1 && spreadSlack(p));
  return pages;
}

/**
 * Página que quebrou por falta de espaço espalha a sobra entre os blocos, em
 * vez de deixar uma faixa branca antes do rodapé. Página que terminou porque
 * o conteúdo acabou (sobra grande) fica alinhada em cima.
 */
function spreadSlack(page: PdfPage) {
  const last = page.blocks.at(-1);
  if (!last || page.blocks.length < 2) return;
  const end = last.y + (last.type === 'bar' ? GRID.barHeight : GRID.rowHeight);
  const slack = GRID.bottom - end;
  if (slack <= 0 || slack >= GRID.barHeight + GRID.rowHeight) return;
  const gap = Math.min(slack / (page.blocks.length - 1), 40);
  page.blocks.forEach((block, i) => {
    block.y += gap * i;
  });
}
