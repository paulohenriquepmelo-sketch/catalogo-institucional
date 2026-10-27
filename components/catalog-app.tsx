'use client';
import { useEffect, useMemo, useState } from 'react';
import { catalogColorStyle } from '@/lib/catalog-colors';
import {
  Download,
  Menu,
  MessageCircle,
  Package,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { CatalogPdfLink } from './catalog-pdf-download';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { catalogDateKey, type Product } from '@/lib/catalog-data';
import {
  defaultConfig,
  whatsappNumber,
  type CatalogConfig,
  type Block,
} from '@/lib/catalog-config';
import {
  discover,
  emptyFilters,
  similarProducts,
  type Filters,
} from '@/lib/catalog-discovery';
import { api, loadProducts } from '@/lib/client-api';
import { useCatalogTools } from '@/hooks/use-catalog-tools';
import { useAutoLoad } from '@/hooks/use-auto-load';
import { CatalogBanners } from './catalog-banners';
import { CatalogBrands } from './catalog-brands';
import { CatalogSegments } from './catalog-segments';
import { catalogLayoutStyle } from '@/lib/catalog-layout';
import { ProductCard } from './product-card';
import { ProductDetailsDialog } from './product-details-dialog';
import { CatalogCampaign } from './catalog-campaign';
import { campaignSkin, defaultCampaign } from '@/lib/catalog-campaign';
import {
  HighlightTitle,
  ProductShowcaseCarousel,
  selectActiveOffers,
  selectNewProducts,
} from './product-showcase-carousel';
import {
  ContactBand,
  HomeBenefits,
  HomeBrands,
  HomeFeatured,
  HomeHero,
  HomeSegments,
  SiteFooter,
  SiteHeader,
  SiteTopbar,
} from './site-sections';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
// Catálogo completo: os produtos entram na grade em lotes, sozinhos, conforme
// a pessoa rola a página (sem números de página nem botão).
const PAGE_SIZE = 24;
const unique = (values: string[]) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
export function CatalogApp({
  showEditorLink = true,
  editorPreview = false,
  fullCatalogPage = false,
}: {
  showEditorLink?: boolean;
  editorPreview?: boolean;
  fullCatalogPage?: boolean;
}) {
  const [items, setItems] = useState<Product[]>([]);
  const [config, setConfig] = useState<CatalogConfig>(defaultConfig);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  // Abas rápidas do tema que muda o site (Promoção / Lançamentos).
  const [quick, setQuick] = useState<'' | 'offers' | 'new'>('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [limit, setLimit] = useState(fullCatalogPage ? PAGE_SIZE : 12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    try {
      const [data, settings] = await Promise.all([
        loadProducts(editorPreview),
        api<{ config: CatalogConfig }>(
          `/api/config${editorPreview ? '?editor=1' : ''}`,
          undefined,
          undefined,
          editorPreview ? 'no-store' : 'default',
        ),
      ]);
      setItems(data);
      setConfig(settings.config);
      // Busca vinda do topo de outra página: /produtos?busca=termo.
      const query = fullCatalogPage
        ? new URLSearchParams(window.location.search).get('busca')
        : null;
      if (query)
        setFilters((current) => ({ ...current, query: query.slice(0, 200) }));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Não foi possível carregar o catálogo.',
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [editorPreview]);
  const filtered = useMemo(() => {
    const found = discover(items, filters);
    if (!quick) return found;
    const picked = new Set(
      (quick === 'offers'
        ? selectActiveOffers(items, catalogDateKey(), items.length)
        : // os mesmos de "Acabaram de chegar"
          selectNewProducts(items, config.newProducts)
      ).map((p) => p.id),
    );
    return found.filter((p) => picked.has(p.id));
  }, [items, filters, quick, config.newProducts]);
  // Página de produtos: o próximo lote entra sozinho ao chegar perto do fim.
  const moreProducts = useAutoLoad(
    () => setLimit((current) => current + PAGE_SIZE),
    fullCatalogPage && filtered.length > limit,
    limit,
  );
  const searchResults = useMemo(
    () =>
      searchQuery.trim()
        ? discover(items, { ...emptyFilters, query: searchQuery.trim() })
        : [],
    [items, searchQuery],
  );
  const allVisibleBlocks = config.blocks.filter((b) => b.visible);
  // Layout novo (sem tema especial): o catálogo completo mostra ofertas e
  // novidades antes da grade; a página inicial tem seções próprias.
  const v2 = !campaignSkin(config.campaign);
  const fullPageTypes: Block['type'][] = v2
    ? ['offers', 'new-products', 'catalog']
    : ['catalog'];
  const visibleBlocks = fullCatalogPage
    ? fullPageTypes.flatMap((type) =>
        allVisibleBlocks.filter((b) => b.type === type),
      )
    : allVisibleBlocks;
  const has = (type: Block['type']) =>
    allVisibleBlocks.some((b) => b.type === type);
  function update(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setLimit(fullCatalogPage ? PAGE_SIZE : 12);
  }
  useCatalogTools([
    {
      name: 'search_catalog',
      title: 'Pesquisar catálogo',
      description:
        'Filtra os produtos publicados por texto, marca, segmento e hierarquia. Retorna os resultados visíveis do catálogo.',
      inputSchema: {
        type: 'object',
        properties: Object.fromEntries(
          [
            'query',
            'department',
            'section',
            'category',
            'brand',
            'segment',
          ].map((k) => [k, { type: 'string' }]),
        ),
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        if (loading || error) throw new Error('Catálogo indisponível.');
        if (!input || typeof input !== 'object' || Array.isArray(input))
          throw new Error('Filtros inválidos.');
        const next = { ...emptyFilters };
        for (const [key, value] of Object.entries(input)) {
          if (
            ![
              'query',
              'department',
              'section',
              'category',
              'brand',
              'segment',
            ].includes(key) ||
            typeof value !== 'string' ||
            value.length > 200
          )
            throw new Error('Filtros inválidos.');
          next[key as 'query'] = value;
        }
        setFilters(next);
        setLimit(12);
        return {
          products: discover(items, next).map(
            ({
              id,
              code,
              name,
              brand,
              department,
              section,
              category,
              segment,
            }) => ({
              id,
              code,
              name,
              brand,
              department,
              section,
              category,
              segment,
            }),
          ),
        };
      },
    },
    {
      name: 'open_product',
      title: 'Abrir produto',
      description:
        'Abre a ficha de um produto publicado pelo seu código e mostra itens similares.',
      inputSchema: {
        type: 'object',
        properties: { code: { type: 'string' } },
        required: ['code'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        if (
          !input ||
          typeof input !== 'object' ||
          Object.keys(input).length !== 1 ||
          typeof (input as { code?: unknown }).code !== 'string'
        )
          throw new Error('Código inválido.');
        const p = items.find(
          (p) => p.code === (input as { code: string }).code,
        );
        if (!p) throw new Error('Produto não encontrado.');
        setSelected(p);
        return {
          product: p,
          similar: similarProducts(items, p).map((x) => ({
            code: x.code,
            name: x.name,
          })),
        };
      },
    },
  ]);
  // Tema que muda o site todo (ex.: Black Friday): só com o tema pronto ativo.
  const skin = campaignSkin(config.campaign);
  const style = {
    ...catalogColorStyle(config),
    ...catalogLayoutStyle(config.layout),
  };
  const logoMark = config.logo ? (
    <span className="company-logo-frame" aria-hidden="true">
      <img className="site-logo" src={config.logo} alt="" />
    </span>
  ) : (
    <span className="brand-mark">{config.name.charAt(0)}</span>
  );
  function renderBlock(block: Block) {
    if (block.type === 'banners')
      return (
        <CatalogBanners key={block.id} config={config} title={block.title} />
      );
    if (block.type === 'catalog')
      return (
        <CatalogCampaign
          key={block.id}
          campaign={
            fullCatalogPage
              ? { ...(config.campaign ?? defaultCampaign), enabled: false }
              : (config.campaign ?? defaultCampaign)
          }
          intro={<div className="campaign-visual-spacer" aria-hidden="true" />}
        >
          <div className="catalog-filter-band">
            <div className="catalog-toolbar catalog-taxonomy-toolbar">
              {skin && !fullCatalogPage ? (
                <div className="category-tabs" aria-label="Mostrar">
                  {(
                    [
                      ['', 'Todos'],
                      ['offers', 'Promoção'],
                      ['new', 'Lançamentos'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={label}
                      aria-pressed={quick === value}
                      className={quick === value ? 'active' : ''}
                      onClick={() => {
                        setQuick(value);
                        setLimit(12);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
              <div className="category-tabs" aria-label="Departamento">
                <button
                  className={!filters.department ? 'active' : ''}
                  onClick={() =>
                    update({ department: '', section: '', category: '' })
                  }
                >
                  Todos
                </button>
                {unique(items.map((p) => p.department)).map((d) => (
                  <button
                    key={d}
                    aria-pressed={filters.department === d}
                    className={filters.department === d ? 'active' : ''}
                    onClick={() =>
                      update({ department: d, section: '', category: '' })
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
              )}
              <Filter
                label="Seção"
                value={filters.section}
                options={unique(
                  items
                    .filter(
                      (p) =>
                        !filters.department ||
                        p.department === filters.department,
                    )
                    .map((p) => p.section),
                )}
                onChange={(section) => update({ section, category: '' })}
              />
              <Filter
                label="Categoria"
                value={filters.category}
                options={unique(
                  items
                    .filter(
                      (p) =>
                        (!filters.department ||
                          p.department === filters.department) &&
                        (!filters.section || p.section === filters.section),
                    )
                    .map((p) => p.category),
                )}
                onChange={(category) => update({ category })}
              />
              {!skin && (
                <Filter
                  label="Marca"
                  value={filters.brand}
                  options={unique(
                    items
                      .filter(
                        (p) =>
                          p.brand &&
                          (!filters.department ||
                            p.department === filters.department) &&
                          (!filters.section || p.section === filters.section) &&
                          (!filters.category || p.category === filters.category),
                      )
                      .map((p) => p.brand),
                  )}
                  onChange={(brand) => update({ brand })}
                />
              )}
            </div>
          </div>
          {/* No tema que muda o site, a grade só aparece ao filtrar: a
              página começa pelas ofertas, como no esboço. */}
          {(!skin || fullCatalogPage || quick || filters.department || filters.section || filters.category) && (
          <section
            className="catalog-section catalog-results"
            aria-label="Produtos do catálogo"
          >
            <div className="result-line">
              <span role="status">
                {filtered.length}{' '}
                {filtered.length === 1
                  ? 'produto encontrado'
                  : 'produtos encontrados'}
                {filters.query && (
                  <>
                    {' '}para “{filters.query}”{' '}
                    <button
                      type="button"
                      className="clear-query"
                      onClick={() => {
                        update({ query: '' });
                        window.history.replaceState(null, '', window.location.pathname);
                      }}
                    >
                      Limpar busca
                    </button>
                  </>
                )}
              </span>
              <label>
                Ordenar{' '}
                <NativeSelect
                  aria-label="Ordenar produtos"
                  value={filters.sort}
                  onChange={(e) =>
                    update({ sort: e.target.value as Filters['sort'] })
                  }
                >
                  <option value="featured">Destaques</option>
                  <option value="name">Nome: A–Z</option>
                </NativeSelect>
              </label>
            </div>
            <div className="product-grid">
              {filtered.slice(0, limit).map((p) => (
                <ProductCard key={p.id} product={p} onOpen={setSelected} />
              ))}
            </div>
            {!filtered.length && (
              <div className="empty-state">
                <Package />
                <h2>
                  {items.length
                    ? 'Nenhum produto com esses filtros.'
                    : 'O catálogo ainda está sendo preparado.'}
                </h2>
                <p>
                  {items.length
                    ? 'Experimente outra busca ou limpe os filtros.'
                    : 'Em breve, os produtos publicados aparecerão aqui.'}
                </p>
              </div>
            )}
            {fullCatalogPage && !!filtered.length && filtered.length <= limit && (
              <p className="catalog-end">Você chegou ao final do catálogo.</p>
            )}
            {filtered.length > limit && (
              <div className="load-more">
                {fullCatalogPage ? (
                  <output ref={moreProducts} className="auto-load">
                    Carregando mais produtos… {limit} de {filtered.length}
                  </output>
                ) : (
                  <a className="catalog-page-link" href="/produtos">
                    Ver todos os produtos ({filtered.length})
                  </a>
                )}
              </div>
            )}
          </section>
          )}
        </CatalogCampaign>
      );
    if (block.type === 'offers')
      return (
        <ProductShowcaseCarousel
          key={block.id}
          kind="offers"
          // No tema que muda o site, as ofertas são cartões lado a lado.
          settings={{
            ...config.offers,
            title: skin?.offers.title ?? block.title,
            ...(skin ? { layout: 'carousel' as const } : {}),
          }}
          titleHighlight={skin?.offers.highlight}
          actionLabel={skin ? 'Oferta' : undefined}
          items={items}
          onOpen={setSelected}
        />
      );
    if (block.type === 'new-products')
      return (
        <ProductShowcaseCarousel
          key={block.id}
          kind="new-products"
          settings={{
            ...config.newProducts,
            title: skin?.newProducts.title ?? block.title,
            eyebrow: skin?.newProducts.subtitle ?? config.newProducts.eyebrow,
          }}
          items={items}
          onOpen={setSelected}
        />
      );
    if (block.type === 'segments')
      return (
        <section key={block.id} id="segmentos" className="segments-section">
          <div className="section-heading light">
            <div>
              <span className="eyebrow">Encontre pela aplicação</span>
              <h2>
                <HighlightTitle
                  text={skin?.segments.title ?? block.title}
                  word={skin?.segments.highlight}
                />
              </h2>
            </div>
            <p>{skin?.segments.subtitle ?? block.body}</p>
          </div>
          <CatalogSegments
            items={items}
            contact={config}
            style={style}
          />
        </section>
      );
    if (block.type === 'brands')
      return (
        <section key={block.id} id="marcas" className="brands-section">
          <span className="eyebrow">Conheça nossas marcas</span>
          <h2>
            <HighlightTitle
              text={skin?.brands.title ?? block.title}
              word={skin?.brands.highlight}
            />
          </h2>
          <p>{skin?.brands.subtitle ?? block.body}</p>
          <CatalogBrands
            brands={config.brands}
            items={items}
            contact={config}
            style={style}
          />
        </section>
      );
    return (
      <section key={block.id} id={`bloco-${block.id}`} className="text-section">
        <span className="eyebrow">Institucional</span>
        <h2>{block.title}</h2>
        <p>{block.body}</p>
      </section>
    );
  }
  // Contato do topo para o cliente descobrir o RCA (representante) que
  // atende a região dele: WhatsApp comercial, ou e-mail quando não houver.
  const hasOffers =
    has('offers') &&
    config.offers.published &&
    selectActiveOffers(items, catalogDateKey(), 1).length > 0;
  function search(query: string) {
    if (!fullCatalogPage) {
      window.location.href = query
        ? `/produtos?busca=${encodeURIComponent(query)}`
        : '/produtos';
      return;
    }
    update({ query });
    window.history.replaceState(
      null,
      '',
      query ? `?busca=${encodeURIComponent(query)}` : window.location.pathname,
    );
    document.getElementById('catalogo')?.scrollIntoView({ block: 'start' });
  }
  if (v2)
    return (
      <main
        id="inicio"
        className={`public-catalog site-v2 ${fullCatalogPage ? 'full-catalog-page' : ''}`}
        style={style}
      >
        <a className="skip-link" href="#catalogo">
          Pular para o catálogo
        </a>
        {!fullCatalogPage && (
          <h1 className="sr-only">{`${config.name} — catálogo de produtos`}</h1>
        )}
        <SiteTopbar config={config} />
        <SiteHeader
          key={filters.query}
          config={config}
          current={fullCatalogPage ? 'catalogo' : 'inicio'}
          hasSegments={has('segments')}
          hasBrands={has('brands')}
          hasOffers={hasOffers}
          showEditorLink={showEditorLink}
          onSearch={search}
          initialQuery={filters.query}
        />
        {config.demo && (
          <div className="demo-notice">
            Catálogo demonstrativo — produtos, marcas, fotos e especificações
            ilustrativos. Substitua pelo seu cadastro real no editor.
          </div>
        )}
        {loading ? (
          <output className="v2-container v2-loading" aria-live="polite">
            <span className="sr-only">Carregando catálogo…</span>
            <div className="v2-product-grid" aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className="v2-skeleton" />
              ))}
            </div>
          </output>
        ) : error ? (
          <div className="access-message">
            <p role="alert">{error}</p>
            <Button onClick={() => void load()}>Tentar novamente</Button>
          </div>
        ) : fullCatalogPage ? (
          <>
            <section
              className="v2-catalog-intro"
              aria-labelledby="catalog-page-title"
            >
              <div className="v2-container v2-catalog-intro-inner">
                <div>
                  <span className="v2-eyebrow">Catálogo completo</span>
                  <h1 id="catalog-page-title">Todos os produtos</h1>
                  <p>
                    Encontre rapidamente o item ideal usando a busca e os
                    filtros por departamento, seção, categoria e marca.
                  </p>
                </div>
                <div className="v2-catalog-actions">
                  <a href="/api/app-download" download className="app-download-link">
                    <Download className="size-4" aria-hidden="true" />
                    Baixe o app
                  </a>
                  <CatalogPdfLink className="app-download-link" />
                </div>
              </div>
            </section>
            {visibleBlocks.map((block) =>
              block.type === 'offers' ? (
                <div id="ofertas" key={block.id}>
                  {renderBlock(block)}
                </div>
              ) : (
                renderBlock(block)
              ),
            )}
          </>
        ) : (
          <>
            <HomeHero config={config} />
            <HomeBenefits />
            {has('segments') && (
              <HomeSegments items={items} config={config} style={style} />
            )}
            {has('brands') && (
              <HomeBrands items={items} config={config} style={style} />
            )}
            <HomeFeatured items={items} onOpen={setSelected} />
          </>
        )}
        <ContactBand config={config} />
        <SiteFooter
          config={config}
          current={fullCatalogPage ? 'catalogo' : 'inicio'}
          hasSegments={has('segments')}
          hasBrands={has('brands')}
          hasOffers={hasOffers}
        />
        <ProductDetailsDialog
          selected={selected}
          onSelect={setSelected}
          items={items}
          contact={config}
          style={style}
        />
      </main>
    );
  const rcaMessage =
    'Olá! Quero saber qual é o RCA (representante comercial) que atende a minha região. Minha cidade é: ';
  const rcaHref = config.whatsapp
    ? `https://wa.me/${whatsappNumber(config.whatsapp)}?text=${encodeURIComponent(rcaMessage)}`
    : config.email
      ? `mailto:${config.email}?subject=${encodeURIComponent('RCA da minha região')}&body=${encodeURIComponent(rcaMessage)}`
      : '';
  return (
    <main
      id="inicio"
      className={`public-catalog ${fullCatalogPage ? 'full-catalog-page' : ''} ${config.font === 'serif' ? 'serif-headings' : ''} ${skin ? `skin-${skin.id}` : ''}`}
      style={style}
    >
      <a className="skip-link" href="#catalogo">
        Pular para o catálogo
      </a>
      {/* Página inicial: título principal só para leitores de tela e buscadores. */}
      {!fullCatalogPage && (
        <h1 className="sr-only">{`${config.name} — catálogo de produtos`}</h1>
      )}
      <div className={rcaHref ? 'announcement has-rca' : 'announcement'}>
        {skin ? (
          <span className="announcement-skin">
            {skin.announcement.map((text) => (
              <span key={text}>{text}</span>
            ))}
          </span>
        ) : (
          <span>{config.tagline}</span>
        )}
        {rcaHref && (
          <a
            className="announcement-rca"
            href={rcaHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="size-3.5" aria-hidden="true" />
            Qual é o RCA da sua região? Fale conosco
          </a>
        )}
      </div>
      <header className="site-header">
        <a
          href={fullCatalogPage ? '/' : '#inicio'}
          className="brand-lockup"
          aria-label={`${config.name} — início`}
        >
          {logoMark}
        </a>
        <label className="header-search" htmlFor="catalog-header-search">
          <Search className="size-5" aria-hidden="true" />
          <Input
            id="catalog-header-search"
            aria-label="Buscar produtos"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (searchQuery.trim()) setSearchOpen(true);
            }}
            placeholder="Buscar por nome, código ou característica…"
          />
        </label>
        <nav
          aria-label="Principal"
          className={menuOpen ? 'main-nav is-open' : 'main-nav'}
          onClick={() => setMenuOpen(false)}
        >
          <a href="#catalogo">Catálogo</a>
          {has('segments') && (
            <a href={fullCatalogPage ? '/#segmentos' : '#segmentos'}>
              Segmentos
            </a>
          )}
          {has('brands') && (
            <a href={fullCatalogPage ? '/#marcas' : '#marcas'}>Marcas</a>
          )}
          <a href="/api/app-download" download className="app-download-link">
            <Download className="size-4" aria-hidden="true" />
            Baixe o app
          </a>
          <CatalogPdfLink className="app-download-link" />
          {showEditorLink && (
            <a href="/editor" className="editor-link">
              <Settings2 className="size-4" /> Editor
            </a>
          )}
        </nav>
        <Button
          variant="ghost"
          size="icon"
          className="menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X /> : <Menu />}
        </Button>
      </header>
      {config.demo && (
        <div className="demo-notice">
          Catálogo demonstrativo — produtos, marcas, fotos e especificações
          ilustrativos. Substitua pelo seu cadastro real no editor.
        </div>
      )}
      {loading ? (
        <div
          className="access-message catalog-loading"
          role="status"
          aria-live="polite"
        >
          <div className="catalog-loading-logo" aria-hidden="true">
            {logoMark}
          </div>
          <p>Carregando catálogo…</p>
        </div>
      ) : error ? (
        <div className="access-message">
          <p role="alert">{error}</p>
          <Button onClick={() => void load()}>Tentar novamente</Button>
        </div>
      ) : (
        <>
          {fullCatalogPage && (
            <section
              className="full-catalog-intro"
              aria-labelledby="catalog-page-title"
            >
              <span className="eyebrow">Catálogo completo</span>
              <h1 id="catalog-page-title">Todos os produtos</h1>
              <p>
                Encontre rapidamente o item ideal usando os filtros por
                departamento, seção e categoria.
              </p>
            </section>
          )}
          {visibleBlocks.map(renderBlock)}
        </>
      )}
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <a
              href={fullCatalogPage ? '/' : '#inicio'}
              className="footer-logo-card"
              aria-label={`${config.name} — início`}
            >
              <span className="footer-logo-crop">
                <img
                  src={config.logo || '/distribuidora-laurencini-logo.jpeg'}
                  alt={config.name}
                />
              </span>
            </a>
            <p>{config.footer}</p>
          </div>
          <div className="footer-navigation">
            <strong>Navegue</strong>
            <a href="#catalogo">Catálogo de produtos</a>
            {has('segments') && (
              <a href={fullCatalogPage ? '/#segmentos' : '#segmentos'}>
                Segmentos atendidos
              </a>
            )}
            {has('brands') && (
              <a href={fullCatalogPage ? '/#marcas' : '#marcas'}>
                Marcas parceiras
              </a>
            )}
            {(config.whatsapp || config.phone || config.email) && (
              <div className="footer-contact">
                <strong>Contato comercial</strong>
                {config.whatsapp && (
                  <a
                    href={`https://wa.me/${whatsappNumber(config.whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp {config.whatsapp}
                  </a>
                )}
                {config.phone && (
                  <a href={`tel:+${whatsappNumber(config.phone)}`}>
                    Telefone {config.phone}
                  </a>
                )}
                {config.email && (
                  <a href={`mailto:${config.email}`}>{config.email}</a>
                )}
              </div>
            )}
          </div>
          <div className="footer-commercial">
            <span>PARCERIA COMERCIAL</span>
            <h2>O mix certo para movimentar o seu negócio.</h2>
            <p>
              Explore produtos, marcas e embalagens para planejar suas próximas
              compras.
            </p>
            <a href="#catalogo">Explorar catálogo</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {config.name}
          </span>
          <span>Distribuição • Variedade • Relacionamento</span>
        </div>
      </footer>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="catalog-search-dialog" style={style}>
          <DialogHeader>
            <DialogTitle>Resultados da busca</DialogTitle>
            <DialogDescription>
              {searchResults.length}{' '}
              {searchResults.length === 1
                ? 'produto encontrado'
                : 'produtos encontrados'}{' '}
              para “{searchQuery.trim()}”.
            </DialogDescription>
          </DialogHeader>
          {searchResults.length ? (
            <div className="catalog-search-results product-grid">
              {searchResults.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpen={(next) => {
                    setSearchOpen(false);
                    setSelected(next);
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="catalog-search-empty">
              Nenhum produto corresponde à pesquisa. Tente outro nome ou código.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <ProductDetailsDialog
        selected={selected}
        onSelect={setSelected}
        items={items}
        contact={config}
        style={style}
      />
    </main>
  );
}
