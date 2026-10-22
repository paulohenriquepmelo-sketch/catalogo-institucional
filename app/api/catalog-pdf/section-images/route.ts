import { env } from 'cloudflare:workers';
import { authorizeMutation, getEditorUser, readJson } from '@/lib/editor-access';

// Imagem de cada marca (seção da Distribuição) que preenche a sobra da última
// página da seção no catálogo em PDF. Fica no R2, fora da configuração do
// site: só o gerador do PDF (no editor) usa.
const KEY = 'catalog-pdf/section-images.json';
const UPLOAD_URL = /^\/api\/uploads\?key=images%2F[a-f0-9-]+\.(webp|png|jpg|gif)$/;

export type SectionImages = Record<string, string>;

export function validateSectionImages(value: unknown): SectionImages {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Dados das imagens inválidos.');
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 100) throw new Error('Imagens demais.');
  const out: SectionImages = {};
  for (const [section, url] of entries) {
    if (typeof section !== 'string' || !section.trim() || section.length > 180)
      throw new Error('Seção inválida.');
    if (url === '') continue;
    if (typeof url !== 'string' || !UPLOAD_URL.test(url))
      throw new Error('Envie a imagem pelo botão do editor.');
    out[section] = url;
  }
  return out;
}

export async function GET() {
  if (env.WORKER_ROLE === 'public')
    return Response.json({ error: 'Página não encontrada.' }, { status: 404 });
  if (!(await getEditorUser()))
    return Response.json(
      { error: 'Somente administradores autorizados podem editar.' },
      { status: 403 },
    );
  const object = await env.FILES.get(KEY);
  const images = object ? ((await object.json()) as SectionImages) : {};
  return Response.json({ images }, { headers: { 'cache-control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    const body = (await readJson(request)) as { images?: unknown };
    const images = validateSectionImages(body.images);
    await env.FILES.put(KEY, JSON.stringify(images), {
      httpMetadata: { contentType: 'application/json' },
    });
    return Response.json({ images });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Não foi possível salvar.' },
      { status: 400 },
    );
  }
}
