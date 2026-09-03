import { DatabaseSync, backup } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
const target = resolve(process.argv[2] ?? '');
const allowed =
  resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject') + sep;
if (
  !target.startsWith(allowed) ||
  !target.endsWith('.sqlite') ||
  target.endsWith('metadata.sqlite')
)
  throw new Error('Destino local inválido.');
const db = new DatabaseSync(target);
const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
if (count !== 6)
  throw new Error('O banco mudou. Revise os dados antes da importação.');
const demos = [
  ['MO-1048', 'Cadeira Aurora'],
  ['IL-2084', 'Luminária Orbe'],
  ['MO-3021', 'Poltrona Nômade'],
  ['MO-4110', 'Mesa Atlas'],
  ['IL-5027', 'Pendente Íris'],
  ['MO-6073', 'Sofá Horizonte'],
];
for (const [code, name] of demos)
  if (
    !db
      .prepare('SELECT id FROM products WHERE code=? AND name=?')
      .get(code, name)
  )
    throw new Error('Um exemplo foi alterado. Preserve e revise manualmente.');
const backupPath = resolve('work/local-before-spreadsheet-import.sqlite');
if (existsSync(backupPath))
  throw new Error('Backup já existe. Não sobrescrever.');
await backup(db, backupPath);
db.exec('BEGIN');
try {
  // Reconcile the original preview's partial schema using the original generated DDL.
  for (const statement of readFileSync(
    'drizzle/0000_tricky_madelyne_pryor.sql',
    'utf8',
  )
    .split('--> statement-breakpoint')
    .filter((s) => s.trim())) {
    const name = statement.match(
      /CREATE (?:UNIQUE INDEX|TABLE) `([^`]+)`/,
    )?.[1];
    if (!name) throw new Error('DDL inesperado.');
    if (!db.prepare('SELECT name FROM sqlite_schema WHERE name=?').get(name))
      db.exec(statement);
  }
  db.exec(readFileSync('drizzle/0001_mysterious_violations.sql', 'utf8'));
  db.exec(readFileSync('drizzle/0002_flawless_redwing.sql', 'utf8'));
  for (const [code, name] of demos)
    db.prepare('DELETE FROM products WHERE code=? AND name=?').run(code, name);
  db.exec(readFileSync('drizzle/0003_import_produtos.sql', 'utf8'));
  const imported = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (imported !== 2525) throw new Error('Contagem inesperada.');
  db.exec('COMMIT');
  console.log(
    JSON.stringify({ imported, backup: backupPath, removedDemoCount: 6 }),
  );
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  db.close();
}
