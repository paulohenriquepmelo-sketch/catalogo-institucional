import {
  fitFiller,
  GRID,
  gridFor,
  isDistribution,
  PAGE,
  planCatalogPdf,
  type PdfColumns,
  type PdfGrid,
  MODELO_AREA,
  planContents,
  type ContentsEntry,
  type PdfPage,
  type PdfProduct,
} from './catalog-pdf';

// Medidas e cores tiradas do catálogo impresso (pontos, A4).
const NAVY = '#1e3a81';
const RED = '#ed1c23';
const CODE = '#091452';
const TEXT = '#231f20';
const WHITE = '#ffffff';
// Tons de apoio do layout moderno.
const NAVY_SOFT = '#b9c6e6';
const INK = '#1b2340';
const MUTED = '#6b7591';
const LINE = '#dde3ef';
const TINT = '#eef2f9';
/** Lado maior da foto (imagens das marcas usam o próprio limite; produtos, o da grade). */
const IMAGE_PIXELS = 260;
/** Versão para editar e imprimir (CorelDRAW): ~540 dpi no cartão de 5 por fileira. */
const PRINT_PIXELS = 600;
const PARALLEL = 6;
const ASSETS = '/catalog-pdf';
const INSTAGRAM = 'distlaurencini.atacado';
const REGULAR = 'Poppins-Regular';
const BOLD = 'Poppins-Bold';

export type CatalogPdfLayout = 'classico' | 'moderno' | 'modelo';

export type CatalogPdfOptions = {
  /** Clássico (o do impresso, padrão) ou moderno (cartões e sumário). */
  layout?: CatalogPdfLayout;
  /** Produtos por fileira: 5 (padrão), 4 ou 3 com fotos maiores. */
  columns?: PdfColumns;
  /** Fotos em alta para gráfica e edição no CorelDRAW (arquivo bem maior). */
  print?: boolean;
  /** Nome da seleção na capa (segmento, marca, busca). Vazio = catálogo completo. */
  title?: string;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  /** Imagem da marca por seção da Distribuição (preenche a sobra da seção). */
  sectionImages?: Record<string, string>;
};
type Photo = {
  data: Uint8Array;
  width: number;
  height: number;
  /** Cor da borda da imagem (só nas imagens das marcas); branco se variada. */
  background?: string;
};

type Doc = import('jspdf').jsPDF;

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}

