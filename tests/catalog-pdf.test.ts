import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayName, GRID, planCatalogPdf, sortForCatalog, type PdfProduct } from '../lib/catalog-pdf';
import { GET as getPdf, POST as postPdf } from '../app/api/catalog-pdf/route';
import { env, setIdentity } from './runtime';

let id = 1;
const make = (name: string, section: string, category: string, department = '1-ATACADO', image = '/x.webp'): PdfProduct => ({
  id: id++,
  code: String(1000 + id),
  name,
  department,
  section,
  category,
  brand: 'MARCA',
  image,
});

void test('catalog pdf: ERP names become page titles', () => {
  assert.equal(displayName('2.1-BALAS & DROPS'), 'Balas & Drops');
  assert.equal(displayName('4-YOKI & KITANO'), 'Yoki & Kitano');
  assert.equal(displayName('FILME PVC/ PAPEL ALUMINIO'), 'Filme PVC/ Papel Aluminio');
  assert.equal(displayName('3.4-AGUA MINERAL'), 'Agua Mineral');
  assert.equal(displayName('1.6-SANTA AMALIA'), 'Santa Amalia');
});

void test('catalog pdf: distribution first, then ERP numbering, then name', () => {
  const list = [
    make('B', '1-ALIMENTOS', '1.10-DEZ'),
    make('A', '1-ALIMENTOS', '1.9-NOVE'),
    make('Z', '2-BOMBONIERI', '2.1-BALAS'),
    make('Y', '4-YOKI & KITANO', 'ALIMENTOS', '2-DISTRIBUICAO'),
  ];
  assert.deepEqual(
    sortForCatalog(list).map((p) => p.name),
    ['Y', 'A', 'B', 'Z'],
  );
});

void test('catalog pdf: small sections share the page, full pages spread the slack, nothing below the footer', () => {
  const list = [
    ...Array.from({ length: 23 }, (_, i) => make(`BALA ${i}`, '2-BOMBONIERI', '2.1-BALAS & DROPS')),
    ...Array.from({ length: 12 }, (_, i) => make(`CHICLE ${i}`, '2-BOMBONIERI', '2.2-CHICLETES')),
    ...Array.from({ length: 40 }, (_, i) => make(`VINHO ${i}`, '4-BEBIDAS ALCOOLICAS', '4.3-VINHOS')),
    make('SEM FOTO', '4-BEBIDAS ALCOOLICAS', '4.3-VINHOS', '1-ATACADO', ''),
  ];
  const pages = planCatalogPdf(list);
  assert.deepEqual(pages.map((p) => p.number), pages.map((_, i) => i + 1));
  assert.equal(pages[0].title, 'Bombonieri');
  assert.equal(pages[0].label, 'Balas & Drops');
  // Chicletes não cabem com uma fileira depois de 5 fileiras de balas: página nova.
  assert.equal(pages[1].label, 'Chicletes');
  // A seção de vinhos começa na mesma página, com divisória "Seção · Categoria".
  assert.ok(pages[1].blocks.some((b) => b.type === 'bar' && b.title === 'Bebidas Alcoolicas · Vinhos'));
  // A continuação leva o nome da seção no topo.
  assert.equal(pages[2].title, 'Bebidas Alcoolicas');
  for (const page of pages)
    for (const block of page.blocks) {
      const height = block.type === 'bar' ? GRID.barHeight : GRID.rowHeight;
      assert.ok(block.y >= GRID.top && block.y + height <= GRID.bottom + 0.001);
      if (block.type === 'row') assert.ok(block.products.length >= 1 && block.products.length <= GRID.columns);
    }
  // Página que quebrou por espaço termina rente ao rodapé (sem faixa branca).
  const full = pages[0];
  const last = full.blocks.at(-1)!;
  assert.ok(GRID.bottom - (last.y + GRID.rowHeight) < 1);
  // Sem foto fica fora; todos os outros aparecem uma vez.
  const shown = pages.flatMap((p) => p.blocks.flatMap((b) => (b.type === 'row' ? b.products : [])));
  assert.equal(shown.length, 75);
  assert.ok(!shown.some((p) => p.name === 'SEM FOTO'));
});

const pdfBytes = new TextEncoder().encode('%PDF-1.7\n% teste\n%%EOF');
const upload = (body: BodyInit, type = 'application/pdf', query = '?products=10&pages=3', origin = 'https://catalog.test') =>
  new Request(`https://catalog.test/api/catalog-pdf${query}`, {
    method: 'POST',
    headers: { origin, 'content-type': type },
    body,
  });

void test('catalog pdf API: editor uploads, everyone downloads the ready file', async () => {
  const info = async () => (await (await getPdf(new Request('https://catalog.test/api/catalog-pdf?info=1'))).json()) as Record<string, unknown>;
  assert.deepEqual(await info(), { available: false });
  assert.equal((await getPdf(new Request('https://catalog.test/api/catalog-pdf'))).status, 404);

  setIdentity();
  assert.equal((await postPdf(upload(pdfBytes))).status, 403);
  setIdentity('admin@example.test');
  assert.equal((await postPdf(upload(pdfBytes, 'application/pdf', '?products=10&pages=3', 'https://attacker.test'))).status, 403);
  env.WORKER_ROLE = 'public';
  assert.equal((await postPdf(upload(pdfBytes))).status, 404);
  env.WORKER_ROLE = 'editor';
  assert.equal((await postPdf(upload('<html>', 'application/pdf'))).status, 400);
  assert.equal((await postPdf(upload(pdfBytes, 'text/html'))).status, 400);
  assert.equal((await postPdf(upload(pdfBytes, 'application/pdf', '?products=x&pages=3'))).status, 400);

  const saved = (await (await postPdf(upload(pdfBytes))).json()) as Record<string, unknown>;
  assert.equal(saved.available, true);
  assert.equal(saved.products, 10);
  assert.equal(saved.pages, 3);
  // O site público entrega o mesmo arquivo, como download.
  env.WORKER_ROLE = 'public';
  const file = await getPdf(new Request('https://public.test/api/catalog-pdf'));
  env.WORKER_ROLE = 'editor';
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'application/pdf');
  assert.match(file.headers.get('content-disposition') ?? '', /attachment; filename="catalogo-laurencini-\d{4}-\d{2}-\d{2}\.pdf"/);
  assert.equal(new TextDecoder().decode(await file.arrayBuffer()), new TextDecoder().decode(pdfBytes));
  assert.equal((await info()).available, true);
});
