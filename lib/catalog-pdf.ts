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
  /**
   * Fileira apertada (foto menor) para não mandar 1 ou 2 produtos sozinhos
   * para a página seguinte.
   */
  minRowHeight: 104,
} as const;

export type PdfProduct = Pick<
  Product,
  'id' | 'code' | 'name' | 'department' | 'section' | 'category' | 'brand' | 'image' | 'details'
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
  /** Seção da página (só nas páginas da Distribuição, que não misturam seções). */
  section?: string;
  /**
   * Espaço vazio no fim da última página de uma seção da Distribuição, onde
   * entra a imagem da marca escolhida no editor.
   */
  filler?: { section: string; y: number; height: number };
};

/** Altura mínima da sobra para valer pôr a imagem da marca. */
export const MIN_FILLER_HEIGHT = 90;
const FILLER_GAP = 14;

export const isDistribution = (department: string) => /distribui/i.test(department);

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
  const departmentRank = (d: string) => (isDistribution(d) ? 0 : 1);
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
 * Fileiras de uma categoria: sempre 5 produtos por fileira, na ordem por
 * semelhança (só a última da categoria pode ficar incompleta). Partir o
 * tipo em fileiras próprias deixava fileiras de 3 e 4 no meio da página.
 */
export function packRows(group: PdfProduct[]) {
  const rows: PdfProduct[][] = [];
  for (let i = 0; i < group.length; i += GRID.columns) rows.push(group.slice(i, i + GRID.columns));
  return rows;
}

/**
 * Aperta as fileiras da página para caber mais uma (a última de uma
 * categoria, com 1 ou 2 produtos). Devolve false se nem apertando couber.
 */
function squeezeOneMoreRow(page: PdfPage, area: PdfArea) {
  const rows = page.blocks.filter((b) => b.type === 'row').length + 1;
  const bars = page.blocks.filter((b) => b.type === 'bar').length;
  const height = Math.floor((area.bottom - area.top - bars * GRID.barHeight) / rows);
  if (height < GRID.minRowHeight) return null;
  let y = area.top;
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
/** Faixa vertical da página onde entram os produtos (muda com o layout). */
export type PdfArea = { top: number; bottom: number };

export function planCatalogPdf(
  products: PdfProduct[],
  area: PdfArea = { top: GRID.top, bottom: GRID.bottom },
): PdfPage[] {
  const pages: PdfPage[] = [];
  let page: PdfPage | null = null;
  let y = 0;
  let department = '';
  let section = '';
  const sorted = sortForCatalog(products.filter((p) => p.image));
  const newPage = (title: string, label: string, pageSection?: string): PdfPage => {
    const created: PdfPage = { number: pages.length + 1, title, label, blocks: [], section: pageSection };
    pages.push(created);
    page = created;
    y = area.top;
    return created;
  };
  const fits = (height: number) => y + height <= area.bottom;

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
    // Distribuição: cada seção (marca) começa na própria página; a sobra da
    // última página fica para a imagem da marca. Atacado segue como antes.
    const ownPage = isDistribution(first.department) ? first.section : undefined;
    let current = page as PdfPage | null;
    if (!current) current = newPage(sectionTitle, categoryTitle, ownPage);
    else if (newSection && (ownPage || current.section))
      current = newPage(sectionTitle, categoryTitle, ownPage);
    else if (current.blocks.length) {
      // Seção pequena não ganha página só para ela (era o maior buraco do
      // PDF): entra na mesma página com uma divisória, se couberem a
      // divisória e uma fileira de produtos.
      const needed = GRID.barHeight + Math.min(rows, 1) * GRID.rowHeight;
      if (!fits(needed)) current = newPage(sectionTitle, categoryTitle, ownPage);
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
            ? squeezeOneMoreRow(current!, area)
            : null;
        if (squeezed) {
          current!.blocks.push({ type: 'row', products, y: squeezed.y, height: squeezed.height });
          y = area.bottom;
          return;
        }
        current = newPage(sectionTitle, categoryTitle, ownPage);
      }
      current!.blocks.push({ type: 'row', products, y });
      y += GRID.rowHeight;
    });
  }
  pages.forEach((p, i) => {
    const next = pages[i + 1];
    // Última página de uma seção da Distribuição: guarda a sobra para a imagem.
    if (p.section && next?.section !== p.section) {
      const last = p.blocks.at(-1);
      const end = last ? last.y + blockHeight(last) : area.top;
      const height = area.bottom - end - FILLER_GAP;
      if (height >= MIN_FILLER_HEIGHT)
        p.filler = { section: p.section, y: end + FILLER_GAP, height };
      return;
    }
    if (next) spreadSlack(p, area);
  });
  return pages;
}

/**
 * Página que quebrou por falta de espaço espalha a sobra entre os blocos, em
 * vez de deixar uma faixa branca antes do rodapé. Página que terminou porque
 * o conteúdo acabou (sobra grande) fica alinhada em cima.
 */
function spreadSlack(page: PdfPage, area: PdfArea) {
  const last = page.blocks.at(-1);
  if (!last || page.blocks.length < 2) return;
  const end = last.y + blockHeight(last);
  const slack = area.bottom - end;
  if (slack <= 0 || slack >= GRID.barHeight + GRID.rowHeight) return;
  const gap = Math.min(slack / (page.blocks.length - 1), 40);
  page.blocks.forEach((block, i) => {
    block.y += gap * i;
  });
}

export type ContentsEntry = {
  level: 'department' | 'section' | 'category';
  title: string;
  page: number;
};

/**
 * Sumário (página depois da capa): departamento, seção e categoria com a
 * página em que cada um começa, na ordem do catálogo.
 */
export function planContents(pages: PdfPage[]): ContentsEntry[] {
  const entries: ContentsEntry[] = [];
  const seen = new Set<string>();
  const add = (level: ContentsEntry['level'], key: string, title: string, page: number) => {
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ level, title, page });
  };
  for (const page of pages)
    for (const block of page.blocks) {
      if (block.type !== 'row') continue;
      for (const p of block.products) {
        const department = isDistribution(p.department) ? 'Distribuição' : displayName(p.department);
        add('department', p.department, department, page.number);
        add('section', `${p.department}|${p.section}`, displayName(p.section), page.number);
        add(
          'category',
          `${p.department}|${p.section}|${p.category}`,
          displayName(p.category),
          page.number,
        );
      }
    }
  return entries;
}
