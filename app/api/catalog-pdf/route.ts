import { env } from 'cloudflare:workers';
import { authorizeMutation } from '@/lib/editor-access';

// PDF do catálogo completo, gerado no editor e guardado no R2 (o site
// público só entrega o arquivo pronto: gerar ~90 páginas leva minutos).
const KEY = 'catalog-pdf/catalogo.pdf';
const MAX_BYTES = 90 * 1048576;

// Layout e produtos por fileira do PDF publicado: o editor abre com eles
// marcados, em vez de voltar sempre ao clássico com 5.
const LAYOUTS = ['classico', 'moderno', 'modelo'];
const COLUMNS = ['3', '4', '5'];

type Info = {
  available: boolean;
  generatedAt?: string;
  products?: number;
  pages?: number;
  size?: number;
  layout?: string;
  columns?: number;
};

function infoOf(
  object: { size: number; customMetadata?: Record<string, string> } | null,
): Info {
  if (!object) return { available: false };
  const meta = object.customMetadata ?? {};
  return {
    available: true,
    generatedAt: meta.generatedAt,
    products: Number(meta.products) || undefined,
    pages: Number(meta.pages) || undefined,
    size: object.size,
    layout: LAYOUTS.includes(meta.layout) ? meta.layout : undefined,
    columns: COLUMNS.includes(meta.columns) ? Number(meta.columns) : undefined,
  };
}

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.has('info'))
    return Response.json(infoOf(await env.FILES.head(KEY)), {
      headers: { 'cache-control': 'public, max-age=60' },
    });
  const object = await env.FILES.get(KEY);
  if (!object) return new Response('Catálogo em PDF ainda não foi gerado.', { status: 404 });
  const day = (object.customMetadata?.generatedAt ?? '').slice(0, 10);
  return new Response(object.body, {
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(object.size),
      'content-disposition': `attachment; filename="catalogo-laurencini${day ? `-${day}` : ''}.pdf"`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=300',
    },
  });
}

export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    if (request.headers.get('content-type') !== 'application/pdf')
      throw new Error('Envie o catálogo em PDF.');
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BYTES)
      throw new Error('O PDF passou de 90 MB.');
    const params = new URL(request.url).searchParams;
    const count = (name: string) => {
      const value = Number(params.get(name));
      if (!Number.isInteger(value) || value < 1 || value > 100000)
        throw new Error('Dados do catálogo inválidos.');
      return String(value);
    };
    const products = count('products');
    const pages = count('pages');
    const choice = (name: string, allowed: string[]) => {
      const value = params.get(name);
      if (value === null) return {};
      if (!allowed.includes(value)) throw new Error('Dados do catálogo inválidos.');
      return { [name]: value };
    };
    const options = { ...choice('layout', LAYOUTS), ...choice('columns', COLUMNS) };
    const body = await request.arrayBuffer();
    const head = new TextDecoder().decode(new Uint8Array(body, 0, Math.min(5, body.byteLength)));
    if (body.byteLength > MAX_BYTES) throw new Error('O PDF passou de 90 MB.');
    if (head !== '%PDF-') throw new Error('O arquivo enviado não é um PDF.');
    const generatedAt = new Date().toISOString();
    const customMetadata = { generatedAt, products, pages, ...options };
    await env.FILES.put(KEY, body, {
      httpMetadata: { contentType: 'application/pdf' },
      customMetadata,
    });
    return Response.json(infoOf({ size: body.byteLength, customMetadata }));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Falha ao salvar o PDF.' },
      { status: 400 },
    );
  }
}
