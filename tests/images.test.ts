import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  imageDimensions,
  inspectImage,
  productContentBox,
  productFrame,
} from '../lib/image-policy';
import { optimizeImage, optimizationSummary } from '../lib/optimize-image';
import { storeImage } from '../lib/image-storage';
import { GET as getUpload } from '../app/api/uploads/route';
import { env } from './runtime';
import { webp, staticPng, staticGif, jpeg } from './image-fixtures';

void test('actual formats, dimensions, transparency flags and invalid signatures', () => {
  for (const [format, bytes] of [
    ['webp', webp],
    ['png', staticPng],
    ['gif', staticGif],
    ['jpeg', jpeg],
  ] as const) {
    assert.deepEqual(inspectImage(bytes), {
      format,
      width: 2,
      height: 3,
      animated: false,
    });
  }
  assert.throws(
    () => inspectImage(new TextEncoder().encode('RIFF0000WEBPspoofed-payload')),
    /inválida/,
  );
  assert.throws(() => inspectImage(webp.slice(0, 30)), /inválida/);
  const oversizedChunk = new Uint8Array(webp);
  new DataView(oversizedChunk.buffer).setUint32(16, 0xffffffff, true);
  assert.throws(() => inspectImage(oversizedChunk));
  assert.deepEqual(imageDimensions(4000, 3000), { width: 1920, height: 1440 });
  assert.deepEqual(imageDimensions(3000, 4000), { width: 1440, height: 1920 });
  assert.deepEqual(imageDimensions(24, 16), { width: 24, height: 16 });
  assert.throws(() => imageDimensions(16000, 16000), /grande/);
});

