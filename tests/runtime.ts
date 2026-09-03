import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
export const database = new DatabaseSync(':memory:');
for (const file of readdirSync('drizzle')
  .filter((f) => f.endsWith('.sql'))
  .sort())
  database.exec(readFileSync(`drizzle/${file}`, 'utf8'));
let identity = new Headers();
export function setIdentity(email?: string) {
  identity = new Headers(
    email
      ? {
          'oai-authenticated-user-id': 'local-test-id',
          'oai-authenticated-user-email': email,
        }
      : {},
  );
}
export async function headers() {
  return identity;
}
export function redirect(path: string): never {
  throw new Error(`Redirect: ${path}`);
}
function prepare(sql: string) {
  let args: unknown[] = [];
  return {
    bind(...values: unknown[]) {
      args = values;
      return this;
    },
    async first() {
      return database.prepare(sql).get(...(args as any[])) ?? null;
    },
    async all() {
      return { results: database.prepare(sql).all(...(args as any[])) };
    },
    async run() {
      const result = database.prepare(sql).run(...(args as any[]));
      return {
        meta: {
          changes: Number(result.changes),
          last_row_id: Number(result.lastInsertRowid),
        },
      };
    },
  };
}
const files = new Map<
  string,
  { data: ArrayBuffer; httpMetadata: { contentType: string } }
>();
export const env = {
  ADMIN_EMAILS: 'admin@example.test',
  DB: {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      database.exec('BEGIN');
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        database.exec('COMMIT');
        return results;
      } catch (e) {
        database.exec('ROLLBACK');
        throw e;
      }
    },
  },
  FILES: {
    async put(
      key: string,
      data: ArrayBuffer,
      options: { httpMetadata: { contentType: string } },
    ) {
      files.set(key, { data, httpMetadata: options.httpMetadata });
    },
    async get(key: string) {
      const file = files.get(key);
      return file ? { body: file.data, httpMetadata: file.httpMetadata } : null;
    },
  },
};
