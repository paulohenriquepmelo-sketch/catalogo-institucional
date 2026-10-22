import { env } from 'cloudflare:workers';

const APP_KEY = 'apps/catalogo-institucional.apk';
const APP_FILENAME = 'catalogo-institucional.apk';

function downloadHeaders(size: number, etag: string) {
  return {
    'content-type': 'application/vnd.android.package-archive',
    'content-disposition': `attachment; filename="${APP_FILENAME}"`,
    'content-length': String(size),
    // O APK tem ~100 MB: em conexão lenta a transferência pode cair no meio.
    // Com Range, o gerenciador de downloads do Android continua de onde
    // parou em vez de entregar um arquivo cortado (que não instala).
    'accept-ranges': 'bytes',
    etag,
    'x-content-type-options': 'nosniff',
    'cache-control': 'public, max-age=300, must-revalidate',
  };
}

/** Um intervalo "bytes=início-fim" (ou "bytes=-sufixo"); null = arquivo inteiro. */
export function parseRange(header: string | null, size: number) {
  const match = header?.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  if (start > end || start >= size) return 'invalid' as const;
  return { start, end };
}

export async function GET(request: Request) {
  const head = await env.FILES.head(APP_KEY);
  if (!head) return new Response('Aplicativo indisponível.', { status: 404 });
  const headers = downloadHeaders(head.size, head.httpEtag);

  const ifRange = request.headers.get('if-range');
  const range =
    ifRange && ifRange !== head.httpEtag
      ? null
      : parseRange(request.headers.get('range'), head.size);
  if (range === 'invalid')
    return new Response(null, {
      status: 416,
      headers: { 'content-range': `bytes */${head.size}` },
    });

  const object = await env.FILES.get(
    APP_KEY,
    range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : {},
  );
  if (!object) return new Response('Aplicativo indisponível.', { status: 404 });
  if (!range) return new Response(object.body, { headers });
  return new Response(object.body, {
    status: 206,
    headers: {
      ...headers,
      'content-length': String(range.end - range.start + 1),
      'content-range': `bytes ${range.start}-${range.end}/${head.size}`,
    },
  });
}

export async function HEAD() {
  const object = await env.FILES.head(APP_KEY);
  if (!object) return new Response('Aplicativo indisponível.', { status: 404 });

  return new Response(null, {
    headers: downloadHeaders(object.size, object.httpEtag),
  });
}
