'use client';
/* oxlint-disable next/no-img-element -- Search previews come from an allowlisted raster source; selected files are optimized before storage. */
import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { importBrandLogo } from '@/lib/import-brand-logo';
import { brandLogoSearchUrl } from '@/lib/catalog-brands';
import type { LogoResult } from '@/lib/logo-search';

export function BrandLogoPicker({
  name,
  onChange,
  onBusy,
}: {
  name: string;
  onChange: (logo: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(name);
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
        '/api/logos/search?q=' + encodeURIComponent(term),
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
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Falha na busca.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  async function selectLogo(result: LogoResult | File) {
    if (choosing.current) return;
    choosing.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    setNotice('');
    try {
      const imported = await importBrandLogo(
        result instanceof File ? result : result.id,
        name,
      );
      onChange(imported.url);
      setNotice(
        'Logo selecionada. ' +
          imported.summary +
          '. Salve a página para aplicar.',
      );
      setOpen(false);
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : 'Falha na seleção.') +
          ' A logo anterior foi mantida.',
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
          className="brand-logo-search"
          disabled={!name.trim()}
          onClick={() => {
            setQuery(name);
            setNotice('');
            void search(name);
          }}
        >
          <Search aria-hidden="true" /> Buscar e selecionar logo
        </DialogTrigger>
        <DialogContent className="logo-picker-dialog" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Escolher logo — {name}</DialogTitle>
            <DialogDescription>
              Clique na imagem correta para preencher a marca e voltar ao
              editor. A alteração só será publicada quando você salvar a página.
            </DialogDescription>
          </DialogHeader>
          <div className="logo-picker-search">
            <Input
              aria-label="Nome para buscar logos"
              value={query}
              disabled={busy}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
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
            Fonte: Wikimedia Commons. Apenas imagens identificadas pela fonte
            como domínio público ou CC0. Confira se correspondem à marca; não
            são automaticamente verificadas como oficiais.
          </p>
          {busy ? (
            <output className="logo-picker-status">
              <Loader2 className="animate-spin" /> Preparando e convertendo a
              logo para WebP…
            </output>
          ) : loading ? (
            <output className="logo-picker-status">
              <Loader2 className="animate-spin" /> Buscando logos…
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
                  onClick={() => void selectLogo(result)}
                >
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <strong>{result.title}</strong>
                  <span>Usar esta logo</span>
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
              Nenhuma logo disponível nessa fonte. Tente outro nome ou
              cole/envie a imagem abaixo.
            </p>
          )}
          <div
            className="logo-picker-paste"
            onPaste={(e) => {
              e.preventDefault();
              const file = Array.from(e.clipboardData.files).find((f) =>
                f.type.startsWith('image/'),
              );
              if (file && !busy) {
                void selectLogo(file);
              } else if (!busy)
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
              aria-label="Colar imagem de logo"
              placeholder="Clique aqui e pressione Ctrl+V após copiar uma imagem"
              disabled={busy}
            />
            <Input
              type="file"
              aria-label="Enviar logo encontrada"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void selectLogo(file);
                e.target.value = '';
              }}
            />
            <a
              href={brandLogoSearchUrl(query || name)}
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
