import { env } from 'cloudflare:workers';

// Senha do editor trocada pelo próprio editor. Guardada só como hash
// PBKDF2-SHA256 com sal aleatório (100 mil iterações, o máximo aceito pelo
// Web Crypto dos Workers). Enquanto não houver senha trocada, vale o segredo
// EDITOR_PASSWORD do Worker. Para recuperar o acesso, apague a linha id=1 de
// editor_credentials no console do D1: volta a valer o segredo.
const ALGORITHM = 'pbkdf2-sha256';
export const PASSWORD_ITERATIONS = 100_000;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

type CredentialRow = {
  algorithm: string;
  iterations: number;
  salt: string;
  hash: string;
  updated_at: string;
};

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      key,
      256,
    ),
  );
}

// Comparação em tempo constante para não vazar quantos bytes conferem.
function sameBytes(a: Uint8Array, b: Uint8Array) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function ensureTable() {
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS editor_credentials (id integer PRIMARY KEY NOT NULL, algorithm text NOT NULL, iterations integer NOT NULL, salt text NOT NULL, hash text NOT NULL, updated_at text NOT NULL)',
  ).run();
}

async function readCredential(): Promise<CredentialRow | null> {
  // O Worker público não tem D1: lá nunca há senha trocada.
  if (!env.DB) return null;
  return env.DB.prepare(
    'SELECT algorithm,iterations,salt,hash,updated_at FROM editor_credentials WHERE id=1',
  )
    .first<CredentialRow>()
    .catch(() => null);
}

export async function hasEditorPassword() {
  return Boolean((await readCredential()) || env.EDITOR_PASSWORD);
}

export async function verifyEditorPassword(password: string) {
  if (!password || password.length > PASSWORD_MAX_LENGTH) return false;
  const row = await readCredential();
  if (row) {
    if (row.algorithm !== ALGORITHM) return false;
    return sameBytes(
      await derive(password, fromBase64(row.salt), row.iterations),
      fromBase64(row.hash),
    );
  }
  const secret = env.EDITOR_PASSWORD;
  if (!secret) return false;
  const encoder = new TextEncoder();
  return sameBytes(encoder.encode(password), encoder.encode(secret));
}

// Chave que assina o cookie de sessão. Com senha trocada é o próprio hash
// (nunca sai do servidor): trocar a senha invalida todas as sessões abertas.
export async function editorSessionKey() {
  const row = await readCredential();
  if (row) return `credential:${row.hash}`;
  return env.EDITOR_PASSWORD ?? null;
}

export function validateNewPassword(next: string, current: string) {
  if (next.length < PASSWORD_MIN_LENGTH)
    return `A senha nova precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (next.length > PASSWORD_MAX_LENGTH)
    return `A senha nova pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  if (!next.trim()) return 'A senha nova não pode ser só espaços.';
  if (next === current) return 'A senha nova precisa ser diferente da atual.';
  if (new Set(next).size < 5)
    return 'A senha nova repete poucos caracteres. Misture letras, números e símbolos.';
  return '';
}

export async function changeEditorPassword(current: string, next: string) {
  if (!(await verifyEditorPassword(current)))
    throw new Error('Senha atual incorreta.');
  const problem = validateNewPassword(next, current);
  if (problem) throw new Error(problem);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(next, salt, PASSWORD_ITERATIONS);
  // Confere o hash antes de gravar: se o Worker não der conta do cálculo,
  // a troca falha aqui e a senha atual continua valendo.
  if (!sameBytes(await derive(next, salt, PASSWORD_ITERATIONS), hash))
    throw new Error('Não foi possível conferir a senha nova. Nada foi alterado.');
  await ensureTable();
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO editor_credentials (id,algorithm,iterations,salt,hash,updated_at) VALUES (1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET algorithm=excluded.algorithm,iterations=excluded.iterations,salt=excluded.salt,hash=excluded.hash,updated_at=excluded.updated_at',
  )
    .bind(ALGORITHM, PASSWORD_ITERATIONS, toBase64(salt), toBase64(hash), updatedAt)
    .run();
  return { updatedAt };
}

export async function editorPasswordInfo() {
  const row = await readCredential();
  return { changedInEditor: Boolean(row), updatedAt: row?.updated_at ?? null };
}
