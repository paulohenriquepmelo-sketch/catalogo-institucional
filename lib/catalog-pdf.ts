import type { Product } from './catalog-data';
import { compareBySimilarity, familyKey } from './product-family';

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
  /**
   * Fileira apertada (foto menor) para não mandar 1 ou 2 produtos sozinhos
   * para a página seguinte.
   */
  minRowHeight: 104,
} as const;

export type PdfProduct = Pick<
  Product,
  'id' | 'code' | 'name' | 'department' | 'section' | 'category' | 'brand' | 'image'
>;
export type PdfBlock =
  | { type: 'bar'; title: string; y: number }
  | { type: 'row'; products: PdfProduct[]; y: number; height?: number };
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

/**
 * Fileiras de uma categoria. Um tipo de produto que cabe numa fileira (até 5
 * itens) não é partido entre duas: se não couber no resto da fileira, começa
 * na próxima (milho verde fica junto, e a ervilha vem logo depois). Tipos
 * maiores seguem preenchendo as fileiras.
 */
export function packRows(group: PdfProduct[]) {
  const rows: PdfProduct[][] = [];
  let row: PdfProduct[] = [];
  let i = 0;
  while (i < group.length) {
    const key = familyKey(group[i].name);
    let end = i;
    while (end < group.length && familyKey(group[end].name) === key) end++;
    const family = group.slice(i, end);
    i = end;
    if (row.length && family.length <= GRID.columns && row.length + family.length > GRID.columns) {
      rows.push(row);
      row = [];
    }
    for (const product of family) {
      row.push(product);
      if (row.length === GRID.columns) {
        rows.push(row);
        row = [];
      }
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

/**
 * Aperta as fileiras da página para caber mais uma (a última de uma
 * categoria, com 1 ou 2 produtos). Devolve false se nem apertando couber.
 */
function squeezeOneMoreRow(page: PdfPage) {
  const rows = page.blocks.filter((b) => b.type === 'row').length + 1;
  const bars = page.blocks.filter((b) => b.type === 'bar').length;
  const height = Math.floor((GRID.bottom - GRID.top - bars * GRID.barHeight) / rows);
  if (height < GRID.minRowHeight) return null;
  let y = GRID.top;
  for (const block of page.blocks) {
    block.y = y;
    if (block.type === 'bar') y += GRID.barHeight;
    else {
      block.height = Math.min(height, GRID.rowHeight);
      y += block.height;
    }
  }
  return { y, height: Math.min(height, GRID.rowHeight) };
}

const blockHeight = (block: PdfBlock) =>
  block.type === 'bar' ? GRID.barHeight : (block.height ?? GRID.rowHeight);

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
    const packed = packRows(group);
    const rows = packed.length;
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
    packed.forEach((products, r) => {
      if (!fits(GRID.rowHeight)) {
        // Última fileira da categoria com 1 ou 2 produtos: aperta a página em
        // vez de deixá-los sozinhos na seguinte.
        const squeezed =
          r === packed.length - 1 && r > 0 && products.length <= 2
            ? squeezeOneMoreRow(current!)
            : null;
        if (squeezed) {
          current!.blocks.push({ type: 'row', products, y: squeezed.y, height: squeezed.height });
          y = GRID.bottom;
          return;
        }
        current = newPage(sectionTitle, categoryTitle);
      }
      current!.blocks.push({ type: 'row', products, y });
      y += GRID.rowHeight;
    });
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
  const end = last.y + blockHeight(last);
  const slack = GRID.bottom - end;
  if (slack <= 0 || slack >= GRID.barHeight + GRID.rowHeight) return;
  const gap = Math.min(slack / (page.blocks.length - 1), 40);
  page.blocks.forEach((block, i) => {
    block.y += gap * i;
  });
}
