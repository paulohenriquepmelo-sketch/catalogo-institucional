'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Blocks,
  CircleUserRound,
  LogOut,
  Eye,
  FileSpreadsheet,
  Image,
  LayoutDashboard,
  Loader2,
  Megaphone,
  BadgePercent,
  Package,
  Palette,
  Plus,
  Save,
  Search,
  Sparkles,
  Tags,
  Wrench,
  Archive,
  FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildSegments } from '@/lib/segments';
import { defaultConfig, type CatalogConfig } from '@/lib/catalog-config';
import {
  catalogDateKey,
  expireProductOffer,
  detailFields,
  productIssues,
  type Product,
} from '@/lib/catalog-data';
import { api, loadProducts } from '@/lib/client-api';
import { Field, Choice, Toggle, UploadField, Panel } from './editor-controls';
import {
  CommercialContactSettings,
  ConfigEditor,
  type EditorView,
} from './config-editor';
import { useCatalogTools } from '@/hooks/use-catalog-tools';
import { useAutoLoad } from '@/hooks/use-auto-load';
import { ImportEditor } from './import-editor';
import { PhotoFraming } from './photo-framing';
import { ErpFixesEditor } from './erp-fixes-editor';
import { CatalogPdfPanel } from './catalog-pdf-panel';
import { OutOfCatalogArea } from './out-of-catalog-area';
import { CampaignEditor } from './campaign-editor';
import { ProductImagePicker } from './product-image-picker';

