import { env } from 'cloudflare:workers';
import { listCatalogProducts } from './catalog-repository';
import { sortForCatalog } from './catalog-pdf';
import type { Product } from './catalog-data';

// Revisão do catálogo pelo compras: o editor gera um link (com validade) para
// uma lista de categorias ou fornecedores; o comprador marca os itens que
// saíram de linha e envia; o editor aprova ou recusa. Item aprovado vira
// "Fora de linha" (sai do site, do app e do PDF) e a importação do ERP não o
// traz de volta. O comprador entra com uma chave de 64 caracteres
// hexadecimais (256 bits, como a de um certificado); só o hash SHA-256 dela
// fica guardado, e a sessão do comprador é assinada com esse hash.

export type ReviewFilter = {
  kind: 'category' | 'supplier';
  values: string[];
};
export type ReviewLink = {
  id: string;
  label: string;
  filter: ReviewFilter;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  requests: number;
  active: boolean;
};
export type ReviewItem = { code: string; name: string; brand: string };
export type ReviewRequest = {
  id: string;
  linkId: string;
  linkLabel: string;
  buyer: string;
  note: string;
  items: ReviewItem[];
  createdAt: string;
  status: 'pendente' | 'aprovado' | 'parcial' | 'recusado';
  decidedAt: string | null;
  approved: string[];
};
export type ReviewProduct = Pick<
  Product,
  'code' | 'name' | 'brand' | 'image' | 'department' | 'section' | 'category'
> & { supplier: string };

export const REVIEW_MAX_DAYS = 30;
const MAX_FILTER_VALUES = 50;
const MAX_ITEMS = 3000;
const ACCESS_KEY = /^[0-9a-f]{64}$/;
export const REVIEW_SESSION_COOKIE = 'catalogo_compras_session';

const toHex = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return toHex(new Uint8Array(digest));
}

async function ensureTables() {
  await env.DB.batch([
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS review_links (id text PRIMARY KEY NOT NULL, token_hash text NOT NULL UNIQUE, label text NOT NULL, filter text NOT NULL, created_at text NOT NULL, expires_at text NOT NULL, revoked_at text)',
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS review_requests (id text PRIMARY KEY NOT NULL, link_id text NOT NULL, buyer text NOT NULL, note text NOT NULL DEFAULT '', items text NOT NULL, created_at text NOT NULL, status text NOT NULL DEFAULT 'pendente', decided_at text, approved text NOT NULL DEFAULT '[]')",
    ),
  ]);
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

export function validateReviewFilter(value: unknown): ReviewFilter {
  const input = value as Partial<ReviewFilter> | null;
  if (!input || (input.kind !== 'category' && input.kind !== 'supplier'))
    throw new Error('Escolha filtrar por categorias ou por fornecedores.');
  const values = Array.isArray(input.values)
    ? [...new Set(input.values.map((v) => text(v, 180)).filter(Boolean))]
    : [];
  if (!values.length)
    throw new Error(
      input.kind === 'category'
        ? 'Escolha pelo menos uma categoria.'
        : 'Escolha pelo menos um fornecedor.',
    );
  if (values.length > MAX_FILTER_VALUES)
    throw new Error(`Escolha no máximo ${MAX_FILTER_VALUES} itens no filtro.`);
  return { kind: input.kind, values };
}

function matches(product: Product, filter: ReviewFilter) {
  const value =
    filter.kind === 'category' ? product.category : (product.details?.supplier ?? '');
  return filter.values.includes(value);
}

export async function createReviewLink(input: {
  label: unknown;
  filter: unknown;
  days: unknown;
}) {
  const filter = validateReviewFilter(input.filter);
  const days = Number(input.days);
  if (!Number.isInteger(days) || days < 1 || days > REVIEW_MAX_DAYS)
    throw new Error(`Validade de 1 a ${REVIEW_MAX_DAYS} dias.`);
  const label =
    text(input.label, 80) ||
    (filter.kind === 'category' ? 'Categorias' : 'Fornecedores') +
      ': ' +
      filter.values.slice(0, 3).join(', ');
  await ensureTables();
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 86_400_000).toISOString();
  await env.DB.prepare(
    'INSERT INTO review_links (id,token_hash,label,filter,created_at,expires_at) VALUES (?,?,?,?,?,?)',
  )
    .bind(id, await sha256(token), label, JSON.stringify(filter), now.toISOString(), expiresAt)
    .run();
  return { id, token, label, expiresAt };
}

