'use client';
import { useEffect, useRef, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/catalog-data';

/** Acima disso o PDF sob medida demora demais no celular: oferece o completo. */
export const COLLECTION_PDF_LIMIT = 600;

export type CatalogPdfInfo = {
  available: boolean;
  generatedAt?: string;
  products?: number;
  pages?: number;
  size?: number;
};

export function useCatalogPdfInfo() {
  const [info, setInfo] = useState<CatalogPdfInfo | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/api/catalog-pdf?info=1')
      .then((r) => (r.ok ? (r.json() as Promise<CatalogPdfInfo>) : null))
      .then((data) => active && setInfo(data))
      .catch(() => active && setInfo(null));
    return () => {
      active = false;
    };
  }, []);
  return info;
}

export const megabytes = (bytes?: number) =>
  bytes ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB` : '';

/** Link do menu: só aparece depois que o editor gerou o PDF completo. */
export function CatalogPdfLink({ className }: { className?: string }) {
  const info = useCatalogPdfInfo();
  if (!info?.available) return null;
  return (
    <a
      href="/api/catalog-pdf"
      download
      className={className}
      title={`Catálogo completo em PDF${info.size ? ` (${megabytes(info.size)})` : ''}`}
    >
      <FileDown className="size-4" aria-hidden="true" />
      Catálogo em PDF
    </a>
  );
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * PDF só com os produtos da seleção (segmento, marca, grupo ou busca),
 * gerado no navegador com o mesmo layout do catálogo completo.
 */
export function CollectionPdfButton({ title, products }: { title: string; products: Product[] }) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const withPhoto = products.filter((p) => p.image).length;
  const tooMany = withPhoto > COLLECTION_PDF_LIMIT;

  async function generate() {
    setError('');
    abort.current = new AbortController();
    setProgress({ done: 0, total: withPhoto });
    try {
      const { renderCatalogPdf } = await import('@/lib/catalog-pdf-render');
      const blob = await renderCatalogPdf(products, {
        title,
        signal: abort.current.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      save(blob, `catalogo-laurencini-${slug(title) || 'selecao'}.pdf`);
    } catch (cause) {
      if (!abort.current?.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o PDF.');
    } finally {
      setProgress(null);
    }
  }

  if (!withPhoto) return null;
  return (
    <div className="collection-pdf">
      {progress ? (
        <>
          <span aria-live="polite">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Preparando{' '}
            {progress.done} de {progress.total} fotos…
          </span>
          <Button variant="ghost" size="sm" onClick={() => abort.current?.abort()}>
            Cancelar
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={tooMany}
          onClick={() => void generate()}
          title={
            tooMany
              ? `Seleção grande demais (${withPhoto} produtos). Use o catálogo completo em PDF ou escolha um grupo.`
              : undefined
          }
        >
          <FileDown aria-hidden="true" /> Baixar PDF ({withPhoto})
        </Button>
      )}
      {tooMany && !progress && (
        <small>Escolha um grupo ou baixe o catálogo completo no menu.</small>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
