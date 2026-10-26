'use client';
/* oxlint-disable next/no-img-element -- Fotos já otimizadas (WebP) pelo editor. */
import { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  LogOut,
  Package,
  Search,
  Send,
  Square,
} from 'lucide-react';
import { api } from '@/lib/client-api';
import { displayName } from '@/lib/catalog-pdf';
import { useAutoLoad } from '@/hooks/use-auto-load';
import type { ReviewProduct } from '@/lib/purchase-review';

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

function readStored(key: string) {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Navegador sem armazenamento: as marcações valem só nesta visita.
  }
}

// Revisão do catálogo pelo compras: produtos do filtro na ordem do PDF; o
// comprador marca os que saíram de linha e envia para aprovação.
export function PurchaseReviewApp({
  linkId,
  label,
  expiresAt,
}: {
  linkId: string;
  label: string;
  expiresAt: string;
}) {
  const storeKey = `compras:${linkId}`;
  const [products, setProducts] = useState<ReviewProduct[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [marked, setMarked] = useState<Set<string>>(() => new Set());
  const [buyer, setBuyer] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [onlyMarked, setOnlyMarked] = useState(false);
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [limit, setLimit] = useState(120);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api<{ products: ReviewProduct[] }>('/api/compras/products')
      .then((data) => {
        // Marcações e nome guardados neste navegador (o servidor não os vê).
        const saved = readStored(storeKey);
        if (saved) setMarked(new Set(saved.split('\n').filter(Boolean)));
        setBuyer((current) => current || readStored('compras:nome'));
        setProducts(data.products);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Não foi possível carregar.'),
      );
  }, [storeKey]);

  function update(next: Set<string>) {
    setMarked(next);
    setConfirming(false);
    writeStored(storeKey, [...next].join('\n'));
  }
  function toggle(code: string) {
    const next = new Set(marked);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    update(next);
  }

  // Opções dos filtros: categorias na ordem do catálogo, fornecedores por nome.
  const filterOptions = useMemo(() => {
    const categories = new Map<string, { label: string; count: number }>();
    const suppliers = new Map<string, number>();
    for (const p of products ?? []) {
      const key = `${p.section}|${p.category}`;
      const current = categories.get(key);
      if (current) current.count++;
      else
        categories.set(key, {
          label: `${displayName(p.section)} · ${displayName(p.category)}`,
          count: 1,
        });
      if (p.supplier)
        suppliers.set(p.supplier, (suppliers.get(p.supplier) ?? 0) + 1);
    }
    return {
      categories: [...categories],
      suppliers: [...suppliers].sort((a, b) =>
        a[0].localeCompare(b[0], 'pt-BR'),
      ),
    };
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products ?? []).filter(
      (p) =>
        (!onlyMarked || marked.has(p.code)) &&
        (!category || `${p.section}|${p.category}` === category) &&
        (!supplier || p.supplier === supplier) &&
        (!q ||
          `${p.code} ${p.name} ${p.brand} ${p.supplier}`
            .toLowerCase()
            .includes(q)),
    );
  }, [products, query, onlyMarked, marked, category, supplier]);

  // Seção e categoria como as faixas do catálogo impresso.
  const groups = useMemo(() => {
    const list: { key: string; title: string; items: ReviewProduct[] }[] = [];
    for (const p of visible.slice(0, limit)) {
      const key = `${p.section}|${p.category}`;
      if (list.at(-1)?.key !== key)
        list.push({
          key,
          title: `${displayName(p.section)} · ${displayName(p.category)}`,
          items: [],
        });
      list.at(-1)!.items.push(p);
    }
    return list;
  }, [visible, limit]);

  const moreRef = useAutoLoad(
    () => setLimit((n) => n + 120),
    visible.length > limit,
    limit,
  );

  function toggleGroup(key: string, value: boolean) {
    const next = new Set(marked);
    for (const p of visible)
      if (`${p.section}|${p.category}` === key)
        if (value) next.add(p.code);
        else next.delete(p.code);
    update(next);
  }

  async function send() {
    setSending(true);
    setError('');
    setMessage('');
    try {
      const result = await api<{ count: number }>('/api/compras/submit', {
        buyer,
        note,
        codes: [...marked],
      });
      writeStored('compras:nome', buyer);
      update(new Set());
      setNote('');
      setOnlyMarked(false);
      setMessage(
        `Enviado: ${result.count} ${result.count === 1 ? 'item' : 'itens'} para aprovação. O responsável pelo catálogo confere antes de tirar do ar.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar.');
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }

  const total = products?.length ?? 0;
  return (
    <main className="compras-page">
      <header className="compras-header">
        <img
          src="/distribuidora-laurencini-logo.jpeg"
          alt="Distribuidora Laurencini"
        />
        <div>
          <span>Revisão do catálogo</span>
          <h1>{label}</h1>
          <small>
            Acesso válido até {dateFormat.format(Date.parse(expiresAt))}
          </small>
        </div>
        <form method="post" action="/api/compras/logout">
          <button type="submit" className="compras-link-button">
            <LogOut aria-hidden="true" /> Sair
          </button>
        </form>
      </header>

      <section className="compras-intro">
        <p>
          Marque os produtos que <strong>saíram de linha</strong> e, no fim,
          envie a lista. Nada sai do catálogo na hora: o responsável confere e
          aprova. Suas marcações ficam guardadas neste navegador até o envio.
        </p>
        <div className="compras-tools">
          <label className="compras-search" htmlFor="compras-busca">
            <Search aria-hidden="true" />
            <input
              id="compras-busca"
              type="search"
              placeholder="Buscar por código, nome ou marca"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(120);
              }}
            />
          </label>
          <label className="compras-filter" htmlFor="compras-categoria">
            <span>Categoria</span>
            <select
              id="compras-categoria"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setLimit(120);
              }}
            >
              <option value="">Todas as categorias</option>
              {filterOptions.categories.map(([key, option]) => (
                <option key={key} value={key}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>
          <label className="compras-filter" htmlFor="compras-fornecedor">
            <span>Fornecedor</span>
            <select
              id="compras-fornecedor"
              value={supplier}
              onChange={(e) => {
                setSupplier(e.target.value);
                setLimit(120);
              }}
            >
              <option value="">Todos os fornecedores</option>
              {filterOptions.suppliers.map(([name, count]) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </select>
          </label>
          <label className="compras-only" htmlFor="compras-so-marcados">
            <input
              id="compras-so-marcados"
              type="checkbox"
              checked={onlyMarked}
              onChange={(e) => setOnlyMarked(e.target.checked)}
            />
            Mostrar só os marcados
          </label>
          <span className="compras-count">
            {visible.length === total
              ? `${total} produtos`
              : `${visible.length} de ${total} produtos`}{' '}
            · {marked.size} marcados
          </span>
          {(category || supplier || query) && (
            <span className="compras-filter-actions">
              {visible.length > 0 && (
                <button
                  type="button"
                  className="compras-link-button"
                  onClick={() => {
                    const all = visible.every((p) => marked.has(p.code));
                    const next = new Set(marked);
                    for (const p of visible)
                      if (all) next.delete(p.code);
                      else next.add(p.code);
                    update(next);
                  }}
                >
                  {visible.every((p) => marked.has(p.code))
                    ? 'Desmarcar todos os filtrados'
                    : `Marcar todos os filtrados (${visible.length})`}
                </button>
              )}
              <button
                type="button"
                className="compras-link-button"
                onClick={() => {
                  setCategory('');
                  setSupplier('');
                  setQuery('');
                  setLimit(120);
                }}
              >
                Limpar filtros
              </button>
            </span>
          )}
        </div>
      </section>

      {error && (
        <p role="alert" className="compras-error">
          {error}
        </p>
      )}
      {message && <output className="compras-success">{message}</output>}

      {products === null && !error ? (
        <output className="compras-status">Carregando produtos…</output>
      ) : !visible.length ? (
        <p className="compras-status">
          {onlyMarked
            ? 'Nenhum produto marcado.'
            : 'Nenhum produto encontrado.'}
        </p>
      ) : (
        groups.map((group) => {
          const groupCodes = visible.filter(
            (p) => `${p.section}|${p.category}` === group.key,
          );
          const all = groupCodes.every((p) => marked.has(p.code));
          return (
            <section key={group.key} className="compras-group">
              <div className="compras-group-bar">
                <h2>{group.title}</h2>
                <button
                  type="button"
                  className="compras-link-button"
                  onClick={() => toggleGroup(group.key, !all)}
                >
                  {all
                    ? 'Desmarcar todos'
                    : `Marcar todos (${groupCodes.length})`}
                </button>
              </div>
              <div className="compras-grid">
                {group.items.map((p) => {
                  const on = marked.has(p.code);
                  return (
                    <label
                      key={p.code}
                      className={on ? 'compras-card is-marked' : 'compras-card'}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() => toggle(p.code)}
                      />
                      <span className="compras-check" aria-hidden="true">
                        {on ? <CheckSquare /> : <Square />}
                      </span>
                      {p.image ? (
                        <img src={p.image} alt="" loading="lazy" />
                      ) : (
                        <span className="compras-noimg">
                          <Package aria-hidden="true" />
                        </span>
                      )}
                      <strong>{p.name}</strong>
                      <small>
                        {p.code} · {p.brand}
                        {p.supplier ? ` · ${p.supplier}` : ''}
                      </small>
                      {on && <em>Saiu de linha</em>}
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
      {visible.length > limit && (
        <output ref={moreRef} className="compras-status">
          Carregando mais produtos… {limit} de {visible.length}
        </output>
      )}

      <footer className="compras-send">
        <strong>
          {marked.size} {marked.size === 1 ? 'item marcado' : 'itens marcados'}
        </strong>
        <input
          aria-label="Seu nome"
          placeholder="Seu nome"
          value={buyer}
          maxLength={80}
          onChange={(e) => setBuyer(e.target.value)}
        />
        <input
          aria-label="Observação (opcional)"
          placeholder="Observação (opcional)"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
        {confirming ? (
          <span className="compras-confirm">
            <button
              type="button"
              className="compras-primary"
              disabled={sending}
              onClick={() => void send()}
            >
              <Send aria-hidden="true" />
              {sending ? 'Enviando…' : `Confirmar envio de ${marked.size}`}
            </button>
            <button
              type="button"
              className="compras-link-button"
              disabled={sending}
              onClick={() => setConfirming(false)}
            >
              Voltar
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="compras-primary"
            disabled={!marked.size || buyer.trim().length < 2}
            title={
              buyer.trim().length < 2
                ? 'Informe seu nome para enviar.'
                : undefined
            }
            onClick={() => setConfirming(true)}
          >
            <Send aria-hidden="true" /> Enviar para aprovação
          </button>
        )}
      </footer>
    </main>
  );
}