async function fetchBytes(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Falha ao baixar ${url}.`);
  return response.arrayBuffer();
}

// Foto do produto (WebP) → JPEG pequeno com fundo branco, que todo leitor de PDF abre.
// Cor média da borda da imagem, se for quase lisa (fundo do logo); senão
// branco. Preenche o espaço que sobra ao lado de uma imagem que não é cortada.
function borderColor(context: CanvasRenderingContext2D, width: number, height: number) {
  const strips = [
    context.getImageData(0, 0, width, 1),
    context.getImageData(0, height - 1, width, 1),
    context.getImageData(0, 0, 1, height),
    context.getImageData(width - 1, 0, 1, height),
  ];
  const pixels: number[][] = [];
  for (const { data } of strips)
    for (let i = 0; i < data.length; i += 4) pixels.push([data[i], data[i + 1], data[i + 2]]);
  const mean = [0, 1, 2].map((c) => pixels.reduce((sum, px) => sum + px[c], 0) / pixels.length);
  const spread =
    pixels.reduce((sum, px) => sum + Math.abs(px[0] - mean[0]) + Math.abs(px[1] - mean[1]) + Math.abs(px[2] - mean[2]), 0) /
    pixels.length;
  if (spread > 40) return WHITE;
  return `#${mean.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

async function loadPhoto(
  url: string,
  print: boolean,
  signal?: AbortSignal,
  limit = print ? PRINT_PIXELS : IMAGE_PIXELS,
  withBackground = false,
): Promise<Photo | null> {
  try {
    const bitmap = await createImageBitmap(new Blob([await fetchBytes(url, signal)]));
    const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;
    context.fillStyle = WHITE;
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const background = withBackground ? borderColor(context, width, height) : undefined;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', print ? 0.9 : 0.8),
    );
    if (!blob) return null;
    return { data: new Uint8Array(await blob.arrayBuffer()), width, height, background };
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

async function loadPhotos(products: PdfProduct[], options: CatalogPdfOptions, grid: PdfGrid) {
  // Foto maior com menos colunas; para gráfica já vai em alta em qualquer grade.
  const limit = options.print ? PRINT_PIXELS : grid.pixels;
  const photos = new Map<number, Photo | null>();
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < products.length) {
      const product = products[next++];
      photos.set(product.id, await loadPhoto(product.image, !!options.print, options.signal, limit));
      options.onProgress?.(++done, products.length);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return photos;
}

function polygon(doc: Doc, points: [number, number][]) {
  const [first, ...rest] = points;
  let [x, y] = first;
  const deltas = rest.map(([px, py]) => {
    const delta: [number, number] = [px - x, py - y];
    [x, y] = [px, py];
    return delta;
  });
  doc.lines(deltas, first[0], first[1], [1, 1], 'F', true);
}

// Diminui a fonte até o texto caber (título de seção ou categoria longo).
function fitText(doc: Doc, text: string, size: number, maxWidth: number, min = 7) {
  let current = size;
  doc.setFontSize(current);
  while (current > min && doc.getTextWidth(text) > maxWidth) doc.setFontSize((current -= 0.5));
}

function drawHeader(doc: Doc, page: PdfPage) {
  const mid = PAGE.width / 2;
  doc.setFillColor(RED);
  doc.rect(0, 0, PAGE.width, 23, 'F');
  doc.setFillColor(NAVY);
  polygon(doc, [
    [mid - 149, 0],
    [mid + 149, 0],
    [mid + 100, 38],
    [mid - 100, 38],
  ]);
  doc.setTextColor(WHITE);
  doc.setFont(BOLD, 'normal');
  fitText(doc, page.title, 15, 190);
  doc.text(page.title, mid, 25, { align: 'center' });
  doc.setFont(REGULAR, 'normal');
  fitText(doc, page.label, 10.5, mid - 165);
  doc.text(page.label, 16, 16);
}

function drawFooter(doc: Doc, page: PdfPage) {
  doc.setFillColor(NAVY);
  doc.rect(0, 819, PAGE.width, PAGE.height - 819, 'F');
  doc.setFillColor(RED);
  doc.roundedRect(PAGE.width / 2 - 111, 808, 222, 40, 4, 4, 'F');
  doc.setTextColor(WHITE);
  doc.setFont(BOLD, 'normal');
  doc.setFontSize(14);
  doc.text(String(page.number).padStart(2, '0'), PAGE.width / 2, 831, { align: 'center' });
  doc.setFont(REGULAR, 'normal');
  doc.setFontSize(7);
  doc.text(INSTAGRAM, 24, 832);
}

function drawBar(doc: Doc, title: string, y: number) {
  const mid = PAGE.width / 2;
  const top = y + 6;
  doc.setFillColor(RED);
  doc.rect(0, top, PAGE.width, 10, 'F');
  doc.setFillColor(NAVY);
  polygon(doc, [
    [mid - 150, top],
    [mid + 150, top],
    [mid + 101, top + 25],
    [mid - 101, top + 25],
  ]);
  doc.setTextColor(WHITE);
  doc.setFont(REGULAR, 'normal');
  fitText(doc, title, 11.5, 190);
  doc.text(title, mid, top + 17, { align: 'center' });
}

function drawProduct(
  doc: Doc,
  product: PdfProduct,
  photo: Photo | null,
  x: number,
  y: number,
  grid: PdfGrid,
  // Fileira apertada (veja squeezeOneMoreRow): a foto diminui o que faltou.
  rowHeight: number = grid.rowHeight,
) {
  const IMAGE_BOX = grid.imageBox - (grid.rowHeight - rowHeight);
  const cell = (PAGE.width - GRID.marginX * 2) / grid.columns;
  const s = grid.textScale;
  const center = x + cell / 2;
  const top = y + 6;
  if (photo) {
    const scale = Math.min(IMAGE_BOX / photo.width, IMAGE_BOX / photo.height);
    const w = photo.width * scale;
    const h = photo.height * scale;
    doc.addImage(
      photo.data,
      'JPEG',
      center - w / 2,
      top + (IMAGE_BOX - h) / 2,
      w,
      h,
      `p${product.id}`,
      'FAST',
    );
  } else {
    doc.setDrawColor('#d6deec');
    doc.rect(center - IMAGE_BOX / 2, top, IMAGE_BOX, IMAGE_BOX, 'S');
    doc.setTextColor('#8a94a8');
    doc.setFont(REGULAR, 'normal');
    doc.setFontSize(6);
    doc.text('Foto indisponível', center, top + IMAGE_BOX / 2, { align: 'center' });
  }
  doc.setTextColor(CODE);
  doc.setFont(BOLD, 'normal');
  doc.setFontSize(10.5 * s);
  doc.text(product.code, center, top + IMAGE_BOX + 13 * s, { align: 'center' });
  doc.setTextColor(TEXT);
  doc.setFont(BOLD, 'normal');
  doc.setFontSize(5.8 * s);
  const lines = (doc.splitTextToSize(product.name, cell - 10) as string[]).slice(0, 3);
  doc.text(lines, center, top + IMAGE_BOX + 21 * s, { align: 'center', lineHeightFactor: 1.15 });
}

// ---- Layout moderno: faixa reta, cartões, embalagem e sumário. ----

const CONTENT_LEFT = GRID.marginX;
const CONTENT_RIGHT = PAGE.width - GRID.marginX;

/** Departamento da página (vai pequeno acima do nome da seção). */
function pageDepartment(page: PdfPage) {
  for (const block of page.blocks)
    if (block.type === 'row' && block.products[0])
      return isDistribution(block.products[0].department) ? 'DISTRIBUIÇÃO' : 'ATACADO';
  return '';
}

// Topo: faixa azul com departamento, seção (marca) e a categoria à direita,
// fio vermelho embaixo.
function drawHeaderModern(doc: Doc, page: PdfPage) {
  doc.setFillColor(NAVY);
  doc.rect(0, 0, PAGE.width, 34, 'F');
  doc.setFillColor(RED);
  doc.rect(0, 34, PAGE.width, 2.5, 'F');
  doc.rect(0, 0, 8, 34, 'F');
  doc.setTextColor(NAVY_SOFT);
  doc.setFont(REGULAR, 'normal');
  doc.setFontSize(6.2);
  doc.text(pageDepartment(page), CONTENT_LEFT, 12.5, { charSpace: 0.8 });
  doc.setTextColor(WHITE);
  doc.setFont(BOLD, 'normal');
  fitText(doc, page.title, 13, 300);
  doc.text(page.title, CONTENT_LEFT, 26.5);
  doc.setFont(REGULAR, 'normal');
  fitText(doc, page.label, 8.5, 200);
  doc.text(page.label, CONTENT_RIGHT, 22, { align: 'right' });
}

// Rodapé: número na borda externa (ímpar à direita, como na página da
// direita do livro aberto: capa e sumário vêm antes da 01) e a marca do
// outro lado.
function drawFooterModern(doc: Doc, page: PdfPage) {
  const outerRight = page.number % 2 === 1;
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.6);
  doc.line(CONTENT_LEFT, 811, CONTENT_RIGHT, 811);
  const box = { w: 28, h: 18 };
  const boxX = outerRight ? CONTENT_RIGHT - box.w : CONTENT_LEFT;
  doc.setFillColor(RED);
  doc.roundedRect(boxX, 818, box.w, box.h, 3, 3, 'F');
  doc.setTextColor(WHITE);
  doc.setFont(BOLD, 'normal');
  doc.setFontSize(10);
  doc.text(String(page.number).padStart(2, '0'), boxX + box.w / 2, 830.5, { align: 'center' });

  doc.setFont(BOLD, 'normal');
  doc.setFontSize(7.5);
  const brand = 'Distribuidora Laurencini';
  const brandWidth = doc.getTextWidth(brand);
  doc.setFont(REGULAR, 'normal');
  doc.setFontSize(7);
  const social = `  ·  @${INSTAGRAM}`;
  const total = brandWidth + doc.getTextWidth(social);
  const x = outerRight ? CONTENT_LEFT : CONTENT_RIGHT - total;
  doc.setTextColor(NAVY);
  doc.setFont(BOLD, 'normal');
  doc.setFontSize(7.5);
  doc.text(brand, x, 830);
  doc.setTextColor(MUTED);
  doc.setFont(REGULAR, 'normal');
  doc.setFontSize(7);
  doc.text(social, x + brandWidth, 830);
}

// Divisória de categoria: traço vermelho, título e fio até a margem.
function drawBarModern(doc: Doc, title: string, y: number) {
  const top = y + 14;
  doc.setFillColor(RED);
  doc.rect(CONTENT_LEFT, top, 3, 15, 'F');
  doc.setTextColor(NAVY);
  doc.setFont(BOLD, 'normal');
  fitText(doc, title, 11, 380);
  doc.text(title, CONTENT_LEFT + 9, top + 11.2);
  const end = CONTENT_LEFT + 9 + doc.getTextWidth(title) + 10;
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.6);
  doc.line(end, top + 7.5, CONTENT_RIGHT, top + 7.5);
}

