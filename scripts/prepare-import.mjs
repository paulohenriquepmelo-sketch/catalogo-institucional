import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('drizzle-kit'))('esbuild');
await build({
  entryPoints: ['scripts/import-products.ts'],
  outfile: 'work/import-products.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const result = spawnSync(
  process.execPath,
  ['work/import-products.mjs', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
