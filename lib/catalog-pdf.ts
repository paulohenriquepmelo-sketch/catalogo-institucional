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

/** Produtos por fileira: 5 (padrão, igual ao impresso), 4 ou 3 com fotos maiores. */
export type PdfColumns = 3 | 4 | 5;
export const PDF_COLUMNS: PdfColumns[] = [5, 4, 3];
/**
 * Medidas da fileira por número de colunas. Com menos colunas a célula fica
 * mais larga e a foto cresce até a largura da célula (menos o respiro); o
 * texto cresce um pouco (`textScale`). A altura da fileira se ajusta à área
 * da página para caber um número inteiro de fileiras, sem faixa branca no
 * fim. `pixels` é o lado máximo da foto no PDF de tela, maior quando a foto
 * cresce, mas limitado para o arquivo não passar dos 90 MB que o servidor
 * aceita. Com 5 colunas as medidas são fixas (as do impresso).
 */
export type PdfGrid = {
  columns: PdfColumns;
  rowHeight: number;
  minRowHeight: number;
  imageBox: number;
  textScale: number;
  pixels: number;
};
/** Fileira mais alta (foto do tamanho da célula) e espaço do código e nome. */
const LARGER: Record<3 | 4, { maxRow: number; text: number; textScale: number; pixels: number }> = {
  4: { maxRow: 152, text: 48, textScale: 1.1, pixels: 340 },
  3: { maxRow: 203, text: 54, textScale: 1.25, pixels: 400 },
};
export function gridFor(columns: PdfColumns = 5, area: PdfArea = DEFAULT_AREA): PdfGrid {
  if (columns === 5)
    return { columns, rowHeight: GRID.rowHeight, minRowHeight: GRID.minRowHeight, imageBox: 80, textScale: 1, pixels: 260 };
  const { maxRow, text, textScale, pixels } = LARGER[columns];
  const height = area.bottom - area.top;
  const rows = Math.max(1, Math.round(height / maxRow));
  const rowHeight = Math.min(maxRow, Math.floor(height / rows));
  return { columns, rowHeight, minRowHeight: rowHeight - 18, imageBox: rowHeight - text, textScale, pixels };
}

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
/**
 * Parte mínima da imagem da marca que precisa aparecer para valer cortar. Nas
 * laterais quase nada: o nome da marca costuma ir de um lado ao outro.
 */
const FILLER_MIN_HEIGHT = 0.75;
const FILLER_MIN_WIDTH = 0.95;

export type FillerFit = { x: number; y: number; width: number; height: number; cover: boolean };

/**
 * Como a imagem da marca entra no espaço: preenche tudo (corta as bordas) se
 * pouco se perde; senão aparece inteira, centralizada, e o resto do espaço
 * recebe a cor do fundo da imagem. Logo quadrado numa sobra baixa não perde
 * mais o meio do nome.
 */
export function fitFiller(
  image: { width: number; height: number },
  box: { x: number; y: number; width: number; height: number },
): FillerFit {
  const cover = Math.max(box.width / image.width, box.height / image.height);
  const fits =
    box.width / (image.width * cover) >= FILLER_MIN_WIDTH &&
    box.height / (image.height * cover) >= FILLER_MIN_HEIGHT;
  const scale = fits ? cover : Math.min(box.width / image.width, box.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
    cover: fits,
  };
}

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
 * Fileiras de uma categoria: sempre 5 (ou 4, ou 3) produtos por fileira, na ordem por
 * semelhança (só a última da categoria pode ficar incompleta). Partir o
 * tipo em fileiras próprias deixava fileiras de 3 e 4 no meio da página.
 */
export function packRows(group: PdfProduct[], columns: number = GRID.columns) {
  const rows: PdfProduct[][] = [];
  for (let i = 0; i < group.length; i += columns) rows.push(group.slice(i, i + columns));
  return rows;
}

/**
 * Aperta as fileiras da página para caber mais uma (a última de uma
 * categoria, com 1 ou 2 produtos). Devolve false se nem apertando couber.
 */
function squeezeOneMoreRow(page: PdfPage, area: PdfArea, grid: PdfGrid) {
  const rows = page.blocks.filter((b) => b.type === 'row').length + 1;
  const bars = page.blocks.filter((b) => b.type === 'bar').length;
  const height = Math.floor((area.bottom - area.top - bars * GRID.barHeight) / rows);
  if (height < grid.minRowHeight) return null;
  let y = area.top;
  for (const block of page.blocks) {
    block.y = y;
    if (block.type === 'bar') y += GRID.barHeight;
    else {
      block.height = Math.min(height, grid.rowHeight);
      y += block.height;
    }
  }
  return { y, height: Math.min(height, grid.rowHeight) };
}

const blockHeight = (block: PdfBlock, grid: PdfGrid) =>
  block.type === 'bar' ? GRID.barHeight : (block.height ?? grid.rowHeight);

/** Páginas de produtos (a capa não conta: a primeira página de produtos é a 01). */
/** Faixa vertical da página onde entram os produtos (muda com o layout). */
export type PdfArea = { top: number; bottom: number };
const DEFAULT_AREA: PdfArea = { top: GRID.top, bottom: GRID.bottom };
/** Área dos produtos no layout modelo (cabeçalho e título são mais altos). */
export const MODELO_AREA: PdfArea = { top: 134, bottom: 786 };

export function planCatalogPdf(
  products: PdfProduct[],
  area: PdfArea = DEFAULT_AREA,
  columns: PdfColumns = 5,
): PdfPage[] {
  const grid = gridFor(columns, area);
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
    const packed = packRows(group, grid.columns);
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
      const needed = GRID.barHeight + Math.min(rows, 1) * grid.rowHeight;
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
      if (!fits(grid.rowHeight)) {
        // Última fileira da categoria com 1 ou 2 produtos: aperta a página em
        // vez de deixá-los sozinhos na seguinte.
        const squeezed =
          r === packed.length - 1 && r > 0 && products.length <= 2
            ? squeezeOneMoreRow(current!, area, grid)
            : null;
        if (squeezed) {
          current!.blocks.push({ type: 'row', products, y: squeezed.y, height: squeezed.height });
          y = area.bottom;
          return;
        }
        current = newPage(sectionTitle, categoryTitle, ownPage);
      }
      current!.blocks.push({ type: 'row', products, y });
      y += grid.rowHeight;
    });
  }
  pages.forEach((p, i) => {
    const next = pages[i + 1];
    // Última página de uma seção da Distribuição: guarda a sobra para a imagem.
    if (p.section && next?.section !== p.section) {
      const last = p.blocks.at(-1);
      const end = last ? last.y + blockHeight(last, grid) : area.top;
      const height = area.bottom - end - FILLER_GAP;
      if (height >= MIN_FILLER_HEIGHT)
        p.filler = { section: p.section, y: end + FILLER_GAP, height };
      return;
    }
    if (next) spreadSlack(p, area, grid);
  });
  return pages;
}

/**
 * Página que quebrou por falta de espaço espalha a sobra entre os blocos, em
 * vez de deixar uma faixa branca antes do rodapé. Página que terminou porque
 * o conteúdo acabou (sobra grande) fica alinhada em cima.
 */
function spreadSlack(page: PdfPage, area: PdfArea, grid: PdfGrid) {
  const last = page.blocks.at(-1);
  if (!last || page.blocks.length < 2) return;
  const end = last.y + blockHeight(last, grid);
  const slack = area.bottom - end;
  if (slack <= 0 || slack >= GRID.barHeight + grid.rowHeight) return;
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