/** "CX 12X01LT": unidade e embalagem master, como vêm do ERP. */
function packagingLabel(product: PdfProduct) {
  const d = product.details;
  if (!d?.masterPackaging) return '';
  return [d.masterUnit, d.masterPackaging].filter(Boolean).join(' ');
}

function drawProductModern(
  doc: Doc,
  product: PdfProduct,
  photo: Photo | null,
  x: number,
  y: number,
  grid: PdfGrid,
  // Fileira apertada (veja squeezeOneMoreRow): a foto diminui o que faltou.
  rowHeight: number = grid.rowHeight,
) {
  const imageBox = grid.imageBox - (grid.rowHeight - rowHeight);
  const cell = (PAGE.width - GRID.marginX * 2) / grid.columns;
  const s = grid.textScale;
  // Cartão em volta do mesmo espaço de antes: a foto mantém o tamanho.
  const card = { x: x + 2, y: y + 1, w: cell - 4, h: rowHeight - 3 };
  const pad = 6;
  const inner = card.w - pad * 2;
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.6);
  doc.setFillColor(WHITE);
  doc.roundedRect(card.x, card.y, card.w, card.h, 5, 5, 'FD');

  const top = y + 6;
  const center = card.x + card.w / 2;
  if (photo) {
    const scale = Math.min(imageBox / photo.width, imageBox / photo.height);
    const w = photo.width * scale;
    const h = photo.height * scale;
    doc.addImage(
      photo.data,
      'JPEG',
      center - w / 2,
      top + (imageBox - h) / 2,
      w,
      h,
      `p${product.id}`,
      'FAST',
    );
  } else {
    doc.setFillColor(TINT);
    doc.roundedRect(card.x + 5, top, card.w - 10, imageBox, 3, 3, 'F');
    doc.setTextColor(MUTED);
    doc.setFont(REGULAR, 'normal');
    doc.setFontSize(6);
    doc.text('Foto indisponível', center, top + imageBox / 2, { align: 'center' });
  }

  const left = card.x + pad;
  const codeY = top + imageBox + 11 * s;
  doc.setTextColor(NAVY);
  doc.setFont(BOLD, 'normal');
  doc.setFontSize(9.5 * s);
  doc.text(product.code, left, codeY);
  const codeWidth = doc.getTextWidth(product.code);

  const packaging = packagingLabel(product);
  if (packaging) {
    doc.setFont(REGULAR, 'normal');
    fitText(doc, packaging, 5.4 * s, inner - codeWidth - 10, 4.2);
    const w = doc.getTextWidth(packaging) + 6;
    const pillX = card.x + card.w - pad - w;
    doc.setFillColor(TINT);
    doc.roundedRect(pillX, codeY - 7 * s, w, 9 * s, 2, 2, 'F');
    doc.setTextColor(MUTED);
    doc.text(packaging, pillX + 3, codeY - 0.8 * s);
  }

  doc.setTextColor(INK);
  doc.setFont(BOLD, 'normal');
  doc.setFontSize(5.6 * s);
  const lines = (doc.splitTextToSize(product.name, inner) as string[]).slice(0, 3);
  doc.text(lines, left, codeY + 8.5 * s, { lineHeightFactor: 1.15 });
}

