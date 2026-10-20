'use client';
/* oxlint-disable next/no-img-element -- Preview compares existing uploads with local blobs. */
import { useEffect, useRef, useState } from 'react';
import { Crop, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import { Panel } from './editor-controls';
import { optimizeImage, type OptimizedImage } from '@/lib/optimize-image';
import type { Product } from '@/lib/catalog-data';
import type { CatalogConfig } from '@/lib/catalog-config';

type Snapshot = { products: Product[]; config: CatalogConfig };
type Sample = { code: string; name: string; before: string; after: string };
type Failure = { code: string; message: string };

const PREVIEW_SIZE = 8;
const PARALLEL = 3;

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Falha inesperada.';

// Download the current photo and run it through the same product framing used
// by new uploads. The file name carries the code the import route validates.
async function frame(product: Product): Promise<OptimizedImage> {
  const response = await fetch(product.image, {
    signal: AbortSignal.timeout(40000),
  });
  if (!response.ok) throw new Error('Foto atual não encontrada no storage.');
  const blob = await response.blob();
  return optimizeImage(
    new File([blob], `${product.code}.webp`, { type: blob.type }),
    { product: true },
  );
}

// Re-frames photos already linked to products. Each new photo goes through
// /api/import/images: a new file is stored (the old one stays in R2), only the
// image field changes, and the public site changes only after publishing.
export function PhotoFraming({
  dirty,
  onBusy,
  onRefresh,
}: {
  dirty: boolean;
  onBusy: (busy: boolean) => void;
  onRefresh: () => Promise<Snapshot>;
}) {
  const [targets, setTargets] = useState<Product[] | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState({ value: 0, total: 0 });
  const [result, setResult] = useState({ linked: 0, skipped: 0 });
  const [failures, setFailures] = useState<Failure[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const cancel = useRef(false);
  const blobUrls = useRef<string[]>([]);
  useEffect(
    () => () => blobUrls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );

  function lock(value: boolean) {
    setBusy(value);
    onBusy(value);
  }

  async function preview() {
    if (busy || dirty) return;
    lock(true);
    setError('');
    setNotice('');
    setFailures([]);
    setResult({ linked: 0, skipped: 0 });
    setProgress({ value: 0, total: 0 });
    blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrls.current = [];
    setSamples([]);
    try {
      const snapshot = await onRefresh();
      const list = snapshot.products.filter((p) => p.image);
      setTargets(list);
      const next: Sample[] = [];
      for (const product of list.slice(0, PREVIEW_SIZE)) {
        try {
          const framed = await frame(product);
          let after = product.image;
          if (!framed.alreadyFramed) {
            after = URL.createObjectURL(framed.file);
            blobUrls.current.push(after);
          }
          next.push({
            code: product.code,
            name: product.name,
            before: product.image,
            after,
          });
        } catch {
          // A broken photo is reported when the full run reaches it.
        }
      }
      setSamples(next);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      lock(false);
    }
  }

  async function run() {
    if (!targets?.length || busy || dirty) return;
    lock(true);
    setRunning(true);
    setStopping(false);
    setError('');
    setNotice('');
    cancel.current = false;
    const failed: Failure[] = [];
    let linked = 0;
    let skipped = 0;
    let processed = 0;
    let fatal = '';
    setProgress({ value: 0, total: targets.length });
    let next = 0;
    async function worker() {
      while (!cancel.current && !fatal && next < targets!.length) {
        const product = targets![next++];
        try {
          const framed = await frame(product);
          if (framed.alreadyFramed) skipped++;
          else {
            const form = new FormData();
            form.append('file', framed.file);
            form.append('code', product.code);
            form.append('expectedUpdatedAt', product.updatedAt ?? '');
            form.append('replaceExisting', 'true');
            const response = await fetch('/api/import/images', {
              method: 'POST',
              body: form,
              signal: AbortSignal.timeout(60000),
            });
            const data = (await response.json()) as { error?: string };
            if (response.status >= 500 || response.status === 403) {
              fatal = data.error ?? 'Conexão interrompida.';
              break;
            }
            if (response.ok) linked++;
            else
              failed.push({
                code: product.code,
                message: data.error ?? 'Falha ao enviar.',
              });
          }
        } catch (cause) {
          failed.push({ code: product.code, message: messageOf(cause) });
        }
        processed++;
        setProgress({ value: processed, total: targets!.length });
        setResult({ linked, skipped });
        setFailures([...failed]);
      }
    }
    try {
      await Promise.all(Array.from({ length: PARALLEL }, worker));
      if (fatal)
        setError(
          `${fatal} O processo foi interrompido. As fotos já trocadas foram mantidas; rode novamente para continuar (as prontas são puladas).`,
        );
      else
        setNotice(
          cancel.current && processed < targets.length
            ? `Interrompido. ${targets.length - processed} fotos não foram processadas; rode novamente para continuar.`
            : 'Concluído. Confira os produtos e clique em Publicar para levar as fotos ao site.',
        );
      await onRefresh().catch(() => undefined);
    } finally {
      setRunning(false);
      setTargets(null);
      lock(false);
    }
  }

  return (
    <Panel
      title="Padronizar fotos existentes"
      note="Corta as margens vazias e centraliza cada produto num quadrado, igual às fotos novas. As fotos antigas continuam guardadas e o site só muda depois de publicar."
    >
      {dirty && (
        <p role="alert" className="data-warning">
          Salve ou desfaça as alterações pendentes antes de padronizar as fotos.
        </p>
      )}
      <div className="import-actions">
        <Button
          variant="outline"
          disabled={busy || dirty}
          onClick={() => void preview()}
        >
          {busy && !running ? <Loader2 className="animate-spin" /> : <Eye />}
          Ver prévia
        </Button>
        {targets && (
          <Button
            disabled={busy || dirty || !targets.length}
            onClick={() => void run()}
          >
            <Crop />
            Padronizar {targets.length} fotos
          </Button>
        )}
      </div>
      {samples.length > 0 && (
        <div className="framing-preview">
          {samples.map((sample) => (
            <figure key={sample.code}>
              <div>
                <img src={sample.before} alt={`${sample.name}, foto atual`} />
                <img src={sample.after} alt={`${sample.name}, padronizada`} />
              </div>
              <figcaption>
                {sample.code} · antes / depois
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {(running || progress.total > 0) && (
        <div className="import-progress" aria-live="polite">
          <Progress
            value={progress.total ? (progress.value / progress.total) * 100 : 0}
          >
            <ProgressLabel>
              {progress.value} de {progress.total} processadas
            </ProgressLabel>
            <ProgressValue />
          </Progress>
          {running ? (
            <Button
              variant="outline"
              disabled={stopping}
              onClick={() => {
                cancel.current = true;
                setStopping(true);
              }}
            >
              {stopping
                ? 'Concluindo as fotos em andamento…'
                : 'Parar após as fotos em andamento'}
            </Button>
          ) : (
            <p>
              <strong>{result.linked} fotos padronizadas</strong> ·{' '}
              {result.skipped} já estavam padronizadas · {failures.length}{' '}
              falhas
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {notice && <output className="success-message">{notice}</output>}
      {failures.length > 0 && !running && (
        <ul className="framing-failures">
          {failures.slice(0, 50).map((failure) => (
            <li key={failure.code}>
              <strong>{failure.code}</strong>: {failure.message}
            </li>
          ))}
          {failures.length > 50 && <li>… e mais {failures.length - 50}.</li>}
        </ul>
      )}
    </Panel>
  );
}
