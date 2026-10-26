import { env } from 'cloudflare:workers';

// Autenticador (TOTP, RFC 6238) do editor: código de 6 dígitos que muda a
// cada 30 segundos (Google/Microsoft Authenticator, Authy...). O segredo fica
// no D1 do editor; os códigos de recuperação, só como hash SHA-256. Um código
// já usado não vale de novo. Para desligar sem o celular, apague a linha
// id=1 de editor_totp no console do D1.
const PERIOD = 30;
const DIGITS = 6;
const ENROLL_MINUTES = 15;
const RECOVERY_CODES = 8;
const ISSUER = 'Catálogo Laurencini';
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

type TotpRow = {
  secret: string | null;
  pending_secret: string | null;
  pending_at: string | null;
  enabled_at: string | null;
  last_step: number;
  recovery: string;
};

function toBase32(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(text: string) {
  const clean = text.replace(/[\s=]/g, '').toUpperCase();
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error('Segredo do autenticador inválido.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export async function totpCode(secret: string, step: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    fromBase32(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const counter = new Uint8Array(8);
  new DataView(counter.buffer).setBigUint64(0, BigInt(step));
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter));
  const offset = hash[hash.length - 1] & 15;
  const number =
    ((hash[offset] & 127) << 24) |
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3];
  return String(number % 10 ** DIGITS).padStart(DIGITS, '0');
}

// Aceita o código do passo atual e de um passo antes/depois (relógio do
// celular um pouco adiantado ou atrasado). Devolve o passo usado.
async function matchStep(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 1000 / PERIOD);
  for (const step of [current, current - 1, current + 1])
    if ((await totpCode(secret, step)) === code) return step;
  return null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const normalizeRecovery = (value: string) =>
  value.replace(/[\s-]/g, '').toUpperCase();

async function ensureTable() {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS editor_totp (id integer PRIMARY KEY NOT NULL, secret text, pending_secret text, pending_at text, enabled_at text, last_step integer NOT NULL DEFAULT 0, recovery text NOT NULL DEFAULT '[]')",
  ).run();
}

async function readRow(): Promise<TotpRow | null> {
  // O Worker público não tem D1.
  if (!env.DB) return null;
  return env.DB.prepare(
    'SELECT secret,pending_secret,pending_at,enabled_at,last_step,recovery FROM editor_totp WHERE id=1',
  )
    .first<TotpRow>()
    .catch(() => null);
}

// Segredo ativo (entra na chave da sessão: sem ele não dá para forjar o
// cookie só com a senha).
export async function activeTotpSecret() {
  const row = await readRow();
  return row?.secret && row.enabled_at ? row.secret : null;
}

export async function totpStatus() {
  const row = await readRow();
  return {
    ...(await totpAttempts()),
    enabled: Boolean(row?.secret && row.enabled_at),
    enabledAt: row?.enabled_at ?? null,
    recoveryLeft: row?.secret
      ? (JSON.parse(row.recovery) as string[]).length
      : 0,
  };
}