// Sumário: departamento, seção (com página) e categorias (com pontilhado),
// em duas colunas.
function drawContents(doc: Doc, entries: ContentsEntry[], title: string) {
  doc.setFillColor(NAVY);
  doc.rect(0, 0, PAGE.width, 112, 'F');
  doc.setFillColor(RED);
  doc.rect(0, 112, PAGE.width, 3, 'F');
  doc.rect(0, 0, 8, 112, 'F');
  doc.setTextColor(WHITE);
  doc.setFont(BOLD, 'normal');
  doc.setFontSize(26);
  doc.text('Sumário', CONTENT_LEFT, 70);
  doc.setTextColor(NAVY_SOFT);
  doc.setFont(REGULAR, 'normal');
  doc.setFontSize(9);
  doc.text(
    title ? `Catálogo ${title} · Distribuidora Laurencini` : 'Catálogo de produtos · Distribuidora Laurencini',
    CONTENT_LEFT,
    90,
  );

  const gap = 28;
  const width = (CONTENT_RIGHT - CONTENT_LEFT - gap) / 2;
  const heightOf = (e: ContentsEntry) =>
    e.level === 'department' ? 30 : e.level === 'section' ? 30 : 15;
  const startY = 152;
  const total = entries.reduce((sum, e) => sum + heightOf(e), 0);
  let column = 0;
  let y = startY;
  entries.forEach((entry, i) => {
    // Muda de coluna na metade, sempre antes de um departamento ou seção.
    if (
      column === 0 &&
      i > 0 &&
      entry.level !== 'category' &&
      y - startY + heightOf(entry) > total / 2
    ) {
      column = 1;
      y = startY;
    }
    const x = CONTENT_LEFT + column * (width + gap);
    const right = x + width;
    const page = String(entry.page).padStart(2, '0');
    if (entry.level === 'department') {
      if (y > startY) y += 8;
      doc.setTextColor(RED);
      doc.setFont(BOLD, 'normal');
      doc.setFontSize(7.5);
      doc.text(entry.title.toUpperCase(), x, y, { charSpace: 1 });
      doc.setDrawColor(LINE);
      doc.setLineWidth(0.6);
      doc.line(x, y + 5, right, y + 5);
      y += 20;
      return;
    }
    if (entry.level === 'section') {
      // Respiro antes da seção (menos logo abaixo do departamento).
      if (entries[i - 1]?.level === 'category') y += 10;
      doc.setTextColor(NAVY);
      doc.setFont(BOLD, 'normal');
      fitText(doc, entry.title, 10.5, width - 30);
      doc.text(entry.title, x, y);
      doc.text(page, right, y, { align: 'right' });
      y += 18;
      return;
    }
    doc.setTextColor(INK);
    doc.setFont(REGULAR, 'normal');
    fitText(doc, entry.title, 8.5, width - 50);
    doc.text(entry.title, x + 10, y);
    const textEnd = x + 10 + doc.getTextWidth(entry.title) + 4;
    doc.setTextColor(MUTED);
    const pageWidth = doc.getTextWidth(page);
    doc.text(page, right, y, { align: 'right' });
    doc.setFontSize(6);
    const dot = doc.getTextWidth('. ');
    const dots = Math.max(0, Math.floor((right - pageWidth - 4 - textEnd) / dot));
    if (dots) doc.text('. '.repeat(dots), textEnd, y);
    y += heightOf(entry);
  });
}

