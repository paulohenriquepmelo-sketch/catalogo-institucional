import type { Product } from './catalog-data';
import { displayName } from './catalog-pdf';

type ListProduct = Pick<Product, 'code' | 'name' | 'brand' | 'category'>;

const codeNumber = (code: string) => Number(code.replace(/\D/g, '')) || 0;

/** Ordem da lista: código do ERP, do menor para o maior. */
export function sortNoPhotoList<T extends ListProduct>(products: T[]) {
  return [...products].sort(
    (a, b) => codeNumber(a.code) - codeNumber(b.code) || a.code.localeCompare(b.code),
  );
}

/**
 * Lista dos produtos publicados sem foto, em PDF A4, para conferir ou
 * mandar fotografar. Gerada no navegador; Helvetica padrão (cobre acentos).
 */
export async function renderNoPhotoPdf(products: ListProduct[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const rows = sortNoPhotoList(products);
  const left = 36;
  const right = 559;
  const columns = [
    { title: 'Código', x: left, width: 44 },
    { title: 'Produto', x: left + 48, width: 222 },
    { title: 'Marca', x: left + 276, width: 92 },
    { title: 'Categoria', x: left + 374, width: right - left - 374 },
  ];
  const lineHeight = 17;
  const bottom = 800;
  const date = new Date().toLocaleDateString('pt-BR');
  const fit = (text: string, width: number) => {
    if (doc.getTextWidth(text) <= width) return text;
    let cut = text;
    while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > width) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}…`;
  };

  let page = 0;
  let y = 0;
  const header = () => {
    if (page) doc.addPage();
    page++;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(32, 57, 118);
    doc.text('Produtos publicados sem foto', left, 48);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(93, 106, 133);
    doc.text(`${rows.length} produtos · gerado em ${date}`, left, 64);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 33, 61);
    for (const c of columns) doc.text(c.title, c.x, 90);
    doc.setDrawColor(214, 222, 236);
    doc.line(left, 96, right, 96);
    y = 112;
  };
  header();
  doc.setFont('helvetica', 'normal');
  rows.forEach((p, i) => {
    if (y > bottom) {
      header();
      doc.setFont('helvetica', 'normal');
    }
    if (i % 2 === 0) {
      doc.setFillColor(243, 245, 250);
      doc.rect(left - 4, y - 12, right - left + 8, lineHeight, 'F');
    }
    doc.setTextColor(21, 33, 61);
    const values = [
      p.code,
      p.name,
      p.brand,
      displayName(p.category),
    ];
    columns.forEach((c, j) => doc.text(fit(values[j], c.width), c.x, y));
    y += lineHeight;
  });
  if (!rows.length) doc.text('Nenhum produto publicado sem foto.', left, y);
  const total = doc.getNumberOfPages();
  for (let n = 1; n <= total; n++) {
    doc.setPage(n);
    doc.setFontSize(8);
    doc.setTextColor(93, 106, 133);
    doc.text(`Página ${n} de ${total}`, right, 822, { align: 'right' });
  }
  doc.setProperties({ title: 'Produtos publicados sem foto', creator: 'Catálogo Laurencini' });
  return doc.output('blob');
}
