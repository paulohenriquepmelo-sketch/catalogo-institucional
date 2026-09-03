import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('drizzle-kit'))('esbuild');
await build({
  entryPoints: ['tests/catalog.test.ts'],
  outfile: 'work/catalog-tests.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  alias: {
    'cloudflare:workers': resolve('tests/runtime.ts'),
    'next/headers': resolve('tests/runtime.ts'),
    'next/navigation': resolve('tests/runtime.ts'),
  },
});
const result = spawnSync(
  process.execPath,
  ['--test', 'work/catalog-tests.mjs'],
  { stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