// ---- Layout "modelo": logo no topo, faixa azul com o departamento, título
// da seção com traço vermelho, etiqueta da categoria, fundo de polígonos e
// rodapé azul. Usa os cartões e o sumário do layout moderno. ----

const GOLD = '#f2c230';
type ModeloAssets = { background: Uint8Array; logo: Uint8Array };

function drawTagModelo(doc: Doc, title: string, y: number) {
  doc.setFont(BOLD, 'normal');
  fitText(doc, title, 10, 300);
  const w = doc.getTextWidth(title) + 26;
  const left = CONTENT_LEFT - 11;
  doc.setFillColor(NAVY);
  doc.lines(
    [
      [w, 0],
      [-6, 20],
      [-w + 6, 0],
    ],
    left,
    y,
    [1, 1],
    'F',
    true,
  );
  doc.setTextColor(WHITE);
  doc.text(title, left + 10, y + 14);
  doc.setDrawColor(NAVY);
  doc.setLineWidth(0.8);
  doc.line(left + w + 6, y + 10, PAGE.width - 17, y + 10);
}

function drawPageModelo(doc: Doc, page: PdfPage, assets: ModeloAssets) {
  doc.addImage(assets.background, 'JPEG', 0, 0, PAGE.width, PAGE.height, 'fundo', 'FAST');
  // Logo oficial à esquerda.
  doc.addImage(assets.logo, 'PNG', 14, 15, 162, 162 * (151 / 700), 'logo', 'FAST');
  // Faixa azul com canto inclinado à esquerda e ponta vermelha à direita.
  doc.setFillColor(RED);
  doc.rect(300, 50, PAGE.width - 300, 4, 'F');
  doc.setFillColor(NAVY);
  doc.lines(
    [
      [PAGE.width - 207, 0],
      [0, 40],
      [-(PAGE.width - 183), 0],
    ],
    207,
    11,
    [1, 1],
    'F',
    true,
  );
  doc.setFillColor(RED);
  doc.lines(
    [
      [18, 0],
      [0, 46],
      [-34, 0],
    ],
    PAGE.width - 18,
    11,
    [1, 1],
    'F',
    true,
  );
  doc.setTextColor(WHITE);
  doc.setFont(BOLD, 'normal');
  const department = pageDepartment(page) || 'CATÁLOGO';
  fitText(doc, department, 15, 170);
  doc.text(department, 222, 29);
  doc.setTextColor(GOLD);
  doc.setFont(REGULAR, 'normal');
  const sub = `/ ${page.title}`;
  fitText(doc, sub, 10, 180);
  doc.text(sub, 222, 44);
  doc.setTextColor(WHITE);
  doc.setFontSize(8.5);
  doc.text('Atacado e Distribuição', PAGE.width - 40, 34, { align: 'right' });

  // Título da seção com traço vermelho e etiqueta da categoria.
  doc.setFillColor(RED);
  doc.rect(17, 72, 6, 25, 'F');
  doc.setTextColor(NAVY);
  doc.setFont(BOLD, 'normal');
  fitText(doc, page.title, 22, PAGE.width - 80);
  doc.text(page.title, 31, 93);
  drawTagModelo(doc, page.label, 104);
}

