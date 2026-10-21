'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Loader2, Plus, Save, Trash2, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Choice, Field, Panel, Toggle } from './editor-controls';
import { api } from '@/lib/client-api';
import type { Product } from '@/lib/catalog-data';
import type { CatalogConfig, TaxonomyPath } from '@/lib/catalog-config';
import {
  applyErpFixes,
  findErpSuspects,
  type ErpFixes,
  type ErpProductFix,
} from '@/lib/erp-fixes';

type Snapshot = { products: Product[]; config: CatalogConfig };
type Stored = { fixes: ErpFixes; revision: number };
type ApplyResult = {
  updated: number;
  failed: { code: string; message: string }[];
  remaining: number;
};

const PREVIEW_ROWS = 40;
const pathLabel = (p: TaxonomyPath) => `${p.department} › ${p.section} › ${p.category}`;
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Falha inesperada.';
// Aspas escapadas e apóstrofo antes de =, +, - ou @: a planilha não vira fórmula.
const csvCell = (value: string) =>
  `"${(/^[=+\-@]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;

/**
 * Correções dos dados que vêm do ERP: abreviações nos nomes ("MAC" →
 * "MACARRÃO") e hierarquia certa por código. Ficam salvas à parte e são
 * reaplicadas em toda importação; aqui também dá para aplicá-las aos produtos
 * já cadastrados (o site muda só depois de publicar).
 */
export function ErpFixesEditor({
  items,
  taxonomy,
  dirty,
  onBusy,
  onRefresh,
}: {
  items: Product[];
  taxonomy: TaxonomyPath[];
  dirty: boolean;
  onBusy: (busy: boolean) => void;
  onRefresh: () => Promise<Snapshot>;
}) {
  const [stored, setStored] = useState<Stored | null>(null);
  const [fixes, setFixes] = useState<ErpFixes | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ value: 0, total: 0 });
  const [failures, setFailures] = useState<{ code: string; message: string }[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const cancel = useRef(false);

  useEffect(() => {
    api<Stored>('/api/editor/erp-fixes')
      .then((data) => {
        setStored(data);
        setFixes(data.fixes);
      })
      .catch((cause) => setError(messageOf(cause)));
  }, []);

  const unsaved = !!fixes && !!stored && JSON.stringify(fixes) !== JSON.stringify(stored.fixes);
  const byCode = useMemo(() => new Map(items.map((p) => [p.code, p])), [items]);
  const pathOptions = useMemo(() => taxonomy.map(pathLabel), [taxonomy]);
  const changes = useMemo(
    () =>
      fixes
        ? items
            .map((product) => ({ product, fixed: applyErpFixes(product, fixes) }))
            .filter(
              ({ product, fixed }) =>
                fixed.name !== product.name ||
                fixed.category !== product.category ||
                fixed.section !== product.section ||
                fixed.department !== product.department,
            )
        : [],
    [items, fixes],
  );
  const suspects = useMemo(
    () => (fixes ? findErpSuspects(items, fixes) : []),
    [items, fixes],
  );
  const hits = useMemo(() => {
    if (!fixes) return [];
    return fixes.abbreviations.map(
      (rule) =>
        items.filter(
          (p) =>
            applyErpFixes(p, { abbreviations: [rule], products: [], ignored: [] }).name !==
            p.name.replace(/\s+/g, ' ').trim(),
        ).length,
    );
  }, [items, fixes]);

  if (!fixes || !stored)
    return (
      <Panel title="Correções do ERP">
        {error ? (
          <p role="alert" className="error-message">
            {error}
          </p>
        ) : (
          <p aria-live="polite">
            <Loader2 className="animate-spin" /> Carregando correções…
          </p>
        )}
      </Panel>
    );

  const update = (next: Partial<ErpFixes>) => {
    setNotice('');
    setFixes({ ...fixes, ...next });
  };
  const setProductFix = (fix: ErpProductFix) =>
    update({
      products: fixes.products.some((f) => f.code === fix.code)
        ? fixes.products.map((f) => (f.code === fix.code ? fix : f))
        : [...fixes.products, fix],
    });

  function lock(value: boolean) {
    setBusy(value);
    onBusy(value);
  }

  async function save() {
    if (!fixes || !stored) return;
    lock(true);
    setError('');
    try {
      const saved = await api<Stored>('/api/editor/erp-fixes', {
        fixes,
        revision: stored.revision,
      });
      setStored(saved);
      setFixes(saved.fixes);
      setNotice('Correções salvas. A próxima importação já usa estas regras.');
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      lock(false);
    }
  }

  async function apply() {
    if (!stored || unsaved || dirty || !changes.length) return;
    lock(true);
    cancel.current = false;
    setError('');
    setNotice('');
    setFailures([]);
    const failed: { code: string; message: string }[] = [];
    let done = 0;
    setProgress({ value: 0, total: changes.length });
    try {
      while (!cancel.current) {
        const result = await api<ApplyResult>('/api/editor/erp-fixes/apply', {
          revision: stored.revision,
          skip: failed.map((f) => f.code),
        });
        done += result.updated;
        failed.push(...result.failed);
        setFailures([...failed]);
        setProgress({ value: done + failed.length, total: done + failed.length + result.remaining });
        if (!result.remaining || (!result.updated && !result.failed.length)) break;
      }
      await onRefresh();
      setNotice(
        `${done} produto(s) corrigido(s)${failed.length ? `, ${failed.length} com erro` : ''}. Publique para levar ao site.`,
      );
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      lock(false);
    }
  }

  function addCode() {
    const value = code.trim();
    const product = byCode.get(value);
    if (!product) {
      setError(`Código ${value || '(vazio)'} não encontrado no catálogo.`);
      return;
    }
    setError('');
    if (!fixes!.products.some((f) => f.code === value))
      setProductFix({ code: value, name: '', department: '', section: '', category: '' });
    setCode('');
  }

  function download() {
    const lines = [
      ['Tipo', 'Código ou abreviação', 'Nome / por extenso', 'Departamento', 'Seção', 'Categoria'],
      ...fixes!.products.map((f) => [
        'Produto',
        f.code,
        f.name || applyErpFixes(byCode.get(f.code) ?? { ...f, name: '' }, fixes!).name,
        f.department,
        f.section,
        f.category,
      ]),
      ...fixes!.abbreviations.map((a) => ['Abreviação', a.from, a.to, '', '', a.categories.join('; ')]),
    ];
    const blob = new Blob([`﻿${lines.map((l) => l.map(csvCell).join(';')).join('\r\n')}`], {
      type: 'text/csv;charset=utf-8',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'correcoes-erp.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  return (
    <div className="erp-fixes">
      <div className="editor-feedback" aria-live="polite">
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {notice && <p className="success-message">{notice}</p>}
      </div>

      <Panel
        title="Prévia e aplicação"
        note="As correções valem automaticamente em toda importação. Para os produtos que já estão no catálogo, salve e aplique abaixo; o site muda depois de publicar."
      >
        <p className="erp-fixes-summary">
          <strong>{changes.length}</strong> produto(s) mudam com as regras atuais.
          {unsaved && ' Há alterações não salvas.'}
        </p>
        {!!changes.length && (
          <ul className="erp-fixes-preview">
            {changes.slice(0, PREVIEW_ROWS).map(({ product, fixed }) => (
              <li key={product.id}>
                <code>{product.code}</code>
                <span>{product.name}</span>
                <span aria-hidden="true">→</span>
                <strong>{fixed.name}</strong>
                {fixed.category !== product.category && (
                  <small>
                    {product.category} → {fixed.category}
                  </small>
                )}
              </li>
            ))}
            {changes.length > PREVIEW_ROWS && <li>… e mais {changes.length - PREVIEW_ROWS}.</li>}
          </ul>
        )}
        {busy && progress.total > 0 && (
          <Progress value={(progress.value / progress.total) * 100}>
            <ProgressLabel>
              {progress.value} de {progress.total} produtos
            </ProgressLabel>
            <ProgressValue />
          </Progress>
        )}
        {!!failures.length && (
          <ul className="framing-failures">
            {failures.map((f) => (
              <li key={f.code}>
                <strong>{f.code}</strong> {f.message}
              </li>
            ))}
          </ul>
        )}
        <div className="erp-fixes-actions">
          <Button disabled={busy || !unsaved} onClick={() => void save()}>
            <Save /> Salvar correções
          </Button>
          <Button
            variant="outline"
            disabled={busy || unsaved || dirty || !changes.length}
            onClick={() => void apply()}
          >
            <Wand2 /> Aplicar em {changes.length} produto(s)
          </Button>
          {busy && progress.total > 0 && (
            <Button variant="ghost" onClick={() => (cancel.current = true)}>
              Parar
            </Button>
          )}
          <Button variant="ghost" disabled={busy} onClick={download}>
            <Download /> Baixar lista para o ERP
          </Button>
          {unsaved && (
            <Button variant="ghost" disabled={busy} onClick={() => setFixes(stored.fixes)}>
              Desfazer
            </Button>
          )}
        </div>
        {dirty && <p>Salve ou desfaça a edição aberta antes de aplicar.</p>}
      </Panel>

      <Panel
        title="Produtos possivelmente na categoria errada"
        note="Sugestão automática: a maioria dos produtos da mesma família está em outra categoria. Confira antes de corrigir."
      >
        {!suspects.length ? (
          <p>Nenhum produto suspeito no momento.</p>
        ) : (
          <ul className="erp-fixes-suspects">
            {suspects.map((s) => (
              <li key={s.code}>
                <div>
                  <strong>
                    {s.code} · {s.name}
                  </strong>
                  <small>
                    {s.current.category} → <b>{s.suggested.category}</b> ({s.evidence})
                  </small>
                </div>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => setProductFix({ code: s.code, name: '', ...s.suggested })}
                >
                  <Check /> Corrigir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => update({ ignored: [...fixes.ignored, s.code] })}
                >
                  <X /> Ignorar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Correções por produto"
        note="Use para um item que veio com categoria ou nome errado. Vale para este código em toda importação."
      >
        {fixes.products.map((fix) => {
          const product = byCode.get(fix.code);
          const current = fix.category ? pathLabel(fix) : '';
          return (
            <div className="settings-row erp-fixes-row" key={fix.code}>
              <div className="editor-field">
                <span>Produto</span>
                <strong className="erp-fixes-product">
                  <code>{fix.code}</code> {product?.name ?? 'fora do catálogo'}
                </strong>
              </div>
              <Field
                label="Nome (vazio = do ERP, com abreviações)"
                value={fix.name}
                onChange={(name) => setProductFix({ ...fix, name })}
              />
              <Choice
                label="Hierarquia (vazio = a do ERP)"
                value={current}
                options={pathOptions}
                onChange={(label) => {
                  const path = taxonomy[pathOptions.indexOf(label)];
                  setProductFix({
                    ...fix,
                    department: path?.department ?? '',
                    section: path?.section ?? '',
                    category: path?.category ?? '',
                  });
                }}
              />
              <Button
                variant="destructive"
                size="icon"
                aria-label={`Remover correção do código ${fix.code}`}
                onClick={() =>
                  update({ products: fixes.products.filter((f) => f.code !== fix.code) })
                }
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
        <form
          className="erp-fixes-add"
          onSubmit={(event) => {
            event.preventDefault();
            addCode();
          }}
        >
          <Field label="Código do produto" value={code} onChange={setCode} />
          <Button type="submit" variant="outline">
            <Plus /> Adicionar correção
          </Button>
        </form>
        {!!fixes.ignored.length && (
          <p>
            {fixes.ignored.length} sugestão(ões) ignorada(s).{' '}
            <Button variant="link" onClick={() => update({ ignored: [] })}>
              Mostrar de novo
            </Button>
          </p>
        )}
      </Panel>

      <Panel
        title="Abreviações nos nomes"
        note="Troca a abreviação pela palavra por extenso. Limite a regra às categorias onde ela tem esse sentido (ex.: “MAC” é macarrão em Massas, mas “macia” em escova). Separe categorias com ponto e vírgula."
      >
        {fixes.abbreviations.map((rule, i) => (
          <div className="settings-row erp-fixes-abbreviation" key={i}>
            <Field
              label="Como vem do ERP"
              value={rule.from}
              onChange={(from) =>
                update({
                  abbreviations: fixes.abbreviations.map((r, n) => (n === i ? { ...r, from } : r)),
                })
              }
            />
            <Field
              label="Por extenso"
              value={rule.to}
              onChange={(to) =>
                update({
                  abbreviations: fixes.abbreviations.map((r, n) => (n === i ? { ...r, to } : r)),
                })
              }
            />
            <Field
              label={`Categorias (vazio = todas) · ${hits[i] ?? 0} produto(s)`}
              value={rule.categories.join('; ')}
              onChange={(value) =>
                update({
                  abbreviations: fixes.abbreviations.map((r, n) =>
                    n === i
                      ? { ...r, categories: value.split(';').map((c) => c.trim()).filter(Boolean) }
                      : r,
                  ),
                })
              }
            />
            <Toggle
              label="Só no início do nome"
              value={rule.startOnly}
              onChange={(startOnly) =>
                update({
                  abbreviations: fixes.abbreviations.map((r, n) =>
                    n === i ? { ...r, startOnly } : r,
                  ),
                })
              }
            />
            <Button
              variant="destructive"
              size="icon"
              aria-label={`Remover abreviação ${rule.from}`}
              onClick={() =>
                update({ abbreviations: fixes.abbreviations.filter((_, n) => n !== i) })
              }
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() =>
            update({
              abbreviations: [
                ...fixes.abbreviations,
                { from: '', to: '', categories: [], startOnly: true },
              ],
            })
          }
        >
          <Plus /> Adicionar abreviação
        </Button>
      </Panel>
    </div>
  );
}
