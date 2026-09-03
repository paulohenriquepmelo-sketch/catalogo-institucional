import { optimizeImage, optimizationSummary } from './optimize-image';

// Upload only the selected image. The caller updates the unsaved brand draft after success.
export async function importBrandLogo(source: number | File, name: string) {
  let file: File;
  if (source instanceof File) file = source;
  else {
    const response = await fetch('/api/logos/image?id=' + source, {
      signal: AbortSignal.timeout(40000),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? 'Falha ao obter a logo.');
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
    throw new Error(data.error ?? 'Falha ao enviar a logo.');
  return { url: data.url, summary: optimizationSummary(optimized) };
}
