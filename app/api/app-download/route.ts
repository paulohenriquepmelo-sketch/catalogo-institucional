import { env } from 'cloudflare:workers';

const APP_KEY = 'apps/catalogo-institucional.apk';
const APP_FILENAME = 'catalogo-institucional.apk';

function downloadHeaders(size: number) {
  return {
    'content-type': 'application/vnd.android.package-archive',
    'content-disposition': `attachment; filename="${APP_FILENAME}"`,
    'content-length': String(size),
    'x-content-type-options': 'nosniff',
    'cache-control': 'public, max-age=300, must-revalidate',
  };
}

export async function GET() {
  const object = await env.FILES.get(APP_KEY);
  if (!object) return new Response('Aplicativo indisponível.', { status: 404 });

  return new Response(object.body, {
    headers: downloadHeaders(object.size),
  });
}

export async function HEAD() {
  const object = await env.FILES.head(APP_KEY);
  if (!object) return new Response('Aplicativo indisponível.', { status: 404 });

  return new Response(null, {
    headers: downloadHeaders(object.size),
  });
}
