'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Download, KeyRound, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from './editor-controls';
import { api } from '@/lib/client-api';
import type { Product } from '@/lib/catalog-data';
import type {
  ReviewFilter,
  ReviewLink,
  ReviewRequest,
} from '@/lib/purchase-review';

type State = {
  links: ReviewLink[];
  requests: ReviewRequest[];
  options: { categories: [string, number][]; suppliers: [string, number][] };
};

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});
const when = (value: string | null) =>
  value ? dateTime.format(Date.parse(value)) : '';
const STATUS: Record<ReviewRequest['status'], string> = {
  pendente: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  parcial: 'Aprovado em parte',
  recusado: 'Recusado',
};

function filterSummary(filter: ReviewFilter) {
  if (filter.kind === 'all') return 'Catálogo inteiro';
  const kind = filter.kind === 'category' ? 'Categorias' : 'Fornecedores';
  const shown = filter.values.slice(0, 3).join(', ');
  const rest = filter.values.length - 3;
  return `${kind}: ${shown}${rest > 0 ? ` e mais ${rest}` : ''}`;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Revisão do catálogo pelo compras: gera a chave de acesso, recebe os envios
// para aprovar e mostra o relatório do que saiu.
export function PurchaseReviewEditor({
  items,
  dirty,
  onBusy,
  onRefresh,
}: {
  items: Product[];
  dirty: boolean;
  onBusy: (busy: boolean) => void;
  onRefresh: () => Promise<unknown>;
}) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  // Nova chave
  const [kind, setKind] = useState<ReviewFilter['kind']>('all');
  const [values, setValues] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState('7');
  const [created, setCreated] = useState<{
    token: string;
    label: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState('');
  // Aprovação: códigos desmarcados por envio (o padrão é aprovar todos).
  const [unchecked, setUnchecked] = useState<Record<string, string[]>>({});
  const [confirming, setConfirming] = useState('');

  const load = useCallback(async () => {
    try {
      setState(await api<State>('/api/purchase-review'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.');
    }
  }, []);
  useEffect(() => {
    // Carga inicial; o setState acontece depois da resposta do servidor.
    void api<State>('/api/purchase-review')
      .then(setState)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Não foi possível carregar.'),
      );
  }, []);

  async function run<T>(task: () => Promise<T>) {
    setWorking(true);
    onBusy(true);
    setError('');
    setMessage('');
    try {
      return await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
      return undefined;
    } finally {
      setWorking(false);
      onBusy(false);
    }
  }

  const options = useMemo(() => {
    const list =
      (kind === 'category'
        ? state?.options.categories
        : state?.options.suppliers) ?? [];
    const q = search.trim().toLowerCase();
    return q ? list.filter(([name]) => name.toLowerCase().includes(q)) : list;
  }, [state, kind, search]);
  const chosenCount = useMemo(() => {
    const all = new Map(
      (kind === 'category'
        ? state?.options.categories
        : state?.options.suppliers) ?? [],
    );
    return values.reduce((sum, v) => sum + (all.get(v) ?? 0), 0);
  }, [state, kind, values]);

  async function createKey() {
    const result = await run(() =>
      api<{ token: string; label: string; expiresAt: string }>(
        '/api/purchase-review',
        {
          action: 'create',
          label,
          days: Number(days),
          filter: { kind, values },
        },
      ),
    );
    if (!result) return;
    setCreated(result);
    setCopied('');
    setValues([]);
    setLabel('');
    await load();
  }

  async function decide(request: ReviewRequest, approve: boolean) {
    const skip = new Set(unchecked[request.id] ?? []);
    const codes = approve
      ? request.items.map((i) => i.code).filter((c) => !skip.has(c))
      : [];
    const result = await run(() =>
      api<{ status: string; approved: number; rejected: number }>(
        '/api/purchase-review',
        { action: 'decide', id: request.id, approve: codes },
      ),
    );
    setConfirming('');
    if (!result) return;
    setMessage(
      result.approved
        ? `${result.approved} ${result.approved === 1 ? 'item saiu' : 'itens saíram'} do catálogo${result.rejected ? ` e ${result.rejected} ${result.rejected === 1 ? 'foi mantido' : 'foram mantidos'}` : ''}. Próximos passos: publique as alterações (sai do site e do app) e depois gere o PDF de novo, na Visão geral.`
        : 'Envio recusado: nenhum item saiu do catálogo.',
    );
    await Promise.all([load(), onRefresh()]);
  }

  async function restore(code: string) {
    const ok = await run(() =>
      api('/api/purchase-review', { action: 'restore', code }),
    );
    if (ok === undefined) return;
    setMessage(
      `Produto ${code} voltou ao catálogo. Publique para aparecer no site.`,
    );
    await onRefresh();
  }

  function downloadReport() {
    const rows = [
      [
        'Enviado em',
        'Comprador',
        'Revisão',
        'Código',
        'Produto',
        'Marca',
        'Situação',
        'Decidido em',
        'Observação',
      ],
    ];
    for (const r of state?.requests ?? []) {
      const approved = new Set(r.approved);
      for (const item of r.items)
        rows.push([
          when(r.createdAt),
          r.buyer,
          r.linkLabel,
          item.code,
          item.name,
          item.brand,
          r.status === 'pendente'
            ? 'Aguardando aprovação'
            : approved.has(item.code)
              ? 'Excluído do catálogo'
              : 'Mantido',
          when(r.decidedAt),
          r.note,
        ]);
    }
    // Ponto e vírgula e BOM: o Excel em português abre direto com acentos.
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';'),
      )
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `revisao-compras-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const pending = state?.requests.filter((r) => r.status === 'pendente') ?? [];
  const decided = state?.requests.filter((r) => r.status !== 'pendente') ?? [];
  const excluded = items.filter((p) => p.details?.purchaseExcluded);
  const pageUrl =
    typeof window === 'undefined'
      ? '/compras'
      : `${window.location.origin}/compras`;

  return (
    <>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {message && <p className="success-message">{message}</p>}

      <Panel
        title="Revisão do compras"
        note="Gere uma chave para o comprador revisar o catálogo, igual ao PDF, filtrado por categorias ou fornecedores. Ele marca o que saiu de linha e envia; nada sai do catálogo antes da sua aprovação aqui."
      >
        <section
          className="review-create"
          aria-labelledby="review-create-title"
        >
          <h2 id="review-create-title">Nova chave de acesso</h2>
          <div
            className="review-kind"
            role="radiogroup"
            aria-label="Filtrar por"
          >
            {(['all', 'supplier', 'category'] as const).map((k) => (
              <label key={k}>
                <input
                  type="radio"
                  name="review-kind"
                  checked={kind === k}
                  onChange={() => {
                    setKind(k);
                    setValues([]);
                    setSearch('');
                  }}
                />
                {k === 'all'
                  ? 'Catálogo inteiro (o comprador filtra na página)'
                  : k === 'supplier'
                    ? 'Só alguns fornecedores'
                    : 'Só algumas categorias'}
              </label>
            ))}
          </div>
          {kind !== 'all' && (
            <>
              <label className="editor-field" htmlFor="review-search">
                <span>
                  {kind === 'supplier'
                    ? 'Buscar fornecedor'
                    : 'Buscar categoria'}
                </span>
                <Input
                  id="review-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="review-options">
                {state === null ? (
                  <output>
                    <Loader2 className="animate-spin" /> Carregando…
                  </output>
                ) : !options.length ? (
                  <p>
                    {kind === 'supplier'
                      ? 'Nenhum fornecedor encontrado. O fornecedor vem da coluna "Nome do fornecedor" da planilha do ERP.'
                      : 'Nenhuma categoria encontrada.'}
                  </p>
                ) : (
                  options.map(([name, count]) => (
                    <label key={name}>
                      <input
                        type="checkbox"
                        checked={values.includes(name)}
                        onChange={(e) =>
                          setValues((current) =>
                            e.target.checked
                              ? [...current, name]
                              : current.filter((v) => v !== name),
                          )
                        }
                      />
                      <span>{name}</span>
                      <small>{count}</small>
                    </label>
                  ))
                )}
              </div>
            </>
          )}
          <div className="review-create-row">
            <label className="editor-field" htmlFor="review-label">
              <span>Nome da revisão (opcional)</span>
              <Input
                id="review-label"
                value={label}
                maxLength={80}
                placeholder="Ex.: Revisão Santher – João"
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <label className="editor-field" htmlFor="review-days">
              <span>Validade</span>
              <select
                id="review-days"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              >
                {['3', '7', '15', '30'].map((d) => (
                  <option key={d} value={d}>
                    {d} dias
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="review-hint">
            {kind === 'all'
              ? 'O comprador vê todos os produtos publicados e filtra por categoria ou fornecedor na própria página.'
              : values.length
                ? `${values.length} ${kind === 'supplier' ? 'fornecedor(es)' : 'categoria(s)'} · ${chosenCount} produtos publicados`
                : 'Escolha pelo menos um item da lista.'}
          </p>
          <Button
            disabled={(kind !== 'all' && !values.length) || working}
            onClick={() => void createKey()}
          >
            <KeyRound /> Gerar chave
          </Button>
          {created && (
            <div className="review-key" aria-live="polite">
              <strong>Chave gerada: {created.label}</strong>
              <p>
                Ela aparece só agora; depois não dá para ver de novo. Mande ao
                comprador o endereço e a chave (de preferência por canais
                diferentes, como e-mail e WhatsApp). Vale até{' '}
                {when(created.expiresAt)}.
              </p>
              <span>Endereço</span>
              <code>{pageUrl}</code>
              <span>Chave de acesso (64 caracteres)</span>
              <code className="review-key-value">{created.token}</code>
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void copy(pageUrl).then((ok) =>
                      setCopied(ok ? 'url' : 'erro'),
                    )
                  }
                >
                  <Copy /> Copiar endereço
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void copy(created.token).then((ok) =>
                      setCopied(ok ? 'chave' : 'erro'),
                    )
                  }
                >
                  <Copy /> Copiar chave
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreated(null)}
                >
                  Já enviei, esconder
                </Button>
              </div>
              {copied && (
                <small>
                  {copied === 'erro'
                    ? 'Não foi possível copiar; selecione o texto e copie.'
                    : copied === 'url'
                      ? 'Endereço copiado.'
                      : 'Chave copiada.'}
                </small>
              )}
            </div>
          )}
        </section>
      </Panel>

      <Panel
        title="Envios para aprovar"
        note="Desmarque o que deve continuar no catálogo e aprove o resto. Itens aprovados vão para Fora de linha e saem do site, do app e do PDF na próxima publicação. Mesmo que o ERP ainda traga o item como ativo, ele continua fora até você desfazer."
      >
        {!pending.length ? (
          <p className="review-empty">Nenhum envio aguardando aprovação.</p>
        ) : (
          pending.map((request) => {
            const skip = new Set(unchecked[request.id] ?? []);
            const count = request.items.length - skip.size;
            return (
              <article key={request.id} className="review-request">
                <header>
                  <strong>
                    {request.buyer} · {request.items.length}{' '}
                    {request.items.length === 1 ? 'item' : 'itens'}
                  </strong>
                  <small>
                    {when(request.createdAt)}
                    {request.linkLabel ? ` · ${request.linkLabel}` : ''}
                  </small>
                  {request.note && <p>“{request.note}”</p>}
                </header>
                <ul>
                  {request.items.map((item) => (
                    <li key={item.code}>
                      <label>
                        <input
                          type="checkbox"
                          checked={!skip.has(item.code)}
                          onChange={(e) =>
                            setUnchecked((current) => {
                              const set = new Set(current[request.id] ?? []);
                              if (e.target.checked) set.delete(item.code);
                              else set.add(item.code);
                              return { ...current, [request.id]: [...set] };
                            })
                          }
                        />
                        <span>
                          <strong>{item.code}</strong> · {item.name}
                        </span>
                        <small>{item.brand}</small>
                      </label>
                    </li>
                  ))}
                </ul>
                {confirming === request.id ? (
                  <div className="review-actions">
                    <Button
                      disabled={working || dirty}
                      onClick={() => void decide(request, true)}
                    >
                      Confirmar: tirar {count} do catálogo
                    </Button>
                    <Button variant="outline" onClick={() => setConfirming('')}>
                      Voltar
                    </Button>
                  </div>
                ) : (
                  <div className="review-actions">
                    <Button
                      disabled={working || dirty || !count}
                      onClick={() => setConfirming(request.id)}
                    >
                      Aprovar {count} {count === 1 ? 'item' : 'itens'}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={working}
                      onClick={() => void decide(request, false)}
                    >
                      Recusar tudo
                    </Button>
                  </div>
                )}
                {dirty && (
                  <small>
                    Salve ou desfaça o produto aberto antes de aprovar.
                  </small>
                )}
              </article>
            );
          })
        )}
      </Panel>

      <Panel
        title="Excluídos pelo compras"
        note="Produtos tirados do catálogo pela revisão do compras. Voltar ao catálogo desfaz a exclusão (publique depois para aparecer no site)."
      >
        {!excluded.length ? (
          <p className="review-empty">Nenhum produto excluído pelo compras.</p>
        ) : (
          <ul className="review-excluded">
            {excluded.map((p) => (
              <li key={p.code}>
                <span>
                  <strong>{p.code}</strong> · {p.name}
                  <small>{p.details?.purchaseExcluded}</small>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={working}
                  onClick={() => void restore(p.code)}
                >
                  <RotateCcw /> Voltar ao catálogo
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Chaves e relatório"
        note="Chaves geradas, com validade e envios. Cancelar uma chave derruba o acesso do comprador na hora."
      >
        {!state?.links.length ? (
          <p className="review-empty">Nenhuma chave gerada ainda.</p>
        ) : (
          <ul className="review-links">
            {state.links.map((link) => {
              const active = link.active;
              return (
                <li key={link.id}>
                  <span>
                    <strong>{link.label}</strong>
                    <small>
                      {filterSummary(link.filter)} · {link.requests}{' '}
                      {link.requests === 1 ? 'envio' : 'envios'} ·{' '}
                      {link.revokedAt
                        ? `cancelada em ${when(link.revokedAt)}`
                        : active
                          ? `vale até ${when(link.expiresAt)}`
                          : `venceu em ${when(link.expiresAt)}`}
                    </small>
                  </span>
                  {active && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={working}
                      onClick={() =>
                        void run(() =>
                          api('/api/purchase-review', {
                            action: 'revoke',
                            id: link.id,
                          }),
                        ).then((ok) => {
                          if (ok !== undefined) {
                            setMessage(`Chave “${link.label}” cancelada.`);
                            void load();
                          }
                        })
                      }
                    >
                      Cancelar chave
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <h2 className="review-report-title">Histórico de decisões</h2>
        {!decided.length ? (
          <p className="review-empty">Nenhum envio decidido ainda.</p>
        ) : (
          <div className="review-table">
            <table>
              <thead>
                <tr>
                  <th>Enviado</th>
                  <th>Comprador</th>
                  <th>Revisão</th>
                  <th>Excluídos</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.id}>
                    <td>{when(r.createdAt)}</td>
                    <td>{r.buyer}</td>
                    <td>{r.linkLabel}</td>
                    <td>
                      {r.approved.length} de {r.items.length}
                    </td>
                    <td>{STATUS[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button
          variant="outline"
          disabled={!state?.requests.length}
          onClick={downloadReport}
        >
          <Download /> Baixar relatório (Excel/CSV)
        </Button>
      </Panel>
    </>
  );
}