const navigation: { key: EditorView; label: string; icon: typeof Package }[] = [
  { key: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { key: 'products', label: 'Produtos', icon: Package },
  { key: 'imports', label: 'Importações', icon: FileSpreadsheet },
  { key: 'erp', label: 'Correções do ERP', icon: Wrench },
  { key: 'outOfCatalog', label: 'Fora de linha', icon: Archive },
  { key: 'promotions', label: 'Ofertas e novidades', icon: BadgePercent },
  { key: 'taxonomy', label: 'Hierarquia', icon: Blocks },
  { key: 'brands', label: 'Marcas e logos', icon: Tags },
  { key: 'segments', label: 'Segmentos', icon: Sparkles },
  { key: 'banners', label: 'Banners e carrossel', icon: Megaphone },
  { key: 'campaigns', label: 'Temas e fundo', icon: Image },
  { key: 'appearance', label: 'Aparência e página', icon: Palette },
];
const blank: Product = {
  id: 0,
  code: '',
  name: '',
  description: '',
  department: '',
  section: '',
  category: '',
  segment: 'Sem classificação',
  brand: '',
  image: '',
  specs: [],
  published: false,
  featured: false,
};
const unique = (values: string[]) => [...new Set(values)];
const dateKey = catalogDateKey;
export function EditorApp({ userName }: { userName: string }) {
  const [items, setItems] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Product>(blank);
  const [baseline, setBaseline] = useState(blank);
  const [config, setConfig] = useState<CatalogConfig>(defaultConfig);
  const [cleanupConfirm, setCleanupConfirm] = useState('');
  const [savedConfig, setSavedConfig] = useState(defaultConfig);
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState<EditorView>('products');
  const [query, setQuery] = useState('');
  const [productLimit, setProductLimit] = useState(40);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [noPhotoOnly, setNoPhotoOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [publicationDirty, setPublicationDirty] = useState(false);
  const productDirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const configDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);
  const dirty = productDirty || configDirty;
  const onBusy = useCallback(
    (start: boolean) => setUploads((n) => Math.max(0, n + (start ? 1 : -1))),
    [],
  );
  async function load() {
    setLoading(true);
    setError('');
    try {
      const [data, settings, publication] = await Promise.all([
        loadProducts(true),
        api<{ config: CatalogConfig; revision: number }>(
          '/api/config?editor=1',
        ),
        api<{ hasChanges: boolean }>('/api/publication'),
      ]);
      setItems(data);
      setDraft(data[0] ?? blank);
      setBaseline(data[0] ?? blank);
      setConfig(settings.config);
      setSavedConfig(settings.config);
      setRevision(settings.revision);
      setPublicationDirty(publication.hasChanges);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }
  async function refreshAfterImport() {
    const [products, settings, publication] = await Promise.all([
      loadProducts(true),
      api<{ config: CatalogConfig; revision: number }>('/api/config?editor=1'),
      api<{ hasChanges: boolean }>('/api/publication'),
    ]);
    setItems(products);
    const selected =
      products.find((p) => p.id === draft.id) ?? products[0] ?? blank;
    setDraft(selected);
    setBaseline(selected);
    setConfig(settings.config);
    setSavedConfig(settings.config);
    setRevision(settings.revision);
    setPublicationDirty(publication.hasChanges);
    return { products, config: settings.config };
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    let lastDate = catalogDateKey();
    const expire = () => {
      const today = catalogDateKey();
      if (today === lastDate) return;
      lastDate = today;
      setItems((current) => {
        const next = current.map((product) =>
          expireProductOffer(product, today),
        );
        return next.some((product, index) => product !== current[index])
          ? next
          : current;
      });
      setDraft((current) => expireProductOffer(current, today));
      setBaseline((current) => expireProductOffer(current, today));
    };
    const timer = window.setInterval(expire, 1000);
    window.addEventListener('focus', expire);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', expire);
    };
  }, []);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty || busy || uploads > 0) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, busy, uploads]);
  function choose(p: Product) {
    if (
      productDirty &&
      !window.confirm('Descartar as alterações não salvas deste produto?')
    )
      return;
    setDraft(p);
    setBaseline(p);
    setError('');
    setMessage('');
  }
  function addProduct() {
    const path = savedConfig.taxonomy[0];
    choose({ ...blank, ...path, brand: savedConfig.brands[0]?.name ?? '' });
  }
  function changePath(key: 'department' | 'section', value: string) {
    const path = savedConfig.taxonomy.find((p) =>
      key === 'department'
        ? p.department === value
        : p.department === draft.department && p.section === value,
    );
    if (path) setDraft({ ...draft, ...path });
  }
  const filtered = items.filter(
    (p) =>
      `${p.name} ${p.code} ${p.brand} ${p.details?.ean ?? ''}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!reviewOnly ||
        productIssues(p).length > 0 ||
        p.segment === 'Sem classificação') &&
      (!noPhotoOnly || (p.published && !p.image)),
  );
  const withoutPhoto = items.filter((p) => p.published && !p.image).length;
  const moreProducts = useAutoLoad(
    () => setProductLimit((n) => n + 40),
    filtered.length > productLimit,
    productLimit,
  );
  const [listPdfBusy, setListPdfBusy] = useState(false);
  async function downloadNoPhotoList() {
    setListPdfBusy(true);
    setError('');
    try {
      const { renderNoPhotoPdf } = await import('@/lib/no-photo-pdf');
      const blob = await renderNoPhotoPdf(
        items.filter((p) => p.published && !p.image),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `produtos-sem-foto-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(
        e instanceof Error && /dynamically imported module/i.test(e.message)
          ? 'O editor foi atualizado. Recarregue a página e tente de novo.'
          : 'Não foi possível gerar a lista em PDF.',
      );
    } finally {
      setListPdfBusy(false);
    }
  }
  // Segmentos das regras novas (as mesmas do app e do site) para este produto.
  const draftSegments = useMemo(
    () =>
      buildSegments([{ ...draft, published: true } as Product])
        .filter((s) => s.products.length > 0)
        .map(
          (s) => `${s.rule.name} (${s.groups.map((g) => g.name).join(', ')})`,
        ),
    [draft],
  );
  async function saveProduct() {
    if (busy || uploads || loading)
      throw new Error('Aguarde a operação atual.');
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const p = await api<Product>('/api/products', draft);
      setDraft(p);
      setBaseline(p);
      setItems((current) =>
        current.some((x) => x.id === p.id)
          ? current.map((x) => (x.id === p.id ? p : x))
          : [p, ...current],
      );
      setPublicationDirty(true);
      setMessage(
        p.published
          ? 'Produto salvo no editor. Publique as alterações para atualizar o site público.'
          : 'Rascunho salvo. Ele não será enviado ao site público.',
      );
      return { id: p.id, published: p.published, segment: p.segment };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function savePage() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (configDirty) {
        const result = await api<{ config: CatalogConfig; revision: number }>(
          '/api/config',
          { config, revision },
        );
        setConfig(result.config);
        setSavedConfig(result.config);
        setRevision(result.revision);
      }
      const publication = await api<{
        publishedAt: string;
        productCount: number;
      }>('/api/publication', { confirm: true });
      setPublicationDirty(false);
      setMessage(
        `Alterações publicadas no site público. ${publication.productCount} produtos enviados.`,
      );
      const data = await loadProducts(true);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  }
  async function clearProductAndLogoImages() {
    if (busy || uploads > 0 || loading) return;
    if (cleanupConfirm.trim() !== 'LIMPAR') return;
    setCleanupConfirm('');
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api<{
        productsCleared: number;
        logosCleared: number;
        filesDeleted: number;
      }>('/api/editor/clear-images', { confirm: true });
      await load();
      setPublicationDirty(true);
      setMessage(
        `Limpeza concluída: ${result.productsCleared} produtos e ${result.logosCleared} logos sem imagem.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Não foi possível limpar as imagens.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggleShowcaseProduct(
    product: Product,
    kind: 'offers' | 'new-products',
    enabled: boolean,
  ) {
    if (busy || uploads || loading) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const start = new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const next: Product = {
        ...product,
        details: {
          ...product.details,
          ...(kind === 'offers'
            ? {
                offer: {
                  enabled,
                  discount: product.details?.offer?.discount ?? 40,
                  startsAt: product.details?.offer?.startsAt ?? dateKey(start),
                  endsAt: product.details?.offer?.endsAt ?? dateKey(end),
                },
              }
            : { showAsNew: enabled }),
        },
      };
      const saved = await api<Product>('/api/products', next);
      setItems((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      if (draft.id === saved.id) {
        setDraft(saved);
        setBaseline(saved);
      }
      setPublicationDirty(true);
      setMessage(
        kind === 'offers'
          ? enabled
            ? 'Produto incluído na vitrine de ofertas. Ajuste o desconto e a validade no cadastro do produto, se necessário.'
            : 'Produto removido da vitrine de ofertas.'
          : enabled
            ? 'Produto incluído na vitrine de novidades.'
            : 'Produto removido da vitrine de novidades.',
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Falha ao atualizar a vitrine.',
      );
    } finally {
      setBusy(false);
    }
  }
  useCatalogTools([
    {
      name: 'save_current_product',
      title: 'Salvar produto atual',
      description:
        'Salva no servidor o produto que está aberto no editor, incluindo o estado publicado ou rascunho. Requer administrador autorizado.',
      inputSchema: {
        type: 'object',
        properties: { confirm: { type: 'boolean', const: true } },
        required: ['confirm'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input) => {
        if (
          !input ||
          typeof input !== 'object' ||
          (input as { confirm?: boolean }).confirm !== true ||
          Object.keys(input).length !== 1
        )
          throw new Error('Confirmação explícita necessária.');
        if (view !== 'products')
          throw new Error('Abra um produto antes de salvar.');
        return saveProduct();
      },
    },
  ]);
  // Salvar/publicar as configurações da página; usado nas abas de configuração
  // e no contato comercial da Visão geral.
  const pageSaveBar = (
    <div className="settings-save">
      <span>
        {configDirty
          ? 'Alterações da página ainda não salvas.'
          : publicationDirty
            ? 'Alterações salvas e aguardando publicação.'
            : 'Site público atualizado.'}
      </span>
      <Button
        variant="outline"
        disabled={busy || uploads > 0}
        onClick={() => setConfig(savedConfig)}
      >
        Desfazer
      </Button>
      <Button
        disabled={busy || uploads > 0 || productDirty}
        onClick={() => void savePage()}
      >
        <Save /> Publicar alterações no site público
      </Button>
    </div>
  );
  return (
    <main className="editor-shell">
      <aside className="editor-sidebar">
        <a href="/" className="brand-lockup">
          {savedConfig.logo ? (
            <span className="editor-company-logo-frame">
              <img
                className="editor-site-logo"
                src={savedConfig.logo}
                alt={`Logo de ${savedConfig.name}`}
              />
            </span>
          ) : (
            <span className="brand-mark">{savedConfig.name.charAt(0)}</span>
          )}
          <span className="editor-brand-label">
            Central do catálogo
            <small>EDITOR COMERCIAL</small>
          </span>
        </a>
        <nav>
          <span className="editor-nav-title">Administrar catálogo</span>
          {navigation.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={view === key ? 'active' : ''}
              onClick={() => setView(key)}
              disabled={busy || uploads > 0}
            >
              <Icon />
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="editor-user">
          <CircleUserRound />
          <span>
            <strong>{userName}</strong>
            <small>Administrador autorizado</small>
          </span>
        </div>
      </aside>
      <section
        className={`editor-workspace${view === 'products' ? ' editor-workspace-products' : ''}`}
      >
        <header className="editor-topbar">
          <div>
            <a href="/">
              <ArrowLeft /> Ver catálogo
            </a>
            <strong>{navigation.find((n) => n.key === view)?.label}</strong>
          </div>
          <div>
            <span>
              {dirty
                ? 'Alterações não salvas'
                : publicationDirty
                  ? 'Alterações aguardando publicação'
                  : 'Sem alterações pendentes'}
            </span>
            <a href="/?version=published" target="_blank" rel="noreferrer">
              <Eye /> Ver versão publicada
            </a>
            <form
              method="post"
              action="/api/editor/logout"
              className="editor-logout"
            >
              <button type="submit" title="Sair do editor">
                <LogOut aria-hidden="true" /> Sair
              </button>
            </form>
            <Button
              disabled={busy || uploads > 0 || productDirty}
              onClick={() => void savePage()}
            >
              <Save /> Publicar alterações no site público
            </Button>
          </div>
        </header>
        <div className="editor-feedback" aria-live="polite">
          {error && (
            <p role="alert" className="error-message">
              {error}
              {error.startsWith('Sua sessão expirou') && (
                <>
                  {' '}
                  <a
                    href="/editor/login?return_to=%2Feditor"
                    target="_blank"
                    rel="noopener"
                  >
                    Entrar de novo em outra aba
                  </a>
                  , depois volte aqui e salve outra vez.
                </>
              )}
            </p>
          )}
          {message && <p className="success-message">{message}</p>}
        </div>
        {loading ? (
          <div
            className="access-message editor-catalog-loading"
            role="status"
            aria-live="polite"
          >
            <div className="editor-catalog-loading-logo" aria-hidden="true">
              {savedConfig.logo ? (
                <span className="editor-company-logo-frame">
                  <img
                    className="editor-site-logo"
                    src={savedConfig.logo}
                    alt=""
                  />
                </span>
              ) : (
                <span className="brand-mark">{savedConfig.name.charAt(0)}</span>
              )}
            </div>
            <p>Carregando o catálogo…</p>
          </div>
        ) : revision === 0 ? (
          <div className="access-message">
            <Button onClick={() => void load()}>Tentar novamente</Button>
          </div>
        ) : view === 'products' ? (
          <div className="editor-columns">
            <section className="product-list-panel">
              <div className="panel-heading">
                <h1>Produtos</h1>
                <Button onClick={addProduct} disabled={busy || uploads > 0}>
                  <Plus /> Novo
                </Button>
              </div>
              <label className="editor-search">
                <Search />
                <Input
                  aria-label="Buscar produto no editor"
                  placeholder="Nome, código ou marca"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setProductLimit(40);
                  }}
                />
              </label>
              <div className="product-list-head">
                {filtered.length} produtos
              </div>
              <Toggle
                label="Somente pendências"
                value={reviewOnly}
                onChange={(value) => {
                  setReviewOnly(value);
                  setProductLimit(40);
                }}
              />
              <Toggle
                label={`Somente publicados sem foto (${withoutPhoto})`}
                value={noPhotoOnly}
                onChange={(value) => {
                  setNoPhotoOnly(value);
                  setProductLimit(40);
                }}
              />
              {withoutPhoto > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={listPdfBusy}
                  onClick={() => void downloadNoPhotoList()}
                >
                  {listPdfBusy ? <Loader2 className="animate-spin" /> : <FileDown />}
                  Baixar lista sem foto (PDF)
                </Button>
              )}
              <div className="editor-product-list" data-autoload-root>
                {filtered.slice(0, productLimit).map((p) => (
                  <button
                    key={p.id}
                    className={p.id === draft.id ? 'active' : ''}
                    disabled={busy || uploads > 0}
                    onClick={() => choose(p)}
                  >
                    {p.image ? <img src={p.image} alt="" /> : <Package />}
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.code} · {p.brand}
                      </small>
                    </span>
                    <em className={p.published ? 'published' : ''}>
                      {p.published ? 'Publicado' : 'Rascunho'}
                    </em>
                  </button>
                ))}
                {!filtered.length && <p>Nenhum produto encontrado.</p>}
                {filtered.length > productLimit && (
                  <output ref={moreProducts} className="auto-load">
                    Carregando mais produtos… {productLimit} de{' '}
                    {filtered.length}
                  </output>
                )}
              </div>
            </section>
            <section className="product-form-panel">
              <div className="form-title">
                <h2>{draft.id ? 'Editar produto' : 'Novo produto'}</h2>
                <Toggle
                  label="Incluir na próxima publicação"
                  disabled={busy || uploads > 0}
                  value={draft.published === true}
                  onChange={(published) => setDraft({ ...draft, published })}
                />
              </div>
              <div className="product-form-scroll">
                <fieldset
                  disabled={busy || uploads > 0}
                  className="editor-form-grid"
                >
                  <Field
                    label="Nome"
                    value={draft.name}
                    onChange={(name) => setDraft({ ...draft, name })}
                  />
                  <Field
                    label="Código único"
                    value={draft.code}
                    onChange={(code) => setDraft({ ...draft, code })}
                  />
                  <Choice
                    label="Marca"
                    value={draft.brand}
                    options={savedConfig.brands.map((b) => b.name)}
                    onChange={(brand) => setDraft({ ...draft, brand })}
                  />
                  <Toggle
                    label="Produto em destaque"
                    value={draft.featured === true}
                    onChange={(featured) => setDraft({ ...draft, featured })}
                  />
                  <section className="offer-editor wide">
                    <div>
                      <h3>Oferta e promoção</h3>
                      <p>
                        Quando ativa e dentro do prazo, aparece automaticamente
                        na vitrine de ofertas do catálogo. Ao terminar o
                        período, a opção é desligada e o desconto é removido.
                      </p>
                    </div>
                    <Toggle
                      label="Produto em oferta"
                      value={draft.details?.offer?.enabled === true}
                      onChange={(enabled) => {
                        const start = new Date();
                        const end = new Date(start);
                        end.setDate(end.getDate() + 7);
                        setDraft({
                          ...draft,
                          details: {
                            ...draft.details,
                            offer: {
                              enabled,
                              discount: draft.details?.offer?.discount ?? 40,
                              startsAt:
                                draft.details?.offer?.startsAt ??
                                dateKey(start),
                              endsAt:
                                draft.details?.offer?.endsAt ?? dateKey(end),
                            },
                          },
                        });
                      }}
                    />
                    {draft.details?.offer && (
                      <div className="settings-row">
                        <Field
                          label="Desconto (%)"
                          type="number"
                          value={String(draft.details.offer.discount)}
                          onChange={(discount) =>
                            setDraft({
                              ...draft,
                              details: {
                                ...draft.details,
                                offer: {
                                  ...draft.details!.offer!,
                                  discount: Number(discount),
                                },
                              },
                            })
                          }
                        />
                        <Field
                          label="Início da oferta"
                          type="date"
                          value={draft.details.offer.startsAt}
                          onChange={(startsAt) =>
                            setDraft({
                              ...draft,
                              details: {
                                ...draft.details,
                                offer: { ...draft.details!.offer!, startsAt },
                              },
                            })
                          }
                        />
                        <Field
                          label="Fim da oferta"
                          type="date"
                          value={draft.details.offer.endsAt}
                          onChange={(endsAt) =>
                            setDraft({
                              ...draft,
                              details: {
                                ...draft.details,
                                offer: { ...draft.details!.offer!, endsAt },
                              },
                            })
                          }
                        />
                      </div>
                    )}
                  </section>
                  <div className="wide">
                    <Field
                      label="Descrição e aplicação"
                      multiline
                      value={draft.description}
                      onChange={(description) =>
                        setDraft({ ...draft, description })
                      }
                    />
                  </div>
                  <Choice
                    label="Departamento"
                    value={draft.department}
                    options={unique(
                      savedConfig.taxonomy.map((t) => t.department),
                    )}
                    onChange={(v) => changePath('department', v)}
                  />
                  <Choice
                    label="Seção"
                    value={draft.section}
                    options={unique(
                      savedConfig.taxonomy
                        .filter((t) => t.department === draft.department)
                        .map((t) => t.section),
                    )}
                    onChange={(v) => changePath('section', v)}
                  />
                  <Choice
                    label="Categoria"
                    value={draft.category}
                    options={unique(
                      savedConfig.taxonomy
                        .filter(
                          (t) =>
                            t.department === draft.department &&
                            t.section === draft.section,
                        )
                        .map((t) => t.category),
                    )}
                    onChange={(category) => setDraft({ ...draft, category })}
                  />
                  <div className="ai-segment-card">
                    <span>
                      <Sparkles /> Segmentos (mesmas regras do app e do site)
                    </span>
                    <strong>
                      {draftSegments.length
                        ? `${draftSegments.length} segmento${draftSegments.length > 1 ? 's' : ''}`
                        : 'Nenhum segmento'}
                    </strong>
                    <small>
                      {draftSegments.length
                        ? draftSegments.join(' · ')
                        : 'Confira o nome e a categoria: nenhuma regra reconheceu este produto.'}
                    </small>
                  </div>
                  <div className="wide">
                    <Field
                      label="Características técnicas (uma por linha)"
                      multiline
                      value={draft.specs.join('\n')}
                      onChange={(value) =>
                        setDraft({ ...draft, specs: value.split('\n') })
                      }
                    />
                  </div>
                  <div className="wide">
                    <h3>Embalagem e identificação</h3>
                    <p className="source-note">
                      {draft.details?.sourceFile
                        ? `Importado de ${draft.details.sourceFile}, linha ${draft.details.sourceRow}. Fornecedor é um campo interno.`
                        : 'Complete os dados de cadastro. Fornecedor não aparece na área pública.'}
                    </p>
                  </div>
                  {detailFields.map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      value={draft.details?.[key] ?? ''}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          details: { ...draft.details, [key]: value },
                        })
                      }
                    />
                  ))}
                  {productIssues(draft).length > 0 && (
                    <div className="data-warning wide">
                      <strong>Conferir cadastro</strong>
                      <ul>
                        {productIssues(draft).map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                      <small>
                        Os valores originais foram preservados. A conferência de
                        formato não valida o dígito verificador do EAN.
                      </small>
                    </div>
                  )}
                </fieldset>
                <fieldset disabled={busy || uploads > 0}>
                  <ProductImagePicker
                    name={draft.name}
                    brand={draft.brand}
                    code={draft.code}
                    onChange={(image) =>
                      setDraft((current) => ({ ...current, image }))
                    }
                    onBusy={onBusy}
                  />
                  <UploadField
                    label="Imagem do produto"
                    product
                    value={draft.image}
                    onChange={(image) =>
                      setDraft((current) => ({ ...current, image }))
                    }
                    onBusy={onBusy}
                  />
                </fieldset>
              </div>
              <div className="form-actions">
                <Button
                  variant="outline"
                  disabled={busy || uploads > 0}
                  onClick={() => {
                    setDraft(baseline);
                    setError('');
                  }}
                >
                  Desfazer
                </Button>
                <Button
                  disabled={busy || uploads > 0 || !draft.name || !draft.code}
                  onClick={() => void saveProduct().catch(() => {})}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Save />}{' '}
                  {draft.published
                    ? 'Salvar produto no editor'
                    : 'Salvar produto como rascunho'}
                </Button>
              </div>
            </section>
          </div>
        ) : view === 'imports' ? (
          <>
            <ImportEditor
              dirty={dirty}
              onBusy={onBusy}
              onRefresh={refreshAfterImport}
            />
            <PhotoFraming
              dirty={dirty}
              onBusy={onBusy}
              onRefresh={refreshAfterImport}
            />
            {/* Ação que apaga em massa: fora da Visão geral e com confirmação
                digitada, para não ser disparada por engano. */}
            <Panel
              title="Zona de risco"
              note="Ações que afetam o catálogo inteiro. Nada muda no site público até você publicar."
            >
              <section
                className="editor-maintenance"
                aria-labelledby="image-cleanup-title"
              >
                <h2 id="image-cleanup-title">Limpeza de imagens</h2>
                <p>
                  Remove do rascunho a foto de todos os produtos, o logo
                  institucional e o logo de todas as marcas. Banners, textos,
                  categorias e demais cadastros permanecem intactos. Não há
                  como desfazer pelo editor.
                </p>
                <label className="editor-field" htmlFor="image-cleanup-confirm">
                  <span>Para confirmar, digite LIMPAR</span>
                  <Input
                    id="image-cleanup-confirm"
                    value={cleanupConfirm}
                    autoComplete="off"
                    onChange={(e) => setCleanupConfirm(e.target.value)}
                  />
                </label>
                <Button
                  variant="outline"
                  disabled={
                    busy || uploads > 0 || cleanupConfirm.trim() !== 'LIMPAR'
                  }
                  onClick={() => void clearProductAndLogoImages()}
                >
                  Limpar imagens de logos e produtos
                </Button>
              </section>
            </Panel>
          </>
        ) : view === 'outOfCatalog' ? (
          <OutOfCatalogArea
            items={items}
            dirty={dirty}
            onBusy={onBusy}
            onRefresh={refreshAfterImport}
          />
        ) : view === 'erp' ? (
          <ErpFixesEditor
            items={items}
            taxonomy={savedConfig.taxonomy}
            dirty={dirty}
            onBusy={onBusy}
            onRefresh={refreshAfterImport}
          />
        ) : view === 'overview' ? (
          <>
          <Panel
            title="Seu catálogo em um só lugar"
            note="O site público mostra apenas os itens publicados. Todas as edições precisam ser salvas."
          >
            <div className="summary-grid">
              <article>
                <strong>{items.length}</strong>
                <span>Produtos cadastrados</span>
              </article>
              <article>
                <strong>{items.filter((p) => p.published).length}</strong>
                <span>Publicados</span>
              </article>
              <article>
                <strong>
                  {
                    items.filter((p) => p.segment === 'Sem classificação')
                      .length
                  }
                </strong>
                <span>Para classificar</span>
              </article>
              <article>
                <strong>{withoutPhoto}</strong>
                <span>Publicados sem foto</span>
              </article>
              <article>
                <strong>{savedConfig.brands.length}</strong>
                <span>Marcas</span>
              </article>
            </div>
            <Button onClick={() => setView('products')}>
              Gerenciar produtos
            </Button>
          </Panel>
          <Panel
            title="Contato comercial"
            note="O WhatsApp e o e-mail viram botões no popup de cada produto e no link “Qual é o RCA da sua região?” do topo. Os três contatos aparecem no rodapé do site."
          >
            <fieldset
              disabled={busy || uploads > 0}
              className="config-container"
            >
              <CommercialContactSettings config={config} onChange={setConfig} />
            </fieldset>
            {pageSaveBar}
          </Panel>
          <CatalogPdfPanel onBusy={onBusy} />
          </>
        ) : (
          <>
            <fieldset
              disabled={busy || uploads > 0}
              className="config-container"
            >
              {view === 'campaigns' ? (
                <CampaignEditor
                  config={config}
                  onChange={setConfig}
                  onBusy={onBusy}
                />
              ) : (
                <ConfigEditor
                  view={view}
                  config={config}
                  onChange={setConfig}
                  onBusy={onBusy}
                  products={items}
                  onProductToggle={toggleShowcaseProduct}
                />
              )}
            </fieldset>
            {pageSaveBar}
          </>
        )}
      </section>
    </main>
  );
}
