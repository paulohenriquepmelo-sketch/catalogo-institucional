'use client';
import { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from './editor-controls';
import { api } from '@/lib/client-api';
import type { PublicationHistoryEntry } from '@/lib/published-catalog';

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

function formatDate(value: string) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 'Data desconhecida' : dateFormat.format(time);
}

// Publicações anteriores do site público, com a opção de voltar para uma
// delas. O rascunho do editor não muda.
export function PublicationHistory({
  refreshKey,
  disabled,
  onBusy,
  onRestored,
}: {
  refreshKey: unknown;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onRestored: (message: string) => void;
}) {
  const [entries, setEntries] = useState<PublicationHistoryEntry[] | null>(
    null,
  );
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api<{ entries: PublicationHistoryEntry[] }>(
      '/api/publication/history',
      undefined,
      controller.signal,
    )
      .then((data) => {
        setEntries(data.entries);
        setError('');
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          e instanceof Error ? e.message : 'Não foi possível carregar.',
        );
      });
    return () => controller.abort();
  }, [refreshKey, reload]);

  async function restore(entry: PublicationHistoryEntry) {
    setRestoring(true);
    onBusy(true);
    setError('');
    try {
      const result = await api<{ publishedAt: string; productCount: number }>(
        '/api/publication/history',
        { id: entry.id, confirm: true },
      );
      setConfirming('');
      setReload((n) => n + 1);
      onRestored(
        `O site público voltou para a publicação de ${formatDate(result.publishedAt)} (${result.productCount} produtos). O editor continua com o conteúdo atual: se publicar de novo, o site recebe o que está no editor.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Não foi possível voltar a publicação.',
      );
    } finally {
      setRestoring(false);
      onBusy(false);
    }
  }

  return (
    <Panel
      title="Histórico de publicações"
      note="Antes de cada publicação, a versão que estava no ar fica guardada aqui (as 10 mais recentes). Voltar uma versão muda só o site público; a versão que estava no ar também fica guardada, então dá para desfazer."
    >
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {entries === null && !error ? (
        <output className="publication-history-status">
          <Loader2 className="animate-spin" /> Carregando publicações…
        </output>
      ) : entries && !entries.length ? (
        <p className="publication-history-status">
          Ainda não há publicações anteriores guardadas. O histórico começa a
          partir da próxima publicação.
        </p>
      ) : (
        <ul className="publication-history">
          {entries?.map((entry) => (
            <li key={entry.id}>
              <History aria-hidden="true" />
              <span>
                <strong>{formatDate(entry.publishedAt)}</strong>
                <small>
                  {entry.products === null
                    ? 'Quantidade de produtos desconhecida'
                    : `${entry.products} produtos publicados`}
                </small>
              </span>
              {confirming === entry.id ? (
                <span className="publication-history-confirm">
                  <Button
                    size="sm"
                    disabled={disabled || restoring}
                    onClick={() => void restore(entry)}
                  >
                    {restoring ? <Loader2 className="animate-spin" /> : null}
                    Confirmar volta
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restoring}
                    onClick={() => setConfirming('')}
                  >
                    Cancelar
                  </Button>
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled || restoring}
                  onClick={() => setConfirming(entry.id)}
                >
                  Voltar o site para esta versão
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