export async function listReviewLinks(): Promise<ReviewLink[]> {
  await ensureTables();
  const rows = await env.DB.prepare(
    'SELECT l.id,l.label,l.filter,l.created_at,l.expires_at,l.revoked_at, (SELECT COUNT(*) FROM review_requests r WHERE r.link_id=l.id) AS requests FROM review_links l ORDER BY l.created_at DESC LIMIT 100',
  ).all<{
    id: string;
    label: string;
    filter: string;
    created_at: string;
    expires_at: string;
    revoked_at: string | null;
    requests: number;
  }>();
  return rows.results.map((r) => ({
    id: r.id,
    label: r.label,
    filter: JSON.parse(r.filter) as ReviewFilter,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at ?? null,
    requests: Number(r.requests) || 0,
    active: !r.revoked_at && Date.parse(r.expires_at) > Date.now(),
  }));
}

export async function revokeReviewLink(id: unknown) {
  await ensureTables();
  const result = await env.DB.prepare(
    'UPDATE review_links SET revoked_at=? WHERE id=? AND revoked_at IS NULL',
  )
    .bind(new Date().toISOString(), text(id, 64))
    .run();
  if (!result.meta.changes) throw new Error('Link não encontrado ou já cancelado.');
}

type ActiveLink = {
  id: string;
  label: string;
  filter: ReviewFilter;
  expiresAt: string;
  tokenHash: string;
};

async function activeLink(
  where: 'id' | 'token_hash',
  value: string,
): Promise<ActiveLink | null> {
  const row = await env.DB.prepare(
    `SELECT id,label,filter,expires_at,revoked_at,token_hash FROM review_links WHERE ${where}=?`,
  )
    .bind(value)
    .first<{
      id: string;
      label: string;
      filter: string;
      expires_at: string;
      revoked_at: string | null;
      token_hash: string;
    }>()
    .catch(() => null);
  if (!row || row.revoked_at || Date.parse(row.expires_at) <= Date.now())
    return null;
  return {
    id: row.id,
    label: row.label,
    filter: JSON.parse(row.filter) as ReviewFilter,
    expiresAt: row.expires_at,
    tokenHash: row.token_hash,
  };
}

// Chave válida: existe, não foi cancelada e não venceu. Senão, null.
export async function resolveReviewKey(key: string) {
  const normalized = key.replace(/\s+/g, '').toLowerCase();
  if (!ACCESS_KEY.test(normalized)) return null;
  return activeLink('token_hash', await sha256(normalized));
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)),
    ),
  );
}

// Sessão do comprador: "<id do link>.<emissão>.<assinatura>", assinada com o
// hash da chave. Cancelar ou vencer o link derruba a sessão na hora.
export async function createReviewSession(link: ActiveLink) {
  const issued = String(Math.floor(Date.now() / 1000));
  return `${link.id}.${issued}.${await hmac(link.tokenHash, `${link.id}.${issued}`)}`;
}

export function reviewSessionCookie(value: string, requestUrl: string, maxAge: number) {
  const secure = new URL(requestUrl).protocol === 'https:';
  return `${REVIEW_SESSION_COOKIE}=${value}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAge))}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

export async function reviewLinkFromCookie(cookieHeader: string | null) {
  const value = (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REVIEW_SESSION_COOKIE}=`))
    ?.slice(REVIEW_SESSION_COOKIE.length + 1);
  const [id, issued, signature] = (value ?? '').split('.');
  if (!id || !issued || !signature || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const link = await activeLink('id', id);
  if (!link) return null;
  const expected = await hmac(link.tokenHash, `${id}.${issued}`);
  let diff = expected.length ^ signature.length;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ (signature.charCodeAt(i) || 0);
  return diff === 0 ? link : null;
}

// Produtos publicados do filtro, na ordem do catálogo impresso.
export async function reviewProducts(filter: ReviewFilter): Promise<ReviewProduct[]> {
  // Com detalhes internos (fornecedor), mas só os publicados.
  const products = (await listCatalogProducts(true)).filter(
    (p) => p.published && !p.details?.outOfCatalog && matches(p, filter),
  );
  return sortForCatalog(products).map((p) => ({
    code: p.code,
    name: p.name,
    brand: p.brand,
    image: p.image,
    department: p.department,
    section: p.section,
    category: p.category,
    supplier: (p as Product).details?.supplier ?? '',
  }));
}

// Valores disponíveis para montar o filtro no editor.
export async function reviewFilterOptions() {
  const products = (await listCatalogProducts(true)).filter((p) => p.published);
  const count = (values: string[]) => {
    const map = new Map<string, number>();
    for (const v of values) if (v) map.set(v, (map.get(v) ?? 0) + 1);
    return [...map].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true }));
  };
  const active = products.filter((p) => !p.details?.outOfCatalog);
  return {
    categories: count(active.map((p) => p.category)),
    suppliers: count(active.map((p) => p.details?.supplier ?? '')),
  };
}