void test('conversion preserves product code, requests WebP and releases memory', async () => {
  const originalBitmap = Object.getOwnPropertyDescriptor(
    globalThis,
    'createImageBitmap',
  );
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  let closed = 0;
  const drawn: number[][] = [];
  const qualities: number[] = [];
  let outputType = 'image/webp';
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: (_bitmap: unknown, ...dimensions: number[]) =>
        drawn.push(dimensions),
    }),
    toBlob: (callback: (b: Blob) => void, type: string, quality: number) => {
      assert.equal(type, 'image/webp');
      qualities.push(quality);
      callback(new Blob([webp], { type: outputType }));
    },
  };
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true,
    value: async () => ({ width: 2, height: 3, close: () => closed++ }),
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => canvas },
  });
  try {
    for (const [extension, bytes] of [
      ['PNG', staticPng],
      ['jpeg', jpeg],
      ['gif', staticGif],
    ] as const) {
      const converted = await optimizeImage(
        new File([bytes], `00123_frente.${extension}`),
      );
      assert.equal(converted.file.name, '00123_frente.webp');
      assert.equal(converted.file.type, 'image/webp');
      assert.equal(converted.originalBytes, bytes.length);
      assert.deepEqual(
        new Uint8Array(await converted.file.arrayBuffer()),
        webp,
      );
      assert.deepEqual(drawn.at(-1), [0, 0, 2, 3]);
      assert.equal(qualities.at(-1), 0.82);
      assert.equal(canvas.width, 0);
      assert.equal(canvas.height, 0);
    }
    assert.equal(closed, 3);
    outputType = 'image/png';
    await assert.rejects(
      () => optimizeImage(new File([staticPng], 'fail.png')),
      /WebP/,
    );
    assert.equal(closed, 4);
    assert.equal(canvas.width, 0);
  } finally {
    if (originalBitmap)
      Object.defineProperty(globalThis, 'createImageBitmap', originalBitmap);
    else Reflect.deleteProperty(globalThis, 'createImageBitmap');
    if (originalDocument)
      Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

void test('small WebP is not re-encoded; animations and huge sources fail before upload', async () => {
  const converted = await optimizeImage(new File([webp], '00123.webp'));
  assert.deepEqual(new Uint8Array(await converted.file.arrayBuffer()), webp);
  const animated = new Uint8Array(webp);
  animated[20] |= 2;
  assert.equal(inspectImage(animated).animated, true);
  await assert.rejects(
    () => optimizeImage(new File([animated], 'animation.webp')),
    /animadas/,
  );
  // Append another complete GIF frame, excluding the original trailer.
  const frameStart = staticGif.indexOf(0x2c, 20);
  const gif = Uint8Array.from([
    ...staticGif.slice(0, -1),
    ...staticGif.slice(frameStart),
  ]);
  assert.equal(inspectImage(gif).animated, true);
  await assert.rejects(
    () => optimizeImage(new File([gif], 'animation.gif')),
    /animadas/,
  );
  await assert.rejects(
    () =>
      optimizeImage(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png'),
      ),
    /5 MB/,
  );
  const summary = optimizationSummary({ ...converted, originalBytes: 1000 });
  assert.match(summary, /% menor/);
  assert.doesNotMatch(
    optimizationSummary({ ...converted, originalBytes: 1 }),
    /% menor/,
  );
});

void test('storage accepts only static, bounded WebP and keeps legacy images readable', async () => {
  const stored = await storeImage(new File([webp], '00123.webp'));
  assert.match(stored.key, /\.webp$/);
  assert.equal(stored.bytes, webp.length);
  await assert.rejects(
    () => storeImage(new File([staticPng], 'disguised.webp')),
    /WebP/,
  );
  const animated = new Uint8Array(webp);
  animated[20] |= 2;
  await assert.rejects(
    () => storeImage(new File([animated], 'animated.webp')),
    /WebP/,
  );
  const key = 'images/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png';
  await env.FILES.put(key, staticPng.buffer.slice(0), {
    httpMetadata: { contentType: 'image/png' },
  });
  const response = await getUpload(
    new Request(
      'https://catalog.test/api/uploads?key=' + encodeURIComponent(key),
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
});

// RGBA pixels: white background with a colored block at the given rectangle.
function pixels(
  width: number,
  height: number,
  block: { x: number; y: number; width: number; height: number },
  background = [255, 255, 255, 255],
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const inside =
        x >= block.x &&
        x < block.x + block.width &&
        y >= block.y &&
        y < block.y + block.height;
      data.set(inside ? [200, 30, 30, 255] : background, (y * width + x) * 4);
    }
  return data;
}

void test('product box ignores white or transparent margins', () => {
  const block = { x: 30, y: 10, width: 20, height: 70 };
  assert.deepEqual(productContentBox(pixels(100, 100, block), 100, 100), {
    ...block,
    transparent: false,
  });
  assert.deepEqual(
    productContentBox(pixels(100, 100, block, [0, 0, 0, 0]), 100, 100),
    { ...block, transparent: true },
  );
  // Near-white JPEG noise is still background; a blank image has no box.
  assert.equal(
    productContentBox(pixels(10, 10, block, [246, 248, 250, 255]), 4, 4),
    undefined,
  );
});

void test('product frame is square, centered, keeps margin and never upscales', () => {
  assert.deepEqual(productFrame(400, 1400), {
    side: 1080,
    x: 404,
    y: 65,
    width: 272,
    height: 950,
  });
  // Small photo: frame grows only by the margin, the product keeps its size.
  const small = productFrame(100, 200);
  assert.equal(small.side, 227);
  assert.equal(small.height, 200);
  assert.equal(small.x, 64);
});

void test('product conversion crops margins and centers on a white square', async () => {
  const originalBitmap = Object.getOwnPropertyDescriptor(
    globalThis,
    'createImageBitmap',
  );
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  const drawn: number[][] = [];
  const filled: string[] = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      fillStyle: '',
      fillRect(this: { fillStyle: string }) {
        filled.push(this.fillStyle);
      },
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: pixels(w, h, { x: 30, y: 10, width: 20, height: 70 }),
      }),
      drawImage: (_bitmap: unknown, ...dimensions: number[]) =>
        drawn.push(dimensions),
    }),
    toBlob: (callback: (b: Blob) => void) =>
      callback(new Blob([webp], { type: 'image/webp' })),
  };
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true,
    value: async () => ({ width: 100, height: 100, close: () => {} }),
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => canvas },
  });
  try {
    // The fixture WebP is 2x3, so validation of the encoded size fails;
    // what matters here is how the photo was drawn before encoding.
    await assert.rejects(
      () => optimizeImage(new File([webp], '00123.webp'), { product: true }),
      /validar/,
    );
    assert.deepEqual(drawn[0], [0, 0, 100, 100]);
    assert.deepEqual(drawn[1], [30, 10, 20, 70, 30, 5, 20, 70]);
    assert.deepEqual(filled, ['#fff']);
  } finally {
    if (originalBitmap)
      Object.defineProperty(globalThis, 'createImageBitmap', originalBitmap);
    else Reflect.deleteProperty(globalThis, 'createImageBitmap');
    if (originalDocument)
      Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