export async function startTotpEnrollment() {
  if (await activeTotpSecret())
    throw new Error('O autenticador já está ativo.');
  const secret = toBase32(crypto.getRandomValues(new Uint8Array(20)));
  await ensureTable();
  await env.DB.prepare(
    "INSERT INTO editor_totp (id,pending_secret,pending_at,last_step,recovery) VALUES (1,?,?,0,'[]') ON CONFLICT(id) DO UPDATE SET pending_secret=excluded.pending_secret,pending_at=excluded.pending_at",
  )
    .bind(secret, new Date().toISOString())
    .run();
  const label = encodeURIComponent(`${ISSUER}:editor`);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`;
  return { secret, uri };
}

export async function confirmTotpEnrollment(code: string) {
  const row = await readRow();
  if (!row?.pending_secret || !row.pending_at)
    throw new Error('Comece a ativação de novo.');
  if (Date.now() - Date.parse(row.pending_at) > ENROLL_MINUTES * 60_000)
    throw new Error('A ativação expirou. Comece de novo e escaneie o QR code novo.');
  const step = await matchStep(row.pending_secret, code.trim());
  if (step === null)
    throw new Error('Código incorreto. Confira o código no app e tente de novo.');
  const codes = Array.from({ length: RECOVERY_CODES }, () => {
    const raw = toBase32(crypto.getRandomValues(new Uint8Array(5)));
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
  const hashes = await Promise.all(codes.map((c) => sha256(normalizeRecovery(c))));
  const result = await env.DB.prepare(
    'UPDATE editor_totp SET secret=pending_secret, pending_secret=NULL, pending_at=NULL, enabled_at=?, last_step=?, recovery=? WHERE id=1 AND pending_secret=?',
  )
    .bind(new Date().toISOString(), step, JSON.stringify(hashes), row.pending_secret)
    .run();
  if (!result.meta.changes) throw new Error('Comece a ativação de novo.');
  return { recoveryCodes: codes };
}

// Confere o segundo fator: código do app (uma vez só) ou código de
// recuperação (some depois de usado).
export async function verifySecondFactor(input: string) {
  const row = await readRow();
  if (!row?.secret || !row.enabled_at) return false;
  const value = input.trim();
  if (/^\d{6}$/.test(value)) {
    const step = await matchStep(row.secret, value);
    if (step === null || step <= row.last_step) return false;
    const updated = await env.DB.prepare(
      'UPDATE editor_totp SET last_step=? WHERE id=1 AND last_step<?',
    )
      .bind(step, step)
      .run();
    return Boolean(updated.meta.changes);
  }
  const normalized = normalizeRecovery(value);
  if (!/^[A-Z2-7]{8}$/.test(normalized)) return false;
  const hash = await sha256(normalized);
  const hashes = JSON.parse(row.recovery) as string[];
  if (!hashes.includes(hash)) return false;
  const updated = await env.DB.prepare(
    'UPDATE editor_totp SET recovery=? WHERE id=1 AND recovery=?',
  )
    .bind(JSON.stringify(hashes.filter((h) => h !== hash)), row.recovery)
    .run();
  return Boolean(updated.meta.changes);
}

export async function disableTotp(code: string) {
  if (!(await verifySecondFactor(code)))
    throw new Error('Código do autenticador ou de recuperação incorreto.');
  await env.DB.prepare('DELETE FROM editor_totp WHERE id=1').run();
}

// Limite geral de códigos errados, somando todos os IPs (o limitador da
// Cloudflare conta por IP e por data center). Só chega aqui quem já passou
// pela senha: 10 erros em 15 minutos pausam as tentativas por 15 minutos.
const THROTTLE_KEY = 'totp';
const THROTTLE_WINDOW_MS = 15 * 60_000;
const THROTTLE_MAX_FAILURES = 10;

type ThrottleRow = {
  failures: number;
  window_start: string;
  locked_until: string | null;
};

async function ensureThrottleTable() {
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS auth_throttle (key text PRIMARY KEY NOT NULL, failures integer NOT NULL DEFAULT 0, window_start text NOT NULL, locked_until text)',
  ).run();
}

async function readThrottle(): Promise<ThrottleRow | null> {
  if (!env.DB) return null;
  return env.DB.prepare(
    'SELECT failures,window_start,locked_until FROM auth_throttle WHERE key=?',
  )
    .bind(THROTTLE_KEY)
    .first<ThrottleRow>()
    .catch(() => null);
}

export async function totpLockedUntil() {
  const row = await readThrottle();
  return row?.locked_until && Date.parse(row.locked_until) > Date.now()
    ? row.locked_until
    : null;
}

export async function recordTotpFailure() {
  await ensureThrottleTable();
  const now = Date.now();
  const row = await readThrottle();
  const fresh = !row || now - Date.parse(row.window_start) > THROTTLE_WINDOW_MS;
  const failures = fresh ? 1 : row.failures + 1;
  const windowStart = fresh ? new Date(now).toISOString() : row.window_start;
  const lockedUntil =
    failures >= THROTTLE_MAX_FAILURES
      ? new Date(now + THROTTLE_WINDOW_MS).toISOString()
      : (row?.locked_until ?? null);
  await env.DB.prepare(
    'INSERT INTO auth_throttle (key,failures,window_start,locked_until) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,window_start=excluded.window_start,locked_until=excluded.locked_until',
  )
    .bind(THROTTLE_KEY, failures, windowStart, lockedUntil)
    .run();
}

export async function resetTotpFailures() {
  if (!(await readThrottle())) return;
  await env.DB.prepare(
    'UPDATE auth_throttle SET failures=0, locked_until=NULL WHERE key=?',
  )
    .bind(THROTTLE_KEY)
    .run();
}

// Para a aba Segurança: códigos errados recentes e pausa em andamento.
export async function totpAttempts() {
  const row = await readThrottle();
  const recent =
    row && Date.now() - Date.parse(row.window_start) <= THROTTLE_WINDOW_MS
      ? row.failures
      : 0;
  return { recentFailures: recent, lockedUntil: await totpLockedUntil() };
}
