import { getChatGPTUser } from '@/app/chatgpt-auth';
import { classifySegment } from '@/lib/segment-classifier';
import { listCatalogProducts, removeCatalogProduct, saveCatalogProduct } from '@/lib/catalog-repository';

export async function GET() {
  try { return Response.json(await listCatalogProducts()); }
  catch { return Response.json({ error: 'Não foi possível carregar o catálogo.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: 'Acesso restrito ao editor.' }, { status: 401 });
  try {
    const body = await request.json();
    const analysis = classifySegment({ ...body, specs: body.specs ?? [] });
    const id = await saveCatalogProduct({ ...body, segment: analysis.segment, published: body.published ?? true });
    return Response.json({ id, analysis });
  } catch {
    return Response.json({ error: 'Revise os campos do produto e tente novamente.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: 'Acesso restrito ao editor.' }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'Produto inválido.' }, { status: 400 });
  await removeCatalogProduct(id);
  return Response.json({ ok: true });
}
