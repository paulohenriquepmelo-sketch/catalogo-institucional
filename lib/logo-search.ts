import { inspectImage, imageDimensions, MAX_IMAGE_BYTES } from './image-policy';

export type LogoResult = {
  id: number;
  title: string;
  thumbnail: string;
  source: string;
  license: string;
};
type CommonsPage = {
  pageid?: number;
  index?: number;
  title?: string;
  imageinfo?: {
    thumburl?: string;
    extmetadata?: { LicenseShortName?: { value?: string } };
  }[];
};
const API = 'https://commons.wikimedia.org/w/api.php';

// Only Commons raster thumbnails can be fetched. Never act as an arbitrary URL proxy.
export function allowedLogoImage(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname) ||
    !url.pathname.startsWith('/wikipedia/commons/') ||
    !/\.(png|jpe?g|webp|gif)$/i.test(url.pathname)
  )
    throw new Error('Imagem não permitida pela busca.');
  url.search = '';
  url.hash = '';
  return url.href;
}

export async function boundedLogoResponse(response: Response, limit: number) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `A fonte de logos está indisponível (HTTP ${response.status}). Tente novamente em instantes.`,
    );
  }
  if (Number(response.headers.get('content-length') ?? 0) > limit) {
    await response.body?.cancel();
    throw new Error('A imagem ou resposta excede o tamanho permitido.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('A fonte retornou uma resposta vazia.');
  let length = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new Error('A imagem ou resposta excede o tamanho permitido.');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

async function commons(
  parameters: Record<string, string>,
  signal?: AbortSignal,
) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiextmetadatafilter: 'LicenseShortName',
    iiurlwidth: '600',
    ...parameters,
  }).toString();
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'CatalogLogoPicker/1.0 (interactive institutional catalog editor)',
      Accept: 'application/json',
    },
    redirect: 'manual',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  });
  const data = JSON.parse(
    new TextDecoder().decode(await boundedLogoResponse(response, 512 * 1024)),
  ) as { query?: { pages?: Record<string, CommonsPage> }; error?: unknown };
  if (data.error)
    throw new Error(
      'A fonte não conseguiu concluir a busca. Tente outro nome.',
    );
  return Object.values(data.query?.pages ?? {}).sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
}

export function logoResult(page: CommonsPage): LogoResult | null {
  const info = page.imageinfo?.[0];
  const license = info?.extmetadata?.LicenseShortName?.value ?? '';
  // Limit automatic copying to images the source identifies as public domain or CC0.
  if (
    !Number.isSafeInteger(page.pageid) ||
    !page.pageid ||
    !page.title?.startsWith('File:') ||
    !info?.thumburl ||
    !/^(Public domain|CC0)$/i.test(license)
  )
    return null;
  try {
    return {
      id: page.pageid,
      title: page.title.slice(5),
      thumbnail: allowedLogoImage(info.thumburl),
      source:
        'https://commons.wikimedia.org/wiki/' + encodeURIComponent(page.title),
      license,
    };
  } catch {
    return null;
  }
}

export async function searchLogos(query: string, signal?: AbortSignal) {
  const term = query.trim();
  if (
    term.length < 2 ||
    term.length > 100 ||
    Array.from(term).some((char) => char.charCodeAt(0) < 32)
  )
    throw new Error('Digite de 2 a 100 caracteres para buscar a marca.');
  const pages = await commons(
    {
      generator: 'search',
      gsrsearch: term + ' logo',
      gsrnamespace: '6',
      gsrlimit: '30',
    },
    signal,
  );
  return pages
    .map(logoResult)
    .filter((item): item is LogoResult => !!item)
    .filter((item) => /logo|logotipo|wordmark/i.test(item.title))
    .slice(0, 24);
}

export async function retrieveLogo(id: string, signal?: AbortSignal) {
  if (!/^[1-9]\d{0,9}$/.test(id))
    throw new Error('Selecione uma logo válida na busca.');
  const pages = await commons({ pageids: id }, signal);
  const selected = pages.find((page) => String(page.pageid) === id);
  const result = selected ? logoResult(selected) : null;
  if (!result)
    throw new Error(
      'Essa logo não está disponível para seleção. Busque novamente.',
    );
  const response = await fetch(result.thumbnail, {
    headers: {
      'User-Agent':
        'CatalogLogoPicker/1.0 (interactive institutional catalog editor)',
      Accept: 'image/png,image/jpeg,image/webp,image/gif',
    },
    redirect: 'manual',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  });
  const bytes = await boundedLogoResponse(response, MAX_IMAGE_BYTES);
  const info = inspectImage(bytes);
  imageDimensions(info.width, info.height);
  if (info.animated) throw new Error('Escolha uma logo estática.');
  return { bytes, contentType: `image/${info.format}` };
}
