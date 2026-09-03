import {
  inspectImage,
  imageDimensions,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  TARGET_IMAGE_BYTES,
} from './image-policy';

export type OptimizedImage = {
  file: File;
  originalBytes: number;
  width: number;
  height: number;
};

export async function optimizeImage(source: File): Promise<OptimizedImage> {
  if (source.size > MAX_IMAGE_BYTES || source.size < 12)
    throw new Error('Envie uma imagem de até 5 MB.');
  const info = inspectImage(new Uint8Array(await source.arrayBuffer()));
  imageDimensions(info.width, info.height);
  if (info.animated)
    throw new Error(
      'Imagens animadas não são convertidas para evitar perder a animação. Envie uma imagem estática; para movimento, use o carrossel.',
    );
  const name = source.name.replace(/\.[^.]*$/, '') + '.webp';
  const result = (
    blob: Blob,
    width: number,
    height: number,
  ): OptimizedImage => ({
    file: new File([blob], name, {
      type: 'image/webp',
      lastModified: source.lastModified,
    }),
    originalBytes: source.size,
    width,
    height,
  });
  // Already small WebP images do not need another lossy encoding pass.
  if (
    info.format === 'webp' &&
    Math.max(info.width, info.height) <= MAX_IMAGE_EDGE &&
    source.size <= TARGET_IMAGE_BYTES
  )
    return result(source, info.width, info.height);
  let bitmap: ImageBitmap | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    bitmap = await createImageBitmap(source, {
      imageOrientation: 'from-image',
    });
    const { width, height } = imageDimensions(bitmap.width, bitmap.height);
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    // A transparent canvas preserves transparent logos and product cutouts.
    context.drawImage(bitmap, 0, 0, width, height);
    const encode = (quality: number) =>
      new Promise<Blob>((resolve, reject) => {
        canvas!.toBlob(
          (blob) => {
            if (!blob || blob.type !== 'image/webp')
              reject(
                new Error(
                  'Seu navegador não conseguiu gerar WebP. Atualize o navegador e tente novamente.',
                ),
              );
            else resolve(blob);
          },
          'image/webp',
          quality,
        );
      });
    let output = await encode(0.82);
    for (const quality of [0.72, 0.64]) {
      if (output.size <= TARGET_IMAGE_BYTES) break;
      const next = await encode(quality);
      if (next.size < output.size) output = next;
    }
    if (
      info.format === 'webp' &&
      width === info.width &&
      height === info.height &&
      source.size < output.size
    )
      output = source;
    if (output.size > MAX_IMAGE_BYTES)
      throw new Error(
        'A imagem ainda está muito pesada após a conversão. Use uma imagem menor.',
      );
    const encoded = inspectImage(new Uint8Array(await output.arrayBuffer()));
    if (
      encoded.format !== 'webp' ||
      encoded.animated ||
      encoded.width !== width ||
      encoded.height !== height
    )
      throw new Error(
        'Falha ao validar a imagem WebP. Nenhum arquivo foi enviado.',
      );
    return result(output, width, height);
  } catch (error) {
    if (error instanceof Error && error.name !== 'InvalidStateError')
      throw error;
    throw new Error(
      'Não foi possível ler essa imagem. Verifique o arquivo e tente novamente.',
    );
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

export function optimizationSummary(image: OptimizedImage) {
  const size = (bytes: number) =>
    bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(2).replace('.', ',')} MB`
      : `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  const saved = Math.round((1 - image.file.size / image.originalBytes) * 100);
  return `WebP · ${image.width} × ${image.height} px · ${size(image.originalBytes)} → ${size(image.file.size)}${saved > 0 ? ` · ${saved}% menor` : ''}`;
}
