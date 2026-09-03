import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageDimensions, inspectImage } from '../lib/image-policy';
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
