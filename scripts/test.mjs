import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('drizzle-kit'))('esbuild');
for (const name of [
  'catalog',
  'import',
  'campaign',
  'images',
  'colors',
  'brands',
  'logos',
])
  await build({
    entryPoints: [`tests/${name}.test.ts`],
    outfile: `work/${name}-tests.mjs`,
    bundle: true,
    platform: 'node',
    format: 'esm',
    banner: {
      js: "import { createRequire as testCreateRequire } from 'node:module'; const require = testCreateRequire(import.meta.url);",
    },
    external: ['read-excel-file/node', 'react', 'react-dom/server'],
    alias: {
      'cloudflare:workers': resolve('tests/runtime.ts'),
      'next/headers': resolve('tests/runtime.ts'),
      'next/navigation': resolve('tests/runtime.ts'),
    },
  });
const result = spawnSync(
  process.execPath,
  [
    '--test',
    'work/catalog-tests.mjs',
    'work/import-tests.mjs',
    'work/campaign-tests.mjs',
    'work/images-tests.mjs',
    'work/colors-tests.mjs',
    'work/brands-tests.mjs',
    'work/logos-tests.mjs',
  ],
  { stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
