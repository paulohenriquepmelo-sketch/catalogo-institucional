import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayName, GRID, MODELO_AREA, planCatalogPdf, planContents, sortForCatalog, type PdfProduct } from '../lib/catalog-pdf';
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

void test('lista sem foto: ordem por código e PDF válido', async () => {
  const { renderNoPhotoPdf, sortNoPhotoList } = await import('../lib/no-photo-pdf');
  const item = (code: string, name: string) => ({ code, name, brand: 'MARCA', section: '1-HERSHEYS', category: 'CHOCOLATES' });
  const list = [item('11963', 'B'), item('900', 'A'), item('11711', 'MACARRÃO COM NOME MUITO LONGO '.repeat(5))];
  assert.deepEqual(sortNoPhotoList(list).map((p) => p.code), ['900', '11711', '11963']);
  const many = Array.from({ length: 120 }, (_, i) => item(String(11000 + i), `PRODUTO ${i}`));
  const blob = await renderNoPhotoPdf([...list, ...many]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
  assert.match(new TextDecoder('latin1').decode(bytes), /\/Count 3\b/);
});

void test('PDF: dentro da categoria, produtos parecidos ficam juntos', async () => {
  const { compareBySimilarity } = await import('../lib/product-family');
  const order = (names: string[]) => [...names].sort(compareBySimilarity);
  const food = order([
    'MILHO VERDE LATA OLE 1,700 KG', 'MISTURA BOLO COAMO AIPIM 05KG', 'ERVILHA LATA OLE 1,700 KG',
    'POLVILHO DOCE AMIDOTEC 1KG', 'FARINHA DE TRIGO PREDILETA 25KG PAPEL', 'MOLHO INGLES PRONTO 900ML',
    'TRIGO PARA KIBE ELDOURADO 5KG', 'MILHO VERDE LATA PREDILECTA 1,500 KG', 'MARGARINA COAMO 80% 14,5KG',
    'ERVILHA LATA PREDILECTA 1,700 KG', 'FERMENTO BIOLOGICO SECO MAGEST 500G',
  ]);
  assert.deepEqual(food, [
    'FARINHA DE TRIGO PREDILETA 25KG PAPEL', 'POLVILHO DOCE AMIDOTEC 1KG', 'MISTURA BOLO COAMO AIPIM 05KG',
    'FERMENTO BIOLOGICO SECO MAGEST 500G', 'TRIGO PARA KIBE ELDOURADO 5KG', 'MARGARINA COAMO 80% 14,5KG',
    'MILHO VERDE LATA OLE 1,700 KG', 'MILHO VERDE LATA PREDILECTA 1,500 KG', 'ERVILHA LATA OLE 1,700 KG',
    'ERVILHA LATA PREDILECTA 1,700 KG', 'MOLHO INGLES PRONTO 900ML',
  ]);
  const hygiene = order([
    'CREME DENTAL COLGATE 90 GR', 'LAMINA DE BARBEAR GILLETTE PLATINUM NOVO', 'APARELHO DE BARBEAR BIC',
    'FRALDA DESC DIGUINHO CONFORT PLUS G', 'APARELHO DE BARBEAR PROBAK II 28UN', 'ESCOVA DENTAL POWERDENT INFANTIL PIUI',
  ]);
  assert.deepEqual(hygiene.slice(0, 3), [
    'APARELHO DE BARBEAR BIC', 'APARELHO DE BARBEAR PROBAK II 28UN', 'LAMINA DE BARBEAR GILLETTE PLATINUM NOVO',
  ]);
  // Utilidades: vassouras, rodos, rastelos, pás e esfregões ficam juntos.
  const cleaning = order([
    'ISQUEIRO BIC MINI (12UN)', 'RODO PLASTICO 60CM DALCIN', 'ESFREGAO MILEVA (3057)', 'PANELA DE ALUMINIO C/ TAMPA N°16',
    'PA PARA LIXO COMPANHEIRA (936)', 'VASSOURA MILEVA PLUMA (2007)', 'LAMPADA AVANT LED 9W NOVO', 'RASTELO PLASTICO DALCIN',
    'PA (S/CABO) P/LIXO MILEVA PAPATUDO(5001)', 'VASSOURAO ECONOMICO MILEVA (5017)',
  ]);
  assert.deepEqual(cleaning.slice(0, 7), [
    'VASSOURA MILEVA PLUMA (2007)', 'VASSOURAO ECONOMICO MILEVA (5017)', 'RODO PLASTICO 60CM DALCIN', 'RASTELO PLASTICO DALCIN',
    'PA PARA LIXO COMPANHEIRA (936)', 'PA (S/CABO) P/LIXO MILEVA PAPATUDO(5001)', 'ESFREGAO MILEVA (3057)',
  ]);
  // Limpeza por uso: esponja junto do detergente, tira manchas junto das roupas.
  const cleaningProducts = order([
    'TIRA MANCHAS CORES 2LT QBOA', 'BOMBRIL 45G LÃ DE ACO (20X06UN)', 'SABAO RAZZO AZUL 180G', 'ESPONJA JEITOSA',
    'DETERGENTE LIMPOL COCO 500ML', 'SABAO PO SURF SACHE COCO 800G', 'AGUA SANITARIA 01 LT QBOA', 'AMACIANTE SENSE 500ML CARINHO',
  ]);
  assert.deepEqual(cleaningProducts, [
    'DETERGENTE LIMPOL COCO 500ML', 'ESPONJA JEITOSA', 'BOMBRIL 45G LÃ DE ACO (20X06UN)', 'SABAO PO SURF SACHE COCO 800G',
    'SABAO RAZZO AZUL 180G', 'AMACIANTE SENSE 500ML CARINHO', 'TIRA MANCHAS CORES 2LT QBOA', 'AGUA SANITARIA 01 LT QBOA',
  ]);
  // Sem família conhecida: continua junto pela primeira palavra.
  assert.deepEqual(order(['XICARA B', 'BULE A', 'XICARA A']), ['BULE A', 'XICARA A', 'XICARA B']);
});

void test('PDF: 5 por fileira e item sozinho não vai para outra página', async () => {
  const { packRows } = await import('../lib/catalog-pdf');
  const item = (id: number, name: string, category = 'CAT'): PdfProduct => ({
    id, code: String(id), name, department: '1-ATACADO', section: '1-ALIMENTOS', category, brand: 'M', image: '/x.webp',
  });
  const rows = packRows([
    ...[1, 2, 3, 4].map((i) => item(i, `MARGARINA ${i}`)),
    ...[5, 6, 7].map((i) => item(i, `MILHO VERDE LATA ${i}`)),
    ...[8, 9].map((i) => item(i, `ERVILHA LATA ${i}`)),
  ]);
  // Sempre 5 por fileira; o tipo não abre fileira própria.
  assert.deepEqual(rows.map((r) => r.map((p) => p.id)), [[1, 2, 3, 4, 5], [6, 7, 8, 9]]);

  // 10 itens numa categoria + 16 na seguinte: o 16º não pode ir sozinho.
  const list = [
    ...Array.from({ length: 10 }, (_, i) => item(100 + i, `BARRA DARK ${i}`, 'BARRA DARK')),
    ...Array.from({ length: 16 }, (_, i) => item(200 + i, `BARRA REGULAR ${i}`, 'BARRA REGULAR')),
  ];
  const pages = planCatalogPdf(list);
  assert.equal(pages.length, 1);
  const rowsOnPage = pages[0].blocks.filter((b) => b.type === 'row');
  assert.ok(rowsOnPage.every((b) => b.type === 'row' && b.height && b.height >= GRID.minRowHeight));
  const last = pages[0].blocks.at(-1)!;
  assert.ok(last.y + (last.type === 'row' ? last.height! : GRID.barHeight) <= GRID.bottom);
});

void test('PDF: cada seção da Distribuição em página própria, com área para a imagem da marca; Atacado igual', () => {
  const dist = '1-DISTRIBUICAO';
  const list = [
    ...Array.from({ length: 7 }, (_, i) => make(`BARRA ${i}`, '1-HERSHEYS', 'BARRA', dist)),
    ...Array.from({ length: 3 }, (_, i) => make(`BATATA ${i}`, '2-ART FRITAS', 'BATATA', dist)),
    ...Array.from({ length: 4 }, (_, i) => make(`ARROZ ${i}`, '1-ALIMENTOS', 'MERCEARIA')),
    ...Array.from({ length: 4 }, (_, i) => make(`SABAO ${i}`, '6-LIMPEZA', 'LIMPEZA')),
  ];
  const pages = planCatalogPdf(list);
  assert.deepEqual(pages.map((p) => p.title), ['Hersheys', 'Art Fritas', 'Alimentos']);
  assert.equal(pages[0].filler?.section, '1-HERSHEYS');
  assert.equal(pages[1].filler?.section, '2-ART FRITAS');
  assert.ok(pages[0].filler!.height >= 90 && pages[0].filler!.y + pages[0].filler!.height <= GRID.bottom);
  // Atacado: seções pequenas continuam dividindo a página, sem imagem.
  assert.equal(pages[2].filler, undefined);
  assert.equal(pages[2].blocks.filter((b) => b.type === 'bar').length, 1);
});

void test('imagens das marcas: só editor salva, e só imagens enviadas pelo editor', async () => {
  const { GET, POST, validateSectionImages } = await import('../app/api/catalog-pdf/section-images/route');
  const url = '/api/uploads?key=images%2F0f2b6c1e-1111-4222-8333-444455556666.webp';
  assert.deepEqual(validateSectionImages({ '1-HERSHEYS': url, '2-ART FRITAS': '' }), { '1-HERSHEYS': url });
  assert.throws(() => validateSectionImages({ '1-HERSHEYS': 'https://evil.example/x.png' }), /botão do editor/);
  assert.throws(() => validateSectionImages(['x']), /inválidos/);
  const save = (body: unknown, origin = 'https://catalog.test') =>
    POST(new Request('https://catalog.test/api/catalog-pdf/section-images', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }));
  setIdentity();
  assert.equal((await save({ images: { '1-HERSHEYS': url } })).status, 403);
  assert.equal((await GET()).status, 403);
  setIdentity('admin@example.test');
  assert.equal((await save({ images: { '1-HERSHEYS': url } }, 'https://evil.example')).status, 403);
  assert.equal((await save({ images: { '1-HERSHEYS': url } })).status, 200);
  assert.deepEqual(((await (await GET()).json()) as { images: unknown }).images, { '1-HERSHEYS': url });
  assert.equal((await save({ images: { '1-HERSHEYS': '/api/uploads?key=..%2Fsecret' } })).status, 400);
});

