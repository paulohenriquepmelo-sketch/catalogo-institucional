import { env } from 'cloudflare:workers';
import { authorizeMutation } from '@/lib/editor-access';

type StoredConfig = {
  logo?: unknown;
  brands?: unknown;
  [key: string]: unknown;
};

export async function POST(request: Request) {
  const denied = await authorizeMutation(request);
  if (denied) return denied;
  const input = (await request.json().catch(() => null)) as {
    confirm?: boolean;
  } | null;
  if (input?.confirm !== true)
    return Response.json(
      { error: 'Confirmação explícita necessária.' },
      { status: 400 },
    );

  const configRow = await env.DB.prepare(
    'SELECT body,revision FROM catalog_config WHERE id=1',
  ).first<{ body: string; revision: number }>();
  if (!configRow)
    return Response.json(
      { error: 'Configuração indisponível.' },
      { status: 503 },
    );

  const stored = JSON.parse(configRow.body) as StoredConfig;
  const productRows = await env.DB.prepare(
    "SELECT image FROM products WHERE image IS NOT NULL AND image <> ''",
  ).all<{ image: string }>();
  const brandRows = await env.DB.prepare(
    "SELECT logo_url FROM brands WHERE logo_url IS NOT NULL AND logo_url <> ''",
  ).all<{ logo_url: string }>();
  const oldImageValues = [
    stored.logo,
    ...(Array.isArray(stored.brands)
      ? stored.brands.map((brand) =>
          brand && typeof brand === 'object'
            ? (brand as { logo?: unknown }).logo
            : undefined,
        )
      : []),
    ...productRows.results.map((row) => row.image),
    ...brandRows.results.map((row) => row.logo_url),
  ];
  const imageKeysBefore = new Set(
    oldImageValues.map(imageKey).filter((key): key is string => Boolean(key)),
  );

  const nextConfig: StoredConfig = {
    ...stored,
    logo: '',
    brands: Array.isArray(stored.brands)
      ? stored.brands.map((brand) =>
          brand && typeof brand === 'object'
            ? { ...brand, logo: '' }
            : brand,
        )
      : stored.brands,
  };
  const preservedImageKeys = new Set<string>();
  collectImageKeys(nextConfig, preservedImageKeys);
  const keysToDelete = [...imageKeysBefore].filter(
    (key) => !preservedImageKeys.has(key),
  );

  const results = await env.DB.batch([
    env.DB.prepare("UPDATE products SET image='' WHERE image IS NOT NULL AND image <> ''"),
    env.DB.prepare("UPDATE brands SET logo_url=NULL WHERE logo_url IS NOT NULL AND logo_url <> ''"),
    env.DB.prepare(
      'UPDATE catalog_config SET body=?,revision=revision+1 WHERE id=1 AND revision=?',
    ).bind(JSON.stringify(nextConfig), configRow.revision),
  ]);
  if (!results[2]?.meta.changes)
    return Response.json(
      { error: 'A configuração mudou em outra sessão. Recarregue e tente novamente.' },
      { status: 409 },
    );

  let filesDeleted = 0;
  for (const key of keysToDelete) {
    await env.FILES.delete(key);
    filesDeleted += 1;
  }
  return Response.json({
    productsCleared: productRows.results.length,
    logosCleared:
      (stored.logo ? 1 : 0) +
      (Array.isArray(stored.brands)
        ? stored.brands.filter(
            (brand) =>
              brand &&
              typeof brand === 'object' &&
              typeof (brand as { logo?: unknown }).logo === 'string' &&
              Boolean((brand as { logo: string }).logo),
          ).length
        : 0) +
      brandRows.results.length,
    filesDeleted,
  });
}

function imageKey(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value, 'https://catalog.local');
    const key = url.searchParams.get('key');
    return key && /^images\/[a-f0-9-]+\.(png|jpg|webp|gif)$/i.test(key)
      ? key
      : null;
  } catch {
    return null;
  }
}

function collectImageKeys(value: unknown, keys: Set<string>) {
  const key = imageKey(value);
  if (key) keys.add(key);
  if (Array.isArray(value)) {
    for (const item of value) collectImageKeys(item, keys);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectImageKeys(item, keys);
  }
}
