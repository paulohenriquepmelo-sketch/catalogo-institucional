import { GRID, PAGE, planCatalogPdf, type PdfPage, type PdfProduct } from './catalog-pdf';

// Medidas e cores tiradas do catálogo impresso (pontos, A4).
const NAVY = '#1e3a81';
const RED = '#ed1c23';
const CODE = '#091452';
const TEXT = '#231f20';
const WHITE = '#ffffff';
const IMAGE_BOX = 80;
/** Lado maior da foto no PDF: ~250 dpi no cartão, ~15 KB por foto. */
const IMAGE_PIXELS = 260;
/** Versão para editar e imprimir (CorelDRAW): ~540 dpi no cartão. */
const PRINT_PIXELS = 600;
const PARALLEL = 6;
const ASSETS = '/catalog-pdf';
const INSTAGRAM = 'distlaurencini.atacado';
const REGULAR = 'Poppins-Regular';
const BOLD = 'Poppins-Bold';

export type CatalogPdfOptions = {
  /** Fotos em alta para gráfica e edição no CorelDRAW (arquivo bem maior). */
  print?: boolean;
  /** Nome da seleção na capa (segmento, marca, busca). Vazio = catálogo completo. */
  title?: string;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
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
async function loadPhoto(url: string, print: boolean, signal?: AbortSignal): Promise<Photo | null> {
  try {
    const bitmap = await createImageBitmap(new Blob([await fetchBytes(url, signal)]));
    const limit = print ? PRINT_PIXELS : IMAGE_PIXELS;
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

function drawProduct(doc: Doc, product: PdfProduct, photo: Photo | null, x: number, y: number) {
  const cell = (PAGE.width - GRID.marginX * 2) / GRID.columns;
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
  doc.setFontSize(10.5);
  doc.text(product.code, center, top + IMAGE_BOX + 13, { align: 'center' });
  doc.setTextColor(TEXT);
  doc.setFont(BOLD, 'normal');
  doc.setFontSize(5.8);
  const lines = (doc.splitTextToSize(product.name, cell - 10) as string[]).slice(0, 3);
  doc.text(lines, center, top + IMAGE_BOX + 21, { align: 'center', lineHeightFactor: 1.15 });
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

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
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

  drawCover(doc, new Uint8Array(cover), options.title ?? '', withPhoto.length);
  const cell = (PAGE.width - GRID.marginX * 2) / GRID.columns;
  for (const page of planCatalogPdf(withPhoto)) {
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
          );
        });
    }
    drawFooter(doc, page);
  }
  return doc.output('blob');
}
