import { optimizeImage, optimizationSummary } from './optimize-image';

// Upload only the selected image. The caller updates its unsaved draft after success.
async function importCatalogImage(
  source: number | File,
  name: string,
  endpoint: string,
  failureLabel: string,
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
  const optimized = await optimizeImage(file);
  const form = new FormData();
  form.append('file', optimized.file);
  const response = await fetch('/api/uploads', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const data = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !data.url)
    throw new Error(data.error ?? `Falha ao enviar ${failureLabel}.`);
  return { url: data.url, summary: optimizationSummary(optimized) };
}

export function importBrandLogo(source: number | File, name: string) {
  return importCatalogImage(source, name, '/api/logos/image', 'a logo');
}

export function importProductImage(source: number | File, name: string) {
  return importCatalogImage(
    source,
    name,
    '/api/product-images/image',
    'a foto',
  );
}
