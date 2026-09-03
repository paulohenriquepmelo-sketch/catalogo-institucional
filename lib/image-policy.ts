export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1920;
export const MAX_SOURCE_PIXELS = 40_000_000;
export const TARGET_IMAGE_BYTES = 512 * 1024;
export type ImageInfo = {
  format: 'png' | 'jpeg' | 'gif' | 'webp';
  width: number;
  height: number;
  animated: boolean;
};

const invalid = () =>
  new Error(
    'Imagem inválida ou danificada. Use PNG, JPEG, WebP ou GIF estático.',
  );

// Inspect actual bytes rather than trusting an extension or browser MIME type.
export function inspectImage(bytes: Uint8Array): ImageInfo {
  if (bytes.length < 12 || bytes.length > MAX_IMAGE_BYTES) throw invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at: number, length: number) =>
    String.fromCharCode(...bytes.subarray(at, at + length));
  const le24 = (at: number) =>
    bytes[at] + bytes[at + 1] * 256 + bytes[at + 2] * 65536;
  let info: ImageInfo | undefined;
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) {
    if (bytes.length < 33 || text(12, 4) !== 'IHDR' || view.getUint32(8) !== 13)
      throw invalid();
    info = {
      format: 'png',
      width: view.getUint32(16),
      height: view.getUint32(20),
      animated: false,
    };
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = view.getUint32(offset);
      if (offset + 12 + size > bytes.length) throw invalid();
      if (text(offset + 4, 4) === 'acTL') info.animated = true;
      offset += size + 12;
    }
  } else if (text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
    if (view.getUint32(4, true) + 8 !== bytes.length) throw invalid();
    let canvas: { width: number; height: number } | undefined;
    let frame: { width: number; height: number } | undefined;
    let animated = false;
    let frames = 0;
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const tag = text(offset, 4);
      const size = view.getUint32(offset + 4, true);
      const at = offset + 8;
      if (at + size > bytes.length) throw invalid();
      if (tag === 'VP8X') {
        if (size !== 10 || canvas) throw invalid();
        canvas = { width: le24(at + 4) + 1, height: le24(at + 7) + 1 };
        animated ||= !!(bytes[at] & 2);
      } else if (tag === 'ANIM' || tag === 'ANMF') {
        animated = true;
      } else if (tag === 'VP8 ') {
        if (size < 10 || bytes[at] & 1 || text(at + 3, 3) !== '\x9d\x01\x2a')
          throw invalid();
        frame = {
          width: view.getUint16(at + 6, true) & 0x3fff,
          height: view.getUint16(at + 8, true) & 0x3fff,
        };
        frames++;
      } else if (tag === 'VP8L') {
        if (size < 5 || bytes[at] !== 0x2f || bytes[at + 4] & 0xe0)
          throw invalid();
        const bits = view.getUint32(at + 1, true);
        frame = {
          width: (bits & 0x3fff) + 1,
          height: ((bits >>> 14) & 0x3fff) + 1,
        };
        frames++;
      }
      offset = at + size + (size % 2);
    }
    if (offset !== bytes.length || (!animated && (!frame || frames !== 1)))
      throw invalid();
    if (
      !animated &&
      canvas &&
      frame &&
      (canvas.width !== frame.width || canvas.height !== frame.height)
    )
      throw invalid();
    const dimensions = canvas ?? frame;
    if (!dimensions) throw invalid();
    info = { format: 'webp', ...dimensions, animated };
  } else if (text(0, 6) === 'GIF87a' || text(0, 6) === 'GIF89a') {
    if (bytes.length < 14) throw invalid();
    info = {
      format: 'gif',
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
      animated: false,
    };
    let offset = 13 + (bytes[10] & 0x80 ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0);
    let frames = 0;
    const skipBlocks = () => {
      while (offset < bytes.length) {
        const length = bytes[offset++];
        if (!length) return;
        offset += length;
      }
      throw invalid();
    };
    while (offset < bytes.length) {
      const tag = bytes[offset++];
      if (tag === 0x3b) break;
      if (tag === 0x21) {
        offset++;
        skipBlocks();
      } else if (tag === 0x2c) {
        if (offset + 9 > bytes.length) throw invalid();
        const flags = bytes[offset + 8];
        offset += 9 + (flags & 0x80 ? 3 * 2 ** ((flags & 7) + 1) : 0);
        offset++; // LZW minimum code size, then image data sub-blocks.
        skipBlocks();
        frames++;
      } else throw invalid();
    }
    if (!frames || offset > bytes.length) throw invalid();
    info.animated = frames > 1;
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset++] !== 0xff) throw invalid();
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) throw invalid();
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) throw invalid();
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        if (size < 8) throw invalid();
        info = {
          format: 'jpeg',
          width: view.getUint16(offset + 5),
          height: view.getUint16(offset + 3),
          animated: false,
        };
        break;
      }
      offset += size;
    }
  }
  if (!info || !info.width || !info.height) throw invalid();
  return info;
}

export function imageDimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > MAX_SOURCE_PIXELS ||
    Math.max(width, height) > 16384
  )
    throw new Error(
      'Imagem muito grande. Use até 40 megapixels e 16.384 pixels por lado.',
    );
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
