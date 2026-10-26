import {
  optimizeImage,
  optimizationSummary,
  type OptimizeOptions,
} from './optimize-image';

// Upload only the selected image. The caller updates its unsaved draft after success.
async function importCatalogImage(
  source: number | File,
  name: string,
  endpoint: string,
  failureLabel: string,
  options: OptimizeOptions,
) {
  let file: File;
  if (source instanceof File) file = source;
  else {
    const response = await fetch(endpoint + '?id=' + source, {
      signal: AbortSignal.timeout(40000),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? `Falha ao obter ${failureLabel}.`);
    }
    const blob = await response.blob();
    file = new File([blob], name.replace(/[^\p{L}\p{N}_-]/gu, '_') + '.png', {
      type: blob.type,
    });
  }
  const optimized = await optimizeImage(file, options);
  return {
    url: await uploadImage(optimized.file, failureLabel),
    summary: optimizationSummary(optimized),
  };
}

async function uploadImage(file: File, failureLabel: string) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/uploads', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const data = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !data.url)
    throw new Error(data.error ?? `Falha ao enviar ${failureLabel}.`);
  return data.url;
}

// Crops the empty border of logos uploaded before cropping existed. Each
// cropped logo is a new upload and the originals stay in storage, so only the
// editor draft changes until it is saved and published.
export async function trimBrandLogos(
  logos: string[],
  onProgress: (done: number, total: number) => void,
) {
  const pending = [...new Set(logos)].filter((logo) =>
    logo.startsWith('/api/uploads?'),
  );
  const replaced = new Map<string, string>();
  let failed = 0;
  for (const [n, logo] of pending.entries()) {
    onProgress(n, pending.length);
    try {
      const response = await fetch(logo, {
        signal: AbortSignal.timeout(40000),
      });
      if (!response.ok) throw new Error('Logo indisponível.');
      const blob = await response.blob();
      const file = new File([blob], 'logo.webp', { type: blob.type });
      const optimized = await optimizeImage(file, { logo: true });
      if (optimized.alreadyFramed || optimized.file === file) continue;
      replaced.set(logo, await uploadImage(optimized.file, 'a logo'));
    } catch {
      failed++;
    }
  }
  onProgress(pending.length, pending.length);
  return { replaced, failed, total: pending.length };
}

export function importBrandLogo(source: number | File, name: string) {
  return importCatalogImage(source, name, '/api/logos/image', 'a logo', {
    logo: true,
  });
}

export function importProductImage(source: number | File, name: string) {
  return importCatalogImage(
    source,
    name,
    '/api/product-images/image',
    'a foto',
    { product: true },
  );
}