function drawFooterModelo(doc: Doc, page: PdfPage) {
  const top = 800;
  doc.setFillColor(NAVY);
  doc.rect(0, top, PAGE.width, PAGE.height - top, 'F');
  doc.setFillColor(RED);
  doc.rect(0, top - 3, 400, 3, 'F');
  // Corte diagonal branco e vermelho entre o número e o Instagram.
  doc.setFillColor(WHITE);
  doc.lines(
    [
      [8, 0],
      [-26, PAGE.height - top],
      [-8, 0],
    ],
    424,
    top,
    [1, 1],
    'F',
    true,
  );
  doc.setFillColor(RED);
  doc.lines(
    [
      [PAGE.width - 432, 0],
      [0, 3],
      [-(PAGE.width - 432), 0],
    ],
    432,
    top - 3,
    [1, 1],
    'F',
    true,
  );
  doc.lines(
    [
      [6, 0],
      [-26, PAGE.height - top],
      [-6, 0],
    ],
    434,
    top,
    [1, 1],
    'F',
    true,
  );
  doc.setTextColor(WHITE);
  doc.setFont(BOLD, 'normal');
  doc.setFontSize(13);
  const number = String(page.number).padStart(2, '0');
  doc.text(number, 20, 826);
  const numberWidth = doc.getTextWidth(number);
  doc.setFont(REGULAR, 'normal');
  doc.setFontSize(11);
  doc.text(`  |  Catálogo de Produtos`, 20 + numberWidth, 826);
  doc.text(`@${INSTAGRAM}`, PAGE.width - 18, 826, { align: 'right' });
}

