import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from 'cloudflare:workers';
import { editorSessionKey } from '@/lib/editor-credentials';

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  // 'session': password login cookie signed by this Worker.
  // 'header': identity injected by a trusted proxy (oai-authenticated-*).
  source: 'session' | 'header';
};

export const EDITOR_SESSION_COOKIE = 'catalogo_editor_session';
const EDITOR_SESSION_TTL_SECONDS = 8 * 60 * 60;

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  // On Cloudflare any client can send oai-authenticated-* headers, so they are
  // only trusted when a proxy that sets them is explicitly configured.
  const trustHeaders = env.TRUST_IDENTITY_HEADERS === 'true';
  const userId = trustHeaders
    ? requestHeaders.get('oai-authenticated-user-id')
    : null;
  const email = trustHeaders
    ? requestHeaders.get('oai-authenticated-user-email')
    : null;
  if (!userId || !email) {
    if (await hasValidEditorSession(requestHeaders.get('cookie'))) {
      const sessionEmail = env.EDITOR_ADMIN_EMAIL ?? 'admin@catalogo.local';
      const sessionName = env.EDITOR_ADMIN_NAME ?? 'Administrador';
      return {
        userId: 'editor-password',
        displayName: sessionName,
        email: sessionEmail,
        fullName: sessionName,
        source: 'session',
      };
    }
    return null;
  }
  const encodedName = requestHeaders.get('oai-authenticated-user-full-name');
  const fullName =
    encodedName &&
    requestHeaders.get('oai-authenticated-user-full-name-encoding') ===
      'percent-encoded-utf-8'
      ? safeDecode(encodedName)
      : null;
  return {
    userId,
    email,
    fullName,
    displayName: fullName ?? email,
    source: 'header',
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(
    `/editor/login?return_to=${encodeURIComponent(safeReturnTo(returnTo))}`,
  );
}

export async function createEditorSession() {
  const key = await editorSessionKey();
  if (!key) throw new Error('Senha do editor não configurada.');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await signSessionValue(timestamp, key);
  return `${timestamp}.${signature}`;
}

export function setEditorSessionCookie(value: string, requestUrl: string) {
  const secure = new URL(requestUrl).protocol === 'https:';
  return `${EDITOR_SESSION_COOKIE}=${value}; Path=/; Max-Age=${EDITOR_SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

// Etapa do código do autenticador: depois da senha certa, um cookie de 5
// minutos prova que a senha já foi conferida. Assinado com a chave da sessão.
export const EDITOR_MFA_COOKIE = 'catalogo_editor_mfa';
const MFA_TTL_SECONDS = 5 * 60;

export async function createMfaChallenge(requestUrl: string) {
  const key = await editorSessionKey();
  if (!key) throw new Error('Senha do editor não configurada.');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await signSessionValue(`mfa:${timestamp}`, key);
  const secure = new URL(requestUrl).protocol === 'https:';
  return `${EDITOR_MFA_COOKIE}=${timestamp}.${signature}; Path=/; Max-Age=${MFA_TTL_SECONDS}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

export function clearMfaChallenge(requestUrl: string) {
  const secure = new URL(requestUrl).protocol === 'https:';
  return `${EDITOR_MFA_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

export async function hasValidMfaChallenge(cookieHeader: string | null) {
  const value = (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${EDITOR_MFA_COOKIE}=`))
    ?.slice(EDITOR_MFA_COOKIE.length + 1);
  const [timestamp, signature] = (value ?? '').split('.');
  const issuedAt = Number(timestamp);
  if (!timestamp || !signature || !Number.isInteger(issuedAt)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now + 60 || now - issuedAt > MFA_TTL_SECONDS) return false;
  const key = await editorSessionKey();
  if (!key) return false;
  try {
    return await verifySessionValue(`mfa:${timestamp}`, signature, key);
  } catch {
    return false;
  }
}

export function clearEditorSessionCookie(requestUrl: string) {
  const secure = new URL(requestUrl).protocol === 'https:';
  return `${EDITOR_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

async function hasValidEditorSession(cookieHeader: string | null) {
  if (!cookieHeader) return false;
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${EDITOR_SESSION_COOKIE}=`));
  const value = cookie?.slice(`${EDITOR_SESSION_COOKIE}=`.length) ?? '';
  const [timestamp, signature] = value.split('.');
  const issuedAt = Number(timestamp);
  if (!timestamp || !signature || !Number.isInteger(issuedAt)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now + 60 || now - issuedAt > EDITOR_SESSION_TTL_SECONDS)
    return false;
  const key = await editorSessionKey();
  if (!key) return false;
  try {
    return await verifySessionValue(timestamp, signature, key);
  } catch {
    return false;
  }
}

async function signSessionValue(value: string, password: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  );
  return toBase64Url(new Uint8Array(signature));
}

async function verifySessionValue(
  value: string,
  signature: string,
  password: string,
) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    fromBase64Url(signature),
    new TextEncoder().encode(value),
  );
}

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function safeReturnTo(value: string) {
  return value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\\r\n]/.test(value)
    ? value
    : '/';
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
