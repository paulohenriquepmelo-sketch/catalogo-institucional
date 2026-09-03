import { env } from 'cloudflare:workers';
import { inspectImage, MAX_IMAGE_BYTES, MAX_IMAGE_EDGE } from './image-policy';

export async function storeImage(file: File) {
  if (file.size > MAX_IMAGE_BYTES || file.size < 12)
    throw new Error('Envie uma imagem de até 5 MB.');
  const data = await file.arrayBuffer();
  const info = inspectImage(new Uint8Array(data));
  if (
    info.format !== 'webp' ||
    info.animated ||
    Math.max(info.width, info.height) > MAX_IMAGE_EDGE
  )
    throw new Error(
      'Envie pelo editor para converter a imagem em WebP estático de até 1.920 pixels.',
    );
  const key = `images/${crypto.randomUUID()}.webp`;
  await env.FILES.put(key, data, {
    httpMetadata: { contentType: 'image/webp' },
  });
  return {
    key,
    url: `/api/uploads?key=${encodeURIComponent(key)}`,
    bytes: file.size,
    width: info.width,
    height: info.height,
  };
}
