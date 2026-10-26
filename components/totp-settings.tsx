'use client';
/* oxlint-disable next/no-img-element -- QR code gerado no navegador (data URL). */
import { useEffect, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Copy, Download, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from './editor-controls';
import { api } from '@/lib/client-api';

type Status = {
  recentFailures: number;
  lockedUntil: string | null;
  enabled: boolean;
  enabledAt: string | null;
  recoveryLeft: number;
};
type Step =
  | { kind: 'idle' }
  | { kind: 'password' }
  | { kind: 'scan'; secret: string; qr: string }
  | { kind: 'codes'; codes: string[] }
  | { kind: 'disable' };

function qrDataUrl(uri: string) {
  const qr = qrcode(0, 'M');
  qr.addData(uri);
  qr.make();
  return qr.createDataURL(5, 4);
}

// Autenticador do editor: código de 6 dígitos pedido em todo login, depois
// da senha. O QR code é gerado aqui no navegador; o segredo não passa por
// nenhum serviço externo.
export function TotpSettings({
  onBusy,
}: {
  onBusy: (busy: boolean) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api<Status>('/api/editor/totp')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [reload]);

  async function call<T>(body: Record<string, string>) {
    setWorking(true);
    onBusy(true);
    setError('');
    setMessage('');
    try {
      return await api<T>('/api/editor/totp', body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
      return null;
    } finally {
      setWorking(false);
      onBusy(false);
    }
  }

  async function start() {
    const result = await call<{ secret: string; uri: string }>({
      action: 'start',
      password,
    });
    if (!result) return;
    setPassword('');
    setCode('');
    setStep({ kind: 'scan', secret: result.secret, qr: qrDataUrl(result.uri) });
  }

  async function confirm() {
    const result = await call<{ recoveryCodes: string[] }>({
      action: 'confirm',
      code,
    });
    if (!result) return;
    setCode('');
    setSaved(false);
    setStep({ kind: 'codes', codes: result.recoveryCodes });
    setReload((n) => n + 1);
  }

  async function disable() {
    const result = await call<{ ok: boolean }>({
      action: 'disable',
      password,
      code,
    });
    if (!result) return;
    setPassword('');
    setCode('');
    setStep({ kind: 'idle' });
    setMessage('Autenticador desativado. O login volta a pedir só a senha.');
    setReload((n) => n + 1);
  }

  function downloadCodes(codes: string[]) {
    const text = [
      'Catálogo Laurencini — códigos de recuperação do autenticador',
      `Gerados em ${new Date().toLocaleString('pt-BR')}`,
      'Cada código funciona uma vez, no lugar do código do app.',
      '',
      ...codes,
      '',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'codigos-recuperacao-catalogo.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(true);
  }

  return (
    <Panel
      title="Autenticador"
      note="Com o autenticador ativo, o login pede a senha e, em seguida, o código de 6 dígitos do app (Google Authenticator, Microsoft Authenticator, Authy ou o app Senhas do iPhone). Ativar ou desativar encerra as outras sessões abertas."
    >
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {message && <p className="success-message">{message}</p>}

      {step.kind === 'codes' ? (
        <div className="totp-codes">
          <strong>
            <ShieldCheck aria-hidden="true" /> Autenticador ativado
          </strong>
          <p>
            Guarde estes códigos de recuperação em lugar seguro (fora do
            celular). Cada um serve uma vez, no lugar do código do app, se você
            perder o celular. Eles aparecem só agora.
          </p>
          <ol>
            {step.codes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ol>
          <div className="totp-actions">
            <Button variant="outline" onClick={() => downloadCodes(step.codes)}>
              <Download /> Baixar códigos (.txt)
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(step.codes.join('\n'))
                  .then(() => setSaved(true))
                  .catch(() =>
                    setError('Não foi possível copiar; baixe o arquivo.'),
                  )
              }
            >
              <Copy /> Copiar códigos
            </Button>
            <Button
              disabled={!saved}
              onClick={() => {
                setStep({ kind: 'idle' });
                setMessage(
                  'Pronto. No próximo login, o editor vai pedir o código do app.',
                );
              }}
            >
              Já guardei os códigos
            </Button>
          </div>
        </div>
      ) : status === null ? (
        <output className="security-status">
          <Loader2 className="animate-spin" /> Carregando…
        </output>
      ) : status.enabled ? (
        <>
          <p className="security-status">
            <ShieldCheck aria-hidden="true" /> Ativo desde{' '}
            {status.enabledAt
              ? new Date(status.enabledAt).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : '—'}{' '}
            · {status.recoveryLeft} códigos de recuperação restantes
          </p>
          {(status.recentFailures > 0 || status.lockedUntil) && (
            <p role="alert" className="error-message">
              {status.recentFailures} código(s) errado(s) nos últimos 15
              minutos
              {status.lockedUntil
                ? `; tentativas pausadas até ${new Date(status.lockedUntil).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
              . Se não foi você, troque a senha e encerre as outras sessões.
            </p>
          )}
          {step.kind === 'disable' ? (
            <form
              className="security-form"
              onSubmit={(e) => {
                e.preventDefault();
                void disable();
              }}
            >
              <label className="editor-field" htmlFor="totp-off-password">
                <span>Senha atual</span>
                <Input
                  id="totp-off-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="editor-field" htmlFor="totp-off-code">
                <span>Código do app ou de recuperação</span>
                <Input
                  id="totp-off-code"
                  autoComplete="one-time-code"
                  value={code}
                  maxLength={20}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <div className="totp-actions">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={working || !password || !code}
                >
                  Desativar autenticador
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep({ kind: 'idle' })}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="outline" onClick={() => setStep({ kind: 'disable' })}>
              Desativar autenticador
            </Button>
          )}
        </>
      ) : step.kind === 'scan' ? (
        <div className="totp-scan">
          <img src={step.qr} alt="QR code para cadastrar no app autenticador" />
          <div>
            <ol>
              <li>Abra o app autenticador e toque em adicionar conta.</li>
              <li>Escaneie o QR code (ou digite a chave abaixo).</li>
              <li>Digite o código de 6 dígitos que aparecer no app.</li>
            </ol>
            <span>Chave para digitar no app</span>
            <code>{step.secret.match(/.{1,4}/g)?.join(' ')}</code>
            <form
              className="security-form"
              onSubmit={(e) => {
                e.preventDefault();
                void confirm();
              }}
            >
              <label className="editor-field" htmlFor="totp-confirm">
                <span>Código do app</span>
                <Input
                  id="totp-confirm"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </label>
              <div className="totp-actions">
                <Button type="submit" disabled={working || code.length !== 6}>
                  {working ? <Loader2 className="animate-spin" /> : null}
                  Confirmar e ativar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep({ kind: 'idle' })}
                >
                  Cancelar
                </Button>
              </div>
            </form>
            <small>
              O QR code vale por 15 minutos. Enquanto não confirmar, nada muda
              no login.
            </small>
          </div>
        </div>
      ) : step.kind === 'password' ? (
        <form
          className="security-form"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <label className="editor-field" htmlFor="totp-password">
            <span>Confirme a senha atual para continuar</span>
            <Input
              id="totp-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="totp-actions">
            <Button type="submit" disabled={working || !password}>
              {working ? <Loader2 className="animate-spin" /> : null}
              Continuar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep({ kind: 'idle' })}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="security-status">Autenticador desativado.</p>
          <Button onClick={() => setStep({ kind: 'password' })}>
            <Smartphone /> Ativar autenticador
          </Button>
        </>
      )}
    </Panel>
  );
}