export async function submitReview(
  link: { id: string; filter: ReviewFilter },
  input: { buyer: unknown; note: unknown; codes: unknown },
) {
  const buyer = text(input.buyer, 80);
  if (buyer.length < 2) throw new Error('Informe seu nome.');
  const note = text(input.note, 500);
  if (!Array.isArray(input.codes) || !input.codes.length)
    throw new Error('Marque pelo menos um item.');
  if (input.codes.length > MAX_ITEMS) throw new Error('Itens demais em um envio.');
  const allowed = new Map(
    (await reviewProducts(link.filter)).map((p) => [p.code, p]),
  );
  const codes = [...new Set(input.codes.map((c) => text(c, 180)))];
  // Só aceita códigos que estão no filtro deste link.
  const items = codes.map((code) => {
    const product = allowed.get(code);
    if (!product) throw new Error('Há itens fora da lista deste link. Recarregue a página.');
    return { code, name: product.name, brand: product.brand };
  });
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO review_requests (id,link_id,buyer,note,items,created_at) VALUES (?,?,?,?,?,?)',
  )
    .bind(id, link.id, buyer, note, JSON.stringify(items), new Date().toISOString())
    .run();
  return { id, count: items.length };
}

export async function listReviewRequests(): Promise<ReviewRequest[]> {
  await ensureTables();
  const rows = await env.DB.prepare(
    'SELECT r.id,r.link_id,r.buyer,r.note,r.items,r.created_at,r.status,r.decided_at,r.approved, l.label AS link_label FROM review_requests r LEFT JOIN review_links l ON l.id=r.link_id ORDER BY r.created_at DESC LIMIT 200',
  ).all<{
    id: string;
    link_id: string;
    buyer: string;
    note: string | null;
    items: string;
    created_at: string;
    status: ReviewRequest['status'];
    decided_at: string | null;
    approved: string | null;
    link_label: string | null;
  }>();
  return rows.results.map((r) => ({
    id: r.id,
    linkId: r.link_id,
    linkLabel: r.link_label ?? '',
    buyer: r.buyer,
    note: r.note ?? '',
    items: JSON.parse(r.items) as ReviewItem[],
    createdAt: r.created_at,
    status: r.status,
    decidedAt: r.decided_at ?? null,
    approved: JSON.parse(r.approved ?? '[]') as string[],
  }));
}

// Aprova os códigos escolhidos (os demais do envio ficam recusados). Cada
// produto aprovado sai do catálogo com o motivo "Compras: <nome> em <data>".
export async function decideReview(id: unknown, approveCodes: unknown) {
  await ensureTables();
  const row = await env.DB.prepare(
    "SELECT buyer,items,created_at FROM review_requests WHERE id=? AND status='pendente'",
  )
    .bind(text(id, 64))
    .first<{ buyer: string; items: string; created_at: string }>();
  if (!row) throw new Error('Envio não encontrado ou já decidido.');
  const items = JSON.parse(row.items) as ReviewItem[];
  const requested = new Set(items.map((i) => i.code));
  const approved = Array.isArray(approveCodes)
    ? [...new Set(approveCodes.map((c) => text(c, 180)))].filter((c) =>
        requested.has(c),
      )
    : [];
  const now = new Date().toISOString();
  const day = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(Date.parse(row.created_at));
  const reason = `Compras: ${row.buyer} em ${day}`.slice(0, 120);
  const status = !approved.length
    ? 'recusado'
    : approved.length === items.length
      ? 'aprovado'
      : 'parcial';
  const statements = [
    env.DB.prepare(
      "UPDATE review_requests SET status=?, decided_at=?, approved=? WHERE id=? AND status='pendente'",
    ).bind(status, now, JSON.stringify(approved), text(id, 64)),
  ];
  for (let i = 0; i < approved.length; i += 50) {
    const chunk = approved.slice(i, i + 50);
    statements.push(
      env.DB.prepare(
        `UPDATE products SET published=0, updated_at=?, details=json_set(details,'$.outOfCatalog',?,'$.purchaseExcluded',?) WHERE code IN (${chunk.map(() => '?').join(',')})`,
      ).bind(now, reason, reason, ...chunk),
    );
  }
  const results = await env.DB.batch(statements);
  if (!results[0]?.meta.changes) throw new Error('Envio já decidido em outra sessão.');
  return { status, approved: approved.length, rejected: items.length - approved.length };
}

// Devolve ao catálogo um item que o compras tirou (desfazer a aprovação).
export async function restorePurchaseExcluded(code: unknown) {
  const result = await env.DB.prepare(
    "UPDATE products SET published=1, updated_at=?, details=json_remove(details,'$.outOfCatalog','$.purchaseExcluded') WHERE code=? AND json_extract(details,'$.purchaseExcluded') IS NOT NULL",
  )
    .bind(new Date().toISOString(), text(code, 180))
    .run();
  if (!result.meta.changes) throw new Error('Produto não encontrado entre os excluídos pelo compras.');
}
