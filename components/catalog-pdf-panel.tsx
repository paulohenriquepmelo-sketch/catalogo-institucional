'use client';
import { useRef, useState } from 'react';
import { FileDown, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Panel } from './editor-controls';
import { loadProducts } from '@/lib/client-api';
import { planCatalogPdf } from '@/lib/catalog-pdf';
import { megabytes, useCatalogPdfInfo, type CatalogPdfInfo } from './catalog-pdf-download';

/**
 * Gera o catálogo completo em PDF a partir do que está PUBLICADO no site e
 * guarda no storage: o botão do site público só baixa o arquivo pronto.
 */
export function CatalogPdfPanel({ onBusy }: { onBusy: (busy: boolean) => void }) {
  const loaded = useCatalogPdfInfo();
  const [info, setInfo] = useState<CatalogPdfInfo | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const abort = useRef<AbortController | null>(null);
  const current = info ?? loaded;

  async function generate() {
    setError('');
    setNotice('');
    abort.current = new AbortController();
    onBusy(true);
    try {
      setStep('Lendo os produtos publicados…');
      const products = (await loadProducts(false)).filter((p) => p.image);
      setProgress({ done: 0, total: products.length });
      setStep('Preparando as fotos…');
      const { renderCatalogPdf } = await import('@/lib/catalog-pdf-render');
      const blob = await renderCatalogPdf(products, {
        signal: abort.current.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setStep(`Enviando o PDF (${megabytes(blob.size)})…`);
      const pages = planCatalogPdf(products).length + 1;
      const response = await fetch(
        `/api/catalog-pdf?products=${products.length}&pages=${pages}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/pdf' },
          body: blob,
          signal: abort.current.signal,
        },
      );
      const data = (await response.json().catch(() => null)) as
        | (CatalogPdfInfo & { error?: string })
        | null;
      if (!response.ok || !data) throw new Error(data?.error ?? 'Falha ao salvar o PDF.');
      setInfo(data);
      setNotice('PDF publicado. O botão “Catálogo em PDF” do site já entrega esta versão.');
    } catch (cause) {
      setError(
        abort.current?.signal.aborted
          ? 'Geração cancelada. O PDF anterior continua no site.'
          : cause instanceof Error
            ? cause.message
            : 'Falha ao gerar o PDF.',
      );
    } finally {
      setProgress(null);
      setStep('');
      onBusy(false);
    }
  }

  const when = current?.generatedAt
    ? new Date(current.generatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '';
  return (
    <Panel
      title="Catálogo em PDF"
      note="Gera o catálogo completo no layout do catálogo impresso, com os produtos publicados que têm foto. Gere de novo depois de publicar mudanças: o site entrega sempre o último PDF gerado."
    >
      <p className="catalog-pdf-status">
        {current?.available
          ? `Último PDF: ${when} · ${current.products ?? '?'} produtos · ${current.pages ?? '?'} páginas · ${megabytes(current.size)}`
          : 'Nenhum PDF gerado ainda: o botão do site fica escondido até a primeira geração.'}
      </p>
      {progress && (
        <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0}>
          <ProgressLabel>
            {step} {progress.done} de {progress.total}
          </ProgressLabel>
          <ProgressValue />
        </Progress>
      )}
      {!progress && step && (
        <p aria-live="polite">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {step}
        </p>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {notice && <p className="success-message">{notice}</p>}
      <div className="catalog-pdf-actions">
        <Button disabled={!!step} onClick={() => void generate()}>
          <RefreshCw /> {current?.available ? 'Gerar de novo' : 'Gerar PDF do catálogo'}
        </Button>
        {step && (
          <Button variant="ghost" onClick={() => abort.current?.abort()}>
            Cancelar
          </Button>
        )}
        {current?.available && (
          <a className="catalog-pdf-link" href="/api/catalog-pdf" download>
            <FileDown className="size-4" aria-hidden="true" /> Baixar para conferir
          </a>
        )}
      </div>
    </Panel>
  );
}
