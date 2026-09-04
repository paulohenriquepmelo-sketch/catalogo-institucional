import { env } from 'cloudflare:workers';
import {
  authorizeMutation,
  getEditorUser,
  readJson,
} from '@/lib/editor-access';

const POINTER_KEY = 'pending/product-images/latest.json';
const MANIFEST_KEY =
  /^pending\/product-images\/[a-zA-Z0-9_-]+\/manifest\.json$/;
const IMAGE_KEY =
  /^pending\/product-images\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9-]+\.webp$/;
const CODE = /^[a-zA-Z0-9_-]{1,180}$/;
const BATCH_SIZE = 40;

type Pointer = { manifestKey: string };
type ManifestFile = {
  sourceName?: string;
  code?: string;
  duplicateCode?: boolean;
  status?: string;
  r2Key?: string;
};
type Manifest = {
  batch?: string;
  total?: number;
  duplicateCodes?: number;
  files?: ManifestFile[];
};

async function loadManifest() {
  const pointerObject = await env.FILES.get(POINTER_KEY);
  if (!pointerObject) return null;
  if (pointerObject.size > 4096)
    throw new Error('Ponteiro de imagens pendentes inválido.');
  const pointer = await pointerObject.json<Pointer>();
  if (!MANIFEST_KEY.test(pointer.manifestKey ?? ''))
    throw new Error('Ponteiro de imagens pendentes inválido.');
  const manifestObject = await env.FILES.get(pointer.manifestKey);
  if (!manifestObject) throw new Error('Manifesto de imagens não encontrado.');
  if (manifestObject.size > 8 * 1024 * 1024)
    throw new Error('Manifesto de imagens muito grande.');
  const manifest = await manifestObject.json<Manifest>();
  if (!Array.isArray(manifest.files) || manifest.files.length > 20000)
    throw new Error('Manifesto de imagens inválido.');
  return { key: pointer.manifestKey, manifest };
}

function candidates(manifest: Manifest) {
  return manifest.files!.filter(
    (file): file is ManifestFile & { code: string; r2Key: string } =>
      file.status === 'uploaded' &&
      file.duplicateCode !== true &&
      typeof file.code === 'string' &&
      CODE.test(file.code) &&
      typeof file.r2Key === 'string' &&
      IMAGE_KEY.test(file.r2Key),
  );
}

export async function GET() {
  if (!(await getEditorUser()))
    return Response.json({ error: 'Acesso restrito.' }, { status: 403 });
  try {
    const loaded = await loadManifest();
    if (!loaded) return Response.json({ available: false });
    const ready = candidates(loaded.manifest);
    return Response.json({
      available: true,
      batch: loaded.manifest.batch ?? '',
      total: loaded.manifest.total ?? loaded.manifest.files!.length,
      ready: ready.length,
      duplicateCodes: loaded.manifest.duplicateCodes ?? 0,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Falha ao ler o lote.',
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  try {
    const body = (await readJson(request)) as {
      cursor?: unknown;
      replaceExisting?: unknown;
    };
    const cursor = Number(body.cursor ?? 0);
    if (!Number.isInteger(cursor) || cursor < 0 || cursor > 20000)
      throw new Error('Posição do lote inválida.');
    const replaceExisting = body.replaceExisting === true;
    const loaded = await loadManifest();
    if (!loaded) throw new Error('Nenhum lote de imagens pendente.');
    const ready = candidates(loaded.manifest);
    const batch = ready.slice(cursor, cursor + BATCH_SIZE);
    if (!batch.length)
      return Response.json({
        processed: cursor,
        total: ready.length,
        linked: 0,
        skipped: 0,
        missing: 0,
        nextCursor: cursor,
        done: true,
      });
    const placeholders = batch.map(() => '?').join(',');
    const products = await env.DB.prepare(
      `SELECT code,image FROM products WHERE code IN (${placeholders})`,
    )
      .bind(...batch.map((file) => file.code))
      .all<{ code: string; image: string }>();
    const byCode = new Map(
      products.results.map((product) => [product.code, product]),
    );
    const statements: ReturnType<typeof env.DB.prepare>[] = [];
    let skipped = 0;
    let missing = 0;
    const now = new Date().toISOString();
    for (const file of batch) {
      const product = byCode.get(file.code);
      if (!product) {
        missing++;
        continue;
      }
      if (product.image && !replaceExisting) {
        skipped++;
        continue;
      }
      const url = `/api/uploads?key=${encodeURIComponent(file.r2Key)}`;
      statements.push(
        env.DB.prepare(
          'UPDATE products SET image=?,updated_at=? WHERE code=?',
        ).bind(url, now, file.code),
      );
    }
    if (statements.length) await env.DB.batch(statements);
    const nextCursor = cursor + batch.length;
    const done = nextCursor >= ready.length;
    if (done) await env.FILES.delete(POINTER_KEY);
    return Response.json({
      processed: nextCursor,
      total: ready.length,
      linked: statements.length,
      skipped,
      missing,
      nextCursor,
      done,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const quota = /exceeded D1|daily row|code:\s*7500/i.test(message);
    return Response.json(
      {
        error: quota
          ? 'O limite diário do D1 ainda está ativo. As imagens permanecem seguras no R2; tente novamente após 21h.'
          : message || 'Não foi possível vincular as imagens pendentes.',
      },
      { status: quota ? 503 : 400 },
    );
  }
}
