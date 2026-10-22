'use client';
/* oxlint-disable next/no-img-element -- Prévia das imagens enviadas (WebP no storage). */
import { useEffect, useRef, useState } from 'react';
import { Download, FileDown, ImagePlus, Loader2, PenTool, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Panel } from './editor-controls';
import { api, loadProducts } from '@/lib/client-api';
import { optimizeImage } from '@/lib/optimize-image';
import { displayName, isDistribution, planCatalogPdf } from '@/lib/catalog-pdf';
import { NativeSelect } from '@/components/ui/native-select';
import { megabytes, useCatalogPdfInfo, type CatalogPdfInfo } from './catalog-pdf-download';

const OUTDATED =
  'O editor foi atualizado depois que esta página foi aberta. Recarregue a página e tente de novo.';
// Depois de um deploy, a aba aberta ainda pede o gerador pelo nome antigo
// (o arquivo mudou de nome e o antigo responde 404).
const messageOf = (cause: unknown) =>
  cause instanceof Error
    ? /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
        cause.message,
      )
      ? OUTDATED
      : cause.message
    : 'Falha ao gerar o PDF.';

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
  const [sections, setSections] = useState<string[]>([]);
  const [section, setSection] = useState('');
  // Seções da Distribuição (marcas): cada uma tem página própria no PDF e a
  // sobra da última página recebe a imagem da marca escolhida aqui.
  const [brandSections, setBrandSections] = useState<string[]>([]);
  const [sectionImages, setSectionImages] = useState<Record<string, string>>({});
  const [imageBusy, setImageBusy] = useState('');

  // Seções do que está publicado, para baixar só uma parte no CorelDRAW.
  useEffect(() => {
    loadProducts(false)
      .then((list) => {
        const withPhoto = list.filter((p) => p.image);
        const byName = (a: string, b: string) =>
          displayName(a).localeCompare(displayName(b), 'pt-BR');
        setSections([...new Set(withPhoto.map((p) => p.section))].sort(byName));
        setBrandSections(
          [
            ...new Set(
              withPhoto.filter((p) => isDistribution(p.department)).map((p) => p.section),
            ),
          ].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
        );
      })
      .catch(() => setSections([]));
    fetch('/api/catalog-pdf/section-images')
      .then((r) => (r.ok ? (r.json() as Promise<{ images: Record<string, string> }>) : null))
      .then((data) => data && setSectionImages(data.images))
      .catch(() => undefined);
  }, []);

  async function saveSectionImage(name: string, url: string) {
    const next = { ...sectionImages, [name]: url };
    if (!url) delete next[name];
    const data = await api<{ images: Record<string, string> }>('/api/catalog-pdf/section-images', {
      images: next,
    });
    setSectionImages(data.images);
  }

  async function uploadSectionImage(name: string, file?: File) {
    if (!file) return;
    setError('');
    setNotice('');
    setImageBusy(name);
    onBusy(true);
    try {
      const optimized = await optimizeImage(file);
      const form = new FormData();
      form.append('file', optimized.file);
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Falha no envio.');
      await saveSectionImage(name, data.url);
      setNotice(`Imagem de ${displayName(name)} salva. Gere o PDF de novo para aplicar.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha no envio.');
    } finally {
      setImageBusy('');
      onBusy(false);
    }
  }

  async function removeSectionImage(name: string) {
    setError('');
    setImageBusy(name);
    try {
      await saveSectionImage(name, '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover.');
    } finally {
      setImageBusy('');
    }
  }

  // Versão para editar: fotos em alta, texto como texto, baixada no computador
  // (não muda o PDF do site).
  async function downloadForCorel() {
    setError('');
    setNotice('');
    abort.current = new AbortController();
    onBusy(true);
    try {
      setStep('Lendo os produtos publicados…');
      const products = (await loadProducts(false)).filter(
        (p) => p.image && (!section || p.section === section),
      );
      setProgress({ done: 0, total: products.length });
      setStep('Preparando as fotos em alta…');
      const { renderCatalogPdf } = await import('@/lib/catalog-pdf-render');
      const blob = await renderCatalogPdf(products, {
        print: true,
        title: section ? displayName(section) : '',
        sectionImages,
        signal: abort.current.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const day = new Date().toISOString().slice(0, 10);
      const name = section ? `-${displayName(section).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}` : '';
      save(blob, `catalogo-laurencini${name}-${day}-coreldraw.pdf`);
      setNotice(`PDF para edição baixado (${megabytes(blob.size)}). No CorelDRAW: Arquivo › Importar, e escolha importar o texto como texto.`);
    } catch (cause) {
      setError(
        abort.current?.signal.aborted
          ? 'Geração cancelada.'
          : messageOf(cause),
      );
    } finally {
      setProgress(null);
      setStep('');
      onBusy(false);
    }
  }

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
        sectionImages,
        signal: abort.current.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setStep(`Enviando o PDF (${megabytes(blob.size)})…`);
      // Capa e sumário + páginas de produtos.
      const pages = planCatalogPdf(products).length + 2;
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
          : messageOf(cause),
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
          {error}{' '}
          {error === OUTDATED && (
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Recarregar página
            </Button>
          )}
        </p>
      )}
      {notice && <p className="success-message">{notice}</p>}
      {brandSections.length > 0 && (
        <section className="catalog-pdf-brands" aria-labelledby="catalog-pdf-brands-title">
          <h2 id="catalog-pdf-brands-title">Imagem das marcas (Distribuição)</h2>
          <p>
            Cada marca da Distribuição começa numa página própria. O espaço que sobra no fim da
            última página da marca recebe a imagem escolhida aqui (foto de produto, banner,
            embalagem…). A imagem aparece inteira, sem cortes, centralizada na área livre. Sem
            imagem, o espaço fica em branco.
          </p>
          <ul>
            {brandSections.map((name) => (
              <li key={name}>
                <span className="catalog-pdf-brand-preview">
                  {sectionImages[name] ? (
                    <img src={sectionImages[name]} alt={`Imagem de ${displayName(name)}`} />
                  ) : (
                    <ImagePlus aria-hidden="true" />
                  )}
                </span>
                <strong>{displayName(name)}</strong>
                <label className="upload-button">
                  {imageBusy === name ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                  {sectionImages[name] ? 'Trocar imagem' : 'Enviar imagem'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    disabled={!!imageBusy || !!step}
                    onChange={(e) => {
                      void uploadSectionImage(name, e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
                {sectionImages[name] && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!imageBusy || !!step}
                    onClick={() => void removeSectionImage(name)}
                  >
                    <Trash2 /> Remover
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
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
      <section className="catalog-pdf-corel" aria-labelledby="catalog-pdf-corel-title">
        <h2 id="catalog-pdf-corel-title">Editar no CorelDRAW</h2>
        <p>
          Baixa um PDF editável com fotos em alta resolução: no CorelDRAW, textos, faixas e fotos
          viram objetos separados. O catálogo inteiro fica com uns 80 a 90 MB: para editar,
          prefira uma seção por vez.
        </p>
        <div className="catalog-pdf-fonts">
          <strong>1. Instale as fontes antes de abrir no CorelDRAW</strong>
          <span>
            Sem elas o CorelDRAW troca a fonte do texto. Baixe as duas, abra cada arquivo e clique
            em Instalar.
          </span>
          <div className="catalog-pdf-actions">
            <a className="catalog-pdf-font" href="/catalog-pdf/Poppins-Regular.ttf" download>
              <Download className="size-4" aria-hidden="true" /> Baixar fonte Poppins Regular
            </a>
            <a className="catalog-pdf-font" href="/catalog-pdf/Poppins-Bold.ttf" download>
              <Download className="size-4" aria-hidden="true" /> Baixar fonte Poppins Bold
            </a>
          </div>
          <small>
            Fonte gratuita, licença{' '}
            <a href="/catalog-pdf/OFL-Poppins.txt" target="_blank" rel="noreferrer">
              SIL Open Font License
            </a>
            .
          </small>
        </div>
        <strong className="catalog-pdf-step">2. Baixe o catálogo para editar</strong>
        <div className="catalog-pdf-actions">
          <label className="editor-field">
            <span>Parte do catálogo</span>
            <NativeSelect value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">Catálogo inteiro</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {displayName(s)}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button variant="outline" disabled={!!step} onClick={() => void downloadForCorel()}>
            <PenTool /> Baixar para CorelDRAW
          </Button>
        </div>
      </section>
    </Panel>
  );
}
