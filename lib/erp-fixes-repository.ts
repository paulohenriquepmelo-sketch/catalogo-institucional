import { env } from 'cloudflare:workers';
import { getConfig } from './catalog-repository';
import { defaultErpFixes, validateErpFixes, type ErpFixes } from './erp-fixes';

// A tabela vem da migration 0007; criar aqui também evita depender de alguém
// aplicar a migration no banco de produção antes do primeiro uso.
async function ensureTable() {
  await env.DB.batch([
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS erp_fixes (id integer PRIMARY KEY NOT NULL, body text NOT NULL, revision integer DEFAULT 1 NOT NULL)',
    ),
    env.DB.prepare(
      'INSERT OR IGNORE INTO erp_fixes (id,body,revision) VALUES (1,?,1)',
    ).bind(JSON.stringify(defaultErpFixes)),
  ]);
}

export async function getErpFixes(): Promise<{ fixes: ErpFixes; revision: number }> {
  let row = await env.DB.prepare('SELECT body,revision FROM erp_fixes WHERE id=1')
    .first<{ body: string; revision: number }>()
    .catch(() => null);
  if (!row) {
    await ensureTable();
    row = await env.DB.prepare('SELECT body,revision FROM erp_fixes WHERE id=1').first<{
      body: string;
      revision: number;
    }>();
  }
  if (!row) throw new Error('Correções indisponíveis.');
  const stored = JSON.parse(row.body) as Partial<ErpFixes>;
  return {
    fixes: {
      abbreviations: stored.abbreviations ?? [],
      products: stored.products ?? [],
      ignored: stored.ignored ?? [],
    },
    revision: row.revision,
  };
}

export async function saveErpFixes(value: unknown, revision: number) {
  const { config } = await getConfig();
  const fixes = validateErpFixes(value, config.taxonomy);
  await getErpFixes();
  const saved = await env.DB.prepare(
    'UPDATE erp_fixes SET body=?,revision=revision+1 WHERE id=1 AND revision=?',
  )
    .bind(JSON.stringify(fixes), revision)
    .run();
  if (!saved.meta.changes)
    throw new Error('As correções mudaram em outra sessão. Recarregue antes de salvar.');
  return { fixes, revision: revision + 1 };
}