void test('sumário lista departamento, seção e categoria com a página onde começam', () => {
  const list = [
    make('A', '1-HERSHEYS', '1.1-BARRA DARK', '2-DISTRIBUICAO'),
    make('B', '1-ALIMENTOS', '1.1-FOOD SERVICE'),
    make('C', '1-ALIMENTOS', '1.2-MERCEARIA'),
  ];
  const entries = planContents(planCatalogPdf(list));
  assert.deepEqual(
    entries.map((e) => [e.level, e.title, e.page]),
    [
      ['department', 'Distribuição', 1],
      ['section', 'Hersheys', 1],
      ['category', 'Barra Dark', 1],
      ['department', 'Atacado', 2],
      ['section', 'Alimentos', 2],
      ['category', 'Food Service', 2],
      ['category', 'Mercearia', 2],
    ],
  );
});

void test('layout modelo: produtos ficam dentro da área mais baixa da página', () => {
  const list = Array.from({ length: 60 }, (_, i) => make(`P${i}`, '1-ALIMENTOS', '1.1-FOOD SERVICE'));
  const pages = planCatalogPdf(list, MODELO_AREA);
  for (const page of pages)
    for (const block of page.blocks) {
      assert.ok(block.y >= MODELO_AREA.top);
      assert.ok(block.y + (block.type === 'bar' ? GRID.barHeight : (block.height ?? GRID.rowHeight)) <= MODELO_AREA.bottom);
    }
  assert.ok(pages.length > planCatalogPdf(list).length - 1);
});