// Imagem da marca na sobra da última página da seção, sem distorcer. No
// clássico vai de uma borda à outra da folha, como no impresso; no moderno e
// no novo modelo vira um cartão alinhado aos dos produtos (o fundo do modelo
// continua aparecendo nas margens). Corta só um pouco das bordas; se cortaria
// mais (logo quadrado numa sobra baixa), aparece inteira sobre a cor do fundo.
function drawFiller(
  doc: Doc,
  image: Photo,
  area: { y: number; height: number },
  key: string,
  framed: boolean,
) {
  const x = framed ? GRID.marginX + 2 : 0;
  const box = { x, y: area.y, width: PAGE.width - x * 2, height: area.height };
  const fit = fitFiller(image, box);
  const radius = framed ? 5 : 0;
  doc.saveGraphicsState();
  if (radius) doc.roundedRect(box.x, box.y, box.width, box.height, radius, radius, null);
  else doc.rect(box.x, box.y, box.width, box.height, null);
  doc.clip();
  doc.discardPath();
  if (!fit.cover) {
    doc.setFillColor(image.background ?? WHITE);
    doc.rect(box.x, box.y, box.width, box.height, 'F');
  }
  doc.addImage(image.data, 'JPEG', fit.x, fit.y, fit.width, fit.height, key, 'FAST');
  doc.restoreGraphicsState();
  if (framed) {
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.6);
    doc.roundedRect(box.x, box.y, box.width, box.height, radius, radius, 'S');
  }
}

function drawCover(doc: Doc, cover: Uint8Array, title: string, count: number) {
  doc.addImage(cover, 'JPEG', 0, 0, PAGE.width, PAGE.height, 'capa', 'FAST');
  // Texto no painel azul da capa, abaixo do logotipo.
  const x = PAGE.width * 0.69;
  doc.setTextColor(WHITE);
  let y = PAGE.height * 0.64;
  if (title) {
    doc.setFont(BOLD, 'normal');
    doc.setFontSize(17);
    const lines = doc.splitTextToSize(title, PAGE.width * 0.42) as string[];
    doc.text(lines, x, y, { align: 'center' });
    y += lines.length * 21 + 6;
  }
  doc.setFont(REGULAR, 'normal');
  doc.setFontSize(9);
  const date = new Date().toLocaleDateString('pt-BR');
  doc.text(`${count} produtos · atualizado em ${date}`, x, y, { align: 'center' });
}

