'use client';
import { useEffect, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from './editor-controls';
import { api } from '@/lib/client-api';

const MIN_LENGTH = 12;

// Troca da senha do editor. A senha nunca fica guardada no navegador; o
// servidor confere a atual e grava só o hash da nova.
export function SecuritySettings({
  onBusy,
}: {
  onBusy: (busy: boolean) => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [info, setInfo] = useState<{
    changedInEditor: boolean;
    updatedAt: string | null;
  } | null>(null);

  useEffect(() => {
    api<{ changedInEditor: boolean; updatedAt: string | null }>(
      '/api/editor/password',
    )
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [message]);

  const problem =
    next && next.length < MIN_LENGTH
      ? `Use pelo menos ${MIN_LENGTH} caracteres.`
      : repeat && next !== repeat
        ? 'A confirmação não é igual à senha nova.'
        : '';
  const ready =
    current.length > 0 &&
    next.length >= MIN_LENGTH &&
    next === repeat &&
    !saving;

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!ready) return;
    setSaving(true);
    onBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/api/editor/password', { current, next });
      setCurrent('');
      setNext('');
      setRepeat('');
      setMessage(
        'Senha alterada. Use a senha nova no próximo login; as outras sessões abertas foram encerradas.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível trocar a senha.');
    } finally {
      setSaving(false);
      onBusy(false);
    }
  }

  return (
    <Panel
      title="Senha do editor"
      note="Troque a senha de acesso ao editor. Ao trocar, todas as outras sessões abertas (outros computadores e celulares) são encerradas; esta continua aberta."
    >
      <p className="security-status">
        {info?.changedInEditor && info.updatedAt
          ? `Senha trocada pelo editor em ${new Date(info.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`
          : 'A senha atual é a configurada na Cloudflare. Ao trocar aqui, ela deixa de valer.'}
      </p>
      <form className="security-form" onSubmit={(e) => void submit(e)}>
        <label className="editor-field" htmlFor="password-current">
          <span>Senha atual</span>
          <Input
            id="password-current"
            type="password"
            autoComplete="current-password"
            value={current}
            maxLength={128}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="editor-field" htmlFor="password-next">
          <span>Senha nova (mínimo {MIN_LENGTH} caracteres)</span>
          <Input
            id="password-next"
            type="password"
            autoComplete="new-password"
            value={next}
            maxLength={128}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <label className="editor-field" htmlFor="password-repeat">
          <span>Repita a senha nova</span>
          <Input
            id="password-repeat"
            type="password"
            autoComplete="new-password"
            value={repeat}
            maxLength={128}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </label>
        <small>
          Dica: uma frase com 3 ou 4 palavras e um número é fácil de lembrar e
          difícil de adivinhar. Não reutilize senhas de e-mail ou banco.
        </small>
        {problem && <p className="error-message">{problem}</p>}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {message && <p className="success-message">{message}</p>}
        <Button type="submit" disabled={!ready}>
          {saving ? <Loader2 className="animate-spin" /> : <KeyRound />}
          Trocar senha
        </Button>
      </form>
    </Panel>
  );
}

// Encerra as sessões abertas em outros computadores e celulares (por
// exemplo, depois de usar o editor num computador emprestado).
export function SessionSettings({
  onBusy,
}: {
  onBusy: (busy: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function endAll() {
    setWorking(true);
    onBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/api/editor/sessions', { confirm: true });
      setMessage(
        'Pronto: as outras sessões foram encerradas. Esta continua aberta.',
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Não foi possível encerrar as sessões.',
      );
    } finally {
      setConfirming(false);
      setWorking(false);
      onBusy(false);
    }
  }

  return (
    <Panel
      title="Sessões abertas"
      note="Cada login vale por até 8 horas. Se você entrou num computador que não é seu ou desconfia de algum acesso, encerre as outras sessões: todos os outros aparelhos precisarão entrar de novo."
    >
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {message && <p className="success-message">{message}</p>}
      {confirming ? (
        <div className="totp-actions">
          <Button disabled={working} onClick={() => void endAll()}>
            Confirmar: encerrar as outras sessões
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          Encerrar as outras sessões
        </Button>
      )}
    </Panel>
  );
}
