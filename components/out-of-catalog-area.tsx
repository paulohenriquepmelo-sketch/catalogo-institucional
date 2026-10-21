'use client';
/* oxlint-disable next/no-img-element -- Product thumbnails are uploaded WebP images. */
import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from './editor-controls';
import { api } from '@/lib/client-api';
import { normalize } from '@/lib/catalog-config';
import type { Product } from '@/lib/catalog-data';

type Snapshot = { products: Product[] };
const BATCH = 100;

/**
 * Produtos que a importação tirou do site (Fora de linha = FL, Revenda = N
 * ou Força de Vendas = N). Ficam guardados aqui como rascunho; excluir é
 * definitivo e pede confirmação.
 */
export function OutOfCatalogArea({
  items,
  dirty,
  onBusy,
  onRefresh,
}: {
  items: Product[];
  dirty: boolean;
  onBusy: (busy: boolean) => void;
  onRefresh: () => Promise<Snapshot>;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const flagged = useMemo(
    () =>
      items
        .filter((p) => p.details?.outOfCatalog)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [items],
  );
  const shown = useMemo(() => {
    const q = normalize(query);
    return q
      ? flagged.filter((p) =>
          normalize(`${p.code} ${p.name} ${p.brand} ${p.details?.outOfCatalog ?? ''}`).includes(q),
        )
      : flagged;
  }, [flagged, query]);
  const chosen = flagged.filter((p) => selected.has(p.code));
  const allShown = shown.length > 0 && shown.every((p) => selected.has(p.code));

  function toggle(code: string) {
    setConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }
  function toggleShown() {
    setConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      for (const p of shown) {
        if (allShown) next.delete(p.code);
        else next.add(p.code);
      }
      return next;
    });
  }

  async function remove() {
    if (!chosen.length || dirty) return;
    setBusy(true);
    onBusy(true);
    setError('');
    setNotice('');
    let deleted = 0;
    try {
      const codes = chosen.map((p) => p.code);
      for (let i = 0; i < codes.length; i += BATCH) {
        const result = await api<{ deleted: number }>('/api/products/delete', {
          codes: codes.slice(i, i + BATCH),
          confirm: true,
        });
        deleted += result.deleted;
      }
      setSelected(new Set());
      setNotice(
        `${deleted} produto(s) excluído(s) do sistema. Publique as alterações para tirar do site também.`,
      );
    } catch (cause) {
      setError(
        `${deleted ? `${deleted} excluído(s) antes do erro. ` : ''}${
          cause instanceof Error ? cause.message : 'Falha ao excluir.'
        }`,
      );
    } finally {
      setConfirming(false);
      await onRefresh().catch(() => undefined);
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <Panel
      title="Fora de linha"
      note="Produtos que a planilha do ERP marcou com Fora de linha = FL, Revenda = N ou Enviar para Força de Vendas = N. Ficam fora do site, do app e do PDF, mas continuam guardados aqui com foto e dados. A cada importação a planilha decide de novo: se a marcação sair, o produto sai desta lista (e você publica quando quiser)."
    >
      <div className="out-catalog-toolbar">
        <strong>{flagged.length} produto(s) fora de linha</strong>
        <Input
          aria-label="Buscar nos produtos fora de linha"
          placeholder="Buscar por código, nome, marca ou motivo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {!flagged.length ? (
        <p>Nenhum produto fora de linha. Eles aparecem aqui depois de importar a planilha do ERP.</p>
      ) : (
        <>
          <div className="out-catalog-actions">
            <label className="out-catalog-check">
              <input type="checkbox" checked={allShown} onChange={toggleShown} />
              Selecionar {query ? 'os da busca' : 'todos'} ({shown.length})
            </label>
            {!confirming ? (
              <Button
                variant="destructive"
                disabled={!chosen.length || busy || dirty}
                onClick={() => setConfirming(true)}
              >
                <Trash2 /> Excluir selecionados ({chosen.length})
              </Button>
            ) : (
              <div className="out-catalog-confirm" role="alert">
                <span>
                  Excluir de vez {chosen.length} produto(s)? Foto, descrição e dados editados somem
                  e não dá para desfazer.
                </span>
                <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
                  Confirmar exclusão
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
          {dirty && <p>Salve ou desfaça a edição aberta antes de excluir.</p>}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          {notice && <p className="success-message">{notice}</p>}
          <ul className="out-catalog-list">
            {shown.map((p) => (
              <li key={p.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(p.code)}
                    onChange={() => toggle(p.code)}
                    aria-label={`Selecionar ${p.code} ${p.name}`}
                  />
                  {p.image ? <img src={p.image} alt="" loading="lazy" /> : <span className="out-catalog-noimg" />}
                  <span className="out-catalog-info">
                    <strong>
                      {p.code} · {p.name}
                    </strong>
                    <small>
                      {p.brand} · {p.details?.outOfCatalog}
                      {p.published ? ' · ainda publicado' : ''}
                    </small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      {!flagged.length && notice && <p className="success-message">{notice}</p>}
    </Panel>
  );
}