/** Gera o PDF no navegador. Produtos sem foto ficam de fora, como no impresso. */
export async function renderCatalogPdf(products: PdfProduct[], options: CatalogPdfOptions = {}) {
  const withPhoto = products.filter((p) => p.image);
  const [{ jsPDF }, regular, bold, cover] = await Promise.all([
    import('jspdf'),
    fetchBytes(`${ASSETS}/Poppins-Regular.ttf`, options.signal),
    fetchBytes(`${ASSETS}/Poppins-Bold.ttf`, options.signal),
    fetchBytes(`${ASSETS}/capa.jpg`, options.signal),
  ]);
  const modelo = options.layout === 'modelo';
  const grid = gridFor(options.columns, modelo ? MODELO_AREA : undefined);
  const photos = await loadPhotos(withPhoto, options, grid);
  options.signal?.throwIfAborted();

  // Só as fontes usadas (Poppins): sem isso o jsPDF declara as 14 fontes
  // padrão (Helvetica, Times, Symbol...) e o CorelDRAW pede todas.
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS('Poppins-Regular.ttf', toBase64(regular));
  // Um nome por variação (o nome PostScript real): o CorelDRAW e outros
  // editores casam o texto com a fonte instalada por esse nome.
  doc.addFont('Poppins-Regular.ttf', REGULAR, 'normal');
  doc.addFileToVFS('Poppins-Bold.ttf', toBase64(bold));
  doc.addFont('Poppins-Bold.ttf', BOLD, 'normal');
  doc.setProperties({
    title: options.title ? `Catálogo Laurencini — ${options.title}` : 'Catálogo Laurencini',
    creator: 'Catálogo Laurencini',
  });

  // Imagens das marcas: maiores que as fotos dos produtos (ocupam a largura).
  const fillers = new Map<string, Photo>();
  for (const [section, url] of Object.entries(options.sectionImages ?? {})) {
    const image = await loadPhoto(url, false, options.signal, options.print ? 2400 : 1400, true);
    if (image) fillers.set(section, image);
  }

  drawCover(doc, new Uint8Array(cover), options.title ?? '', withPhoto.length);
  const modern = options.layout === 'moderno' || modelo;
  const pages = planCatalogPdf(withPhoto, modelo ? MODELO_AREA : undefined, grid.columns);
  const modeloAssets: ModeloAssets | null = modelo
    ? {
        background: new Uint8Array(await fetchBytes(`${ASSETS}/fundo-modelo.jpg`, options.signal)),
        logo: new Uint8Array(await fetchBytes(`${ASSETS}/logo-laurencini.png`, options.signal)),
      }
    : null;
  if (modern) {
    doc.addPage();
    drawContents(doc, planContents(pages), options.title ?? '');
  }
  const header = modeloAssets
    ? (d: Doc, p: PdfPage) => drawPageModelo(d, p, modeloAssets)
    : modern
      ? drawHeaderModern
      : drawHeader;
  const bar = modelo ? (d: Doc, title: string, y: number) => drawTagModelo(d, title, y + 12) : modern ? drawBarModern : drawBar;
  const product = modern ? drawProductModern : drawProduct;
  const footer = modelo ? drawFooterModelo : modern ? drawFooterModern : drawFooter;
  const cell = (PAGE.width - GRID.marginX * 2) / grid.columns;
  for (const page of pages) {
    doc.addPage();
    header(doc, page);
    for (const block of page.blocks) {
      if (block.type === 'bar') bar(doc, block.title, block.y);
      else
        block.products.forEach((item, i) => {
          // Linha incompleta fica centralizada, como no impresso.
          const offset = ((grid.columns - block.products.length) * cell) / 2;
          product(
            doc,
            item,
            photos.get(item.id) ?? null,
            GRID.marginX + offset + i * cell,
            block.y,
            grid,
            block.height,
          );
        });
    }
    const filler = page.filler && fillers.get(page.filler.section);
    if (page.filler && filler) drawFiller(doc, filler, page.filler, `f${page.number}`, modern);
    footer(doc, page);
  }
  return doc.output('blob');
}
