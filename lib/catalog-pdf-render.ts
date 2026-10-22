import {
  GRID,
  isDistribution,
  PAGE,
  planCatalogPdf,
  planContents,
  type ContentsEntry,
  type PdfPage,
  type PdfProduct,
} from './catalog-pdf';

// Cores da marca (catálogo impresso da Laurencini) e tons de apoio.
const NAVY = '#1e3a81';
const NAVY_SOFT = '#b9c6e6';
const RED = '#ed1c23';
const INK = '#1b2340';
const MUTED = '#6b7591';
const LINE = '#dde3ef';
const TINT = '#eef2f9';
const WHITE = '#ffffff';
const BASE_IMAGE_BOX = 80;
/** Lado maior da foto no PDF: ~250 dpi no cartão, ~15 KB por foto. */
const IMAGE_PIXELS = 260;
/** Versão para editar e imprimir (CorelDRAW): ~540 dpi no cartão. */
const PRINT_PIXELS = 600;
const PARALLEL = 6;
const ASSETS = '/catalog-pdf';
const INSTAGRAM = '@distlaurencini.atacado';
const REGULAR = 'Poppins-Regular';
const BOLD = 'Poppins-Bold';

export type CatalogPdfOptions = {
  /** Fotos em alta para gráfica e edição no CorelDRAW (arquivo bem maior). */
  print?: boolean;
  /** Nome da seleção na capa (segmento, marca, busca). Vazio = catálogo completo. */
  title?: string;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  /** Imagem da marca por seção da Distribuição (preenche a sobra da seção). */
  sectionImages?: Record<string, string>;
};
type Photo = { data: Uint8Array; width: number; height: number };

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
async function loadPhoto(
  url: string,
  print: boolean,
  signal?: AbortSignal,
  limit = print ? PRINT_PIXELS : IMAGE_PIXELS,
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
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', print ? 0.9 : 0.8),
    );
    if (!blob) return null;
    return { data: new Uint8Array(await blob.arrayBuffer()), width, height };
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

async function loadPhotos(products: PdfProduct[], options: CatalogPdfOptions) {
  const photos = new Map<number, Photo | null>();
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < products.length) {
      const product = products[next++];
      photos.set(product.id, await loadPhoto(product.image, !!options.print, options.signal));
      options.onProgress?.(++done, products.length);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return photos;
}

// Diminui a fonte até o texto caber (título de seção ou categoria longo).
function fitText(doc: Doc, text: string, size: number, maxWidth: number, min = 7) {
  let current = size;
  doc.setFontSize(current);
  while (current > min && doc.getTextWidth(text) > maxWidth) doc.setFontSize((current -= 0.5));
}

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
function drawHeader(doc: Doc, page: PdfPage) {
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
function drawFooter(doc: Doc, page: PdfPage) {
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
  const social = `  ·  ${INSTAGRAM}`;
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
function drawBar(doc: Doc, title: string, y: number) {
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

function drawProduct(
  doc: Doc,
  product: PdfProduct,
  photo: Photo | null,
  x: number,
  y: number,
  // Fileira apertada (veja squeezeOneMoreRow): a foto diminui o que faltou.
  rowHeight: number = GRID.rowHeight,
) {
  const imageBox = BASE_IMAGE_BOX - (GRID.rowHeight - rowHeight);
  const cell = (PAGE.width - GRID.marginX * 2) / GRID.columns;
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
  const codeY = top + imageBox + 11;
  doc.setTextColor(NAVY);
  doc.setFont(BOLD, 'normal');
  doc.setFontSize(9.5);
  doc.text(product.code, left, codeY);
  const codeWidth = doc.getTextWidth(product.code);

  const packaging = packagingLabel(product);
  if (packaging) {
    doc.setFont(REGULAR, 'normal');
    fitText(doc, packaging, 5.4, inner - codeWidth - 10, 4.2);
    const w = doc.getTextWidth(packaging) + 6;
    const pillX = card.x + card.w - pad - w;
    doc.setFillColor(TINT);
    doc.roundedRect(pillX, codeY - 7, w, 9, 2, 2, 'F');
    doc.setTextColor(MUTED);
    doc.text(packaging, pillX + 3, codeY - 0.8);
  }

  doc.setTextColor(INK);
  doc.setFont(BOLD, 'normal');
  doc.setFontSize(5.6);
  const lines = (doc.splitTextToSize(product.name, inner) as string[]).slice(0, 3);
  doc.text(lines, left, codeY + 8.5, { lineHeightFactor: 1.15 });
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

// Imagem da marca na sobra da última página da seção: de uma borda à outra
// da folha, sem distorcer. Se for mais alta que a sobra, corta o excesso de
// cima e de baixo (fica o meio); se for mais baixa, fica centralizada.
function drawFiller(doc: Doc, image: Photo, area: { y: number; height: number }, key: string) {
  const w = PAGE.width;
  const h = (image.height * w) / image.width;
  doc.saveGraphicsState();
  doc.rect(0, area.y, w, area.height, null);
  doc.clip();
  doc.discardPath();
  doc.addImage(image.data, 'JPEG', 0, area.y + (area.height - h) / 2, w, h, key, 'FAST');
  doc.restoreGraphicsState();
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
  const photos = await loadPhotos(withPhoto, options);
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
    const image = await loadPhoto(url, false, options.signal, options.print ? 2400 : 1400);
    if (image) fillers.set(section, image);
  }

  drawCover(doc, new Uint8Array(cover), options.title ?? '', withPhoto.length);
  const pages = planCatalogPdf(withPhoto);
  doc.addPage();
  drawContents(doc, planContents(pages), options.title ?? '');
  const cell = (PAGE.width - GRID.marginX * 2) / GRID.columns;
  for (const page of pages) {
    doc.addPage();
    drawHeader(doc, page);
    for (const block of page.blocks) {
      if (block.type === 'bar') drawBar(doc, block.title, block.y);
      else
        block.products.forEach((product, i) => {
          // Linha incompleta fica centralizada, como no impresso.
          const offset = ((GRID.columns - block.products.length) * cell) / 2;
          drawProduct(
            doc,
            product,
            photos.get(product.id) ?? null,
            GRID.marginX + offset + i * cell,
            block.y,
            block.height,
          );
        });
    }
    const filler = page.filler && fillers.get(page.filler.section);
    if (page.filler && filler) drawFiller(doc, filler, page.filler, `f${page.number}`);
    drawFooter(doc, page);
  }
  return doc.output('blob');
}
