'use client';
/* oxlint-disable next/no-img-element -- Search previews come from an allowlisted raster source; selected files are optimized before storage. */
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { importProductImage } from '@/lib/import-brand-logo';
import {
  productImageSearchTerm,
  productImageSearchUrl,
} from '@/lib/product-images';
import type { LogoResult } from '@/lib/logo-search';

export function ProductImagePicker({
  name,
  brand,
  code,
  onChange,
  onBusy,
}: {
  name: string;
  brand: string;
  code: string;
  onChange: (image: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const initialQuery = productImageSearchTerm(name, brand, code);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<LogoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const searchRequest = useRef<AbortController | null>(null);
  const choosing = useRef(false);

  useEffect(() => () => searchRequest.current?.abort(), []);

  async function search(term: string) {
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setLoading(true);
    setResults([]);
    setSearched(false);
    setError('');
    try {
      const response = await fetch(
        '/api/product-images/search?q=' + encodeURIComponent(term),
        { signal: controller.signal },
      );
      const data = (await response.json()) as {
        error?: string;
        results?: LogoResult[];
      };
      if (!response.ok || !data.results)
        throw new Error(data.error ?? 'Falha na busca.');
      if (!controller.signal.aborted) {
        setResults(data.results);
        setSearched(true);
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'Falha na busca.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function selectImage(result: LogoResult | File) {
    if (choosing.current) return;
    choosing.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    setNotice('');
    try {
      const imported = await importProductImage(
        result instanceof File ? result : result.id,
        name || code || 'produto',
      );
      onChange(imported.url);
      setNotice(
        `Foto selecionada. ${imported.summary}. Salve o produto para aplicar.`,
      );
      setOpen(false);
    } catch (cause) {
      setError(
        (cause instanceof Error ? cause.message : 'Falha na seleção.') +
          ' A foto anterior foi mantida.',
      );
    } finally {
      choosing.current = false;
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (choosing.current) return;
          setOpen(next);
          if (!next) {
            searchRequest.current?.abort();
            setLoading(false);
          }
        }}
      >
        <DialogTrigger
          className="brand-logo-search product-image-search"
          disabled={!name.trim() && !code.trim()}
          onClick={() => {
            const nextQuery = productImageSearchTerm(name, brand, code);
            setQuery(nextQuery);
            setNotice('');
            void search(nextQuery);
          }}
        >
          <Search aria-hidden="true" /> Buscar e selecionar foto
        </DialogTrigger>
        <DialogContent className="logo-picker-dialog" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Escolher foto — {name || code}</DialogTitle>
            <DialogDescription>
              Clique na imagem correta para preencher o produto. A alteração
              só será publicada quando você salvar o produto.
            </DialogDescription>
          </DialogHeader>
          <div className="logo-picker-search">
            <Input
              aria-label="Termos para buscar fotos do produto"
              value={query}
              disabled={busy}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void search(query);
                }
              }}
            />
            <Button
              type="button"
              disabled={busy || loading || query.trim().length < 2}
              onClick={() => void search(query)}
            >
              <Search /> Buscar
            </Button>
          </div>
          <p className="source-note">
            Fonte: Wikimedia Commons. Somente imagens identificadas pela fonte
            como domínio público ou CC0. Confira embalagem, variante e marca
            antes de selecionar.
          </p>
          {busy ? (
            <output className="logo-picker-status">
              <Loader2 className="animate-spin" /> Preparando e convertendo a
              foto para WebP…
            </output>
          ) : loading ? (
            <output className="logo-picker-status">
              <Loader2 className="animate-spin" /> Buscando fotos…
            </output>
          ) : null}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <div className="logo-picker-results" aria-busy={loading || busy}>
            {results.map((result) => (
              <article key={result.id}>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Selecionar ${result.title}`}
                  onClick={() => void selectImage(result)}
                >
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <strong>{result.title}</strong>
                  <span>Usar esta foto</span>
                </button>
                <a
                  href={result.source}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver fonte e condições <ExternalLink size={12} />
                </a>
              </article>
            ))}
          </div>
          {searched && !results.length && (
            <p>
              Nenhuma foto disponível nessa fonte. Ajuste os termos ou
              cole/envie a imagem abaixo.
            </p>
          )}
          <div
            className="logo-picker-paste"
            onPaste={(event) => {
              event.preventDefault();
              const file = Array.from(event.clipboardData.files).find((item) =>
                item.type.startsWith('image/'),
              );
              if (file && !busy) void selectImage(file);
              else if (!busy)
                setError(
                  'Use “Copiar imagem” no site de origem, não “Copiar endereço da imagem”.',
                );
            }}
          >
            <strong>Não encontrou? Cole a imagem aqui com Ctrl+V</strong>
            <p>
              Em outro site, use “Copiar imagem” e volte a este campo. Ou
              escolha um arquivo:
            </p>
            <Textarea
              aria-label="Colar foto do produto"
              placeholder="Clique aqui e pressione Ctrl+V após copiar uma imagem"
              disabled={busy}
            />
            <Input
              type="file"
              aria-label="Enviar foto encontrada"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void selectImage(file);
                event.target.value = '';
              }}
            />
            <a
              href={productImageSearchUrl(query || initialQuery)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Pesquisar em outros sites <ExternalLink size={12} />
            </a>
          </div>
        </DialogContent>
      </Dialog>
      {notice && <output className="source-note">{notice}</output>}
    </>
  );
}
