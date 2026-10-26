import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totpCode } from '../lib/editor-totp';
import { POST as login } from '../app/api/editor/login/route';
import { POST as loginCode } from '../app/api/editor/login/codigo/route';
import { POST as totpPost } from '../app/api/editor/totp/route';
import { getEditorUser } from '../lib/editor-access';
import { database, env as testEnv, setCookie, setIdentity } from './runtime';

const origin = 'https://catalog.test';
const json = (body: unknown, cookie = '') =>
  new Request(`${origin}/api/editor/totp`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
const form = (path: string, fields: Record<string, string>, cookie = '') => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request(`${origin}${path}`, { method: 'POST', body, headers: { cookie } });
};
const cookiesOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .filter((c) => !c.endsWith('='));
const currentCode = (secret: string, offset = 0) =>
  totpCode(secret, Math.floor(Date.now() / 30000) + offset);

void test('TOTP matches the RFC 6238 SHA-1 test vector', async () => {
  // Segredo ASCII "12345678901234567890"; T=59s → passo 1 → 94287082 (8 dígitos).
  assert.equal(await totpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1), '287082');
});

void test('authenticator: enrollment, two-step login, no replay, single-use recovery, password alone is not enough', async () => {
  const env = testEnv as typeof testEnv & { EDITOR_PASSWORD?: string };
  env.EDITOR_PASSWORD = 'senha-do-teste-123';
  try {
    setIdentity('admin@example.test');
    // Iniciar exige a senha atual.
    assert.equal((await totpPost(json({ action: 'start', password: 'errada' }))).status, 400);
    const started = (await (
      await totpPost(json({ action: 'start', password: 'senha-do-teste-123' }))
    ).json()) as { secret: string; uri: string };
    assert.match(started.uri, /^otpauth:\/\/totp\/.+secret=[A-Z2-7]{32}&issuer=/);
    // Enquanto não confirma, o login segue só com a senha.
    setIdentity();
    assert.equal(
      (await login(form('/api/editor/login', { password: 'senha-do-teste-123', return_to: '/editor' }))).headers.get('location'),
      '/editor',
    );
    setIdentity('admin@example.test');
    assert.equal((await totpPost(json({ action: 'confirm', code: '000000' }))).status, 400);
    const confirmed = await totpPost(json({ action: 'confirm', code: await currentCode(started.secret) }));
    assert.equal(confirmed.status, 200);
    const { recoveryCodes } = (await confirmed.json()) as { recoveryCodes: string[] };
    assert.equal(recoveryCodes.length, 8);
    assert.match(cookiesOf(confirmed)[0] ?? '', /^catalogo_editor_session=/);
    // Só hashes dos códigos de recuperação no banco.
    const stored = JSON.stringify(database.prepare('SELECT recovery FROM editor_totp').get());
    for (const code of recoveryCodes) assert.ok(!stored.includes(code.replace('-', '')));

    // Login: a senha sozinha não abre sessão, só o desafio do código.
    setIdentity();
    const step1 = await login(form('/api/editor/login', { password: 'senha-do-teste-123', return_to: '/editor' }));
    assert.match(step1.headers.get('location') ?? '', /etapa=codigo/);
    const challenge = cookiesOf(step1)[0];
    assert.match(challenge, /^catalogo_editor_mfa=/);
    assert.ok(!(step1.headers.get('set-cookie') ?? '').includes('catalogo_editor_session'));
    // Cookie forjado só com a senha (o jeito antigo) não vale mais.
    // Assinado com a senha, como o cookie era montado antes do autenticador.
    const timestamp = String(Math.floor(Date.now() / 1000));
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('senha-do-teste-123'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = Buffer.from(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp)),
    ).toString('base64url');
    const forgedSession = `catalogo_editor_session=${timestamp}.${signature}`;
    // Sem o autenticador esse cookie valeria; com ele, não.
    database.exec("UPDATE editor_totp SET enabled_at=NULL");
    setCookie(forgedSession);
    assert.notEqual(await getEditorUser(), null);
    database.exec("UPDATE editor_totp SET enabled_at='2026-01-01T00:00:00.000Z'");
    setCookie(forgedSession);
    assert.equal(await getEditorUser(), null);
    setCookie();

    // Código sem desafio volta para a senha.
    assert.match(
      (await loginCode(form('/api/editor/login/codigo', { codigo: '123456', return_to: '/editor' }))).headers.get('location') ?? '',
      /error=expirou/,
    );
    // Código errado.
    assert.match(
      (await loginCode(form('/api/editor/login/codigo', { codigo: '000000', return_to: '/editor' }, challenge))).headers.get('location') ?? '',
      /etapa=codigo&error=codigo/,
    );
    // Código certo entra (usa o próximo passo: o atual já foi usado na ativação).
    const next = await currentCode(started.secret, 1);
    const ok = await loginCode(form('/api/editor/login/codigo', { codigo: next, return_to: '/editor' }, challenge));
    assert.equal(ok.headers.get('location'), '/editor');
    const session = cookiesOf(ok).find((c) => c.startsWith('catalogo_editor_session='))!;
    setCookie(session);
    assert.notEqual(await getEditorUser(), null);
    setCookie();
    // O mesmo código não vale de novo.
    assert.match(
      (await loginCode(form('/api/editor/login/codigo', { codigo: next, return_to: '/editor' }, challenge))).headers.get('location') ?? '',
      /error=codigo/,
    );
    // Código de recuperação vale uma vez.
    const recovery = recoveryCodes[0].toLowerCase();
    assert.equal(
      (await loginCode(form('/api/editor/login/codigo', { codigo: recovery, return_to: '/editor' }, challenge))).headers.get('location'),
      '/editor',
    );
    assert.match(
      (await loginCode(form('/api/editor/login/codigo', { codigo: recovery, return_to: '/editor' }, challenge))).headers.get('location') ?? '',
      /error=codigo/,
    );

    // Desativar exige senha e código.
    setIdentity('admin@example.test');
    assert.equal(
      (await totpPost(json({ action: 'disable', password: 'senha-do-teste-123', code: '000000' }))).status,
      400,
    );
    assert.equal(
      (await totpPost(json({ action: 'disable', password: 'senha-do-teste-123', code: recoveryCodes[1] }))).status,
      200,
    );
    setIdentity();
    assert.equal(
      (await login(form('/api/editor/login', { password: 'senha-do-teste-123', return_to: '/editor' }))).headers.get('location'),
      '/editor',
    );
  } finally {
    setCookie();
    setIdentity('admin@example.test');
    database.exec('DELETE FROM editor_totp');
    delete env.EDITOR_PASSWORD;
  }
});
