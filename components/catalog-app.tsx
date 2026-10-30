'use client';
import { useEffect, useMemo, useState } from 'react';
import { catalogColorStyle } from '@/lib/catalog-colors';
import {
  Package,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { catalogDateKey, type Product } from '@/lib/catalog-data';
import {
  defaultConfig,
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
import { catalogLayoutStyle } from '@/lib/catalog-layout';
import { ProductCard } from './product-card';
import { ProductDetailsDialog } from './product-details-dialog';
import { CatalogCampaign } from './catalog-campaign';
import { defaultCampaign } from '@/lib/catalog-campaign';
import {
  selectActiveOffers,
} from './product-showcase-carousel';
import {
  ContactBand,
  HomeBenefits,
  HomeBrands,
  HomeFeatured,
  HomeHero,
  HomeSegments,
  NewProductsPanel,
  OffersPanel,
  SiteFooter,
  SiteHeader,
  SiteTopbar,
  activeSeasonalTheme,
} from './site-sections';
import { PromoPopupDialog } from './promo-popup';

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
  // Catálogo completo: "Somente em promoção" (só com oferta ativa).
  const [quick, setQuick] = useState<'' | 'offers'>('');
  const [selected, setSelected] = useState<Product | null>(null);
  // Celular: a coluna de filtros do catálogo completo abre num botão.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(fullCatalogPage ? PAGE_SIZE : 12);
  const [loading, setLoading] = useState(true);
  // Primeira carga: a logo pulsando cobre a página até a configuração chegar,
  // para não aparecer o visual Padrão antes do tema de data.
  const [booted, setBooted] = useState(false);
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
      setBooted(true);
    }
  }
  useEffect(() => {
    void load();
  }, [editorPreview]);
  // Os popups abrem num portal, fora do <main> do tema: o tema de data
  // ativo vai para o <html> e app/theme-popups.css pinta o fundo deles.
  const seasonalThemeId = activeSeasonalTheme(config)?.campaign.theme;
  useEffect(() => {
    const root = document.documentElement;
    if (seasonalThemeId) root.dataset.temaSazonal = seasonalThemeId;
    else delete root.dataset.temaSazonal;
    return () => {
      delete root.dataset.temaSazonal;
    };
  }, [seasonalThemeId]);
  const filtered = useMemo(() => {
    const found = discover(items, filters);
    if (!quick) return found;
    const picked = new Set(
      selectActiveOffers(items, catalogDateKey(), items.length).map((p) => p.id),
    );
    return found.filter((p) => picked.has(p.id));
  }, [items, filters, quick]);
  // Página de produtos: o próximo lote entra sozinho ao chegar perto do fim.
  const moreProducts = useAutoLoad(
    () => setLimit((current) => current + PAGE_SIZE),
    fullCatalogPage && filtered.length > limit,
    limit,
  );
  const allVisibleBlocks = config.blocks.filter((b) => b.visible);
  // O catálogo completo mostra as novidades antes da grade; a página
  // inicial tem seções próprias. Os temas de data só trocam o banner.
  const fullPageTypes: Block['type'][] = ['new-products', 'catalog'];
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
  const style = {
    ...catalogColorStyle(config),
    ...catalogLayoutStyle(config.layout),
  };
  // Catálogo completo no layout novo: filtros numa coluna à esquerda
  // (esboço de 27/10/2026), com departamento, seção, categoria, marca,
  // ordenação, promoção (só com oferta ativa) e "Limpar filtros".
  const sidebar = fullCatalogPage;
  const inDepartment = (p: Product) =>
    !filters.department || p.department === filters.department;
  const inSection = (p: Product) =>
    !filters.section || p.section === filters.section;
  const inCategory = (p: Product) =>
    !filters.category || p.category === filters.category;
  const hasActiveOffers =
    sidebar && selectActiveOffers(items, catalogDateKey(), 1).length > 0;
  const activeFilters = [
    filters.department,
    filters.section,
    filters.category,
    filters.brand,
    filters.query,
    quick,
  ].filter(Boolean).length;
  function clearFilters() {
    setFilters(emptyFilters);
    setQuick('');
    setLimit(PAGE_SIZE);
    window.history.replaceState(null, '', window.location.pathname);
  }
  const sideSelect = (
    id: string,
    label: string,
    all: string,
    value: string,
    options: string[],
    onChange: (value: string) => void,
  ) => (
    <div className="v2-filter-field">
      <label htmlFor={id}>{label}</label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
  const catalogSidebar = sidebar ? (
    <aside className="v2-filters" aria-label="Filtros do catálogo">
      <nav className="v2-breadcrumb" aria-label="Você está em">
        {/* oxlint-disable-next-line next/no-html-link-for-pages -- o site navega com links comuns. */}
        <a href="/">Início</a>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Catálogo</span>
      </nav>
      <button
        type="button"
        className="v2-filters-toggle"
        aria-expanded={filtersOpen}
        aria-controls="v2-filters-body"
        onClick={() => setFiltersOpen(!filtersOpen)}
      >
        <SlidersHorizontal aria-hidden="true" />
        Filtros{activeFilters ? ` (${activeFilters})` : ''}
      </button>
      <div
        id="v2-filters-body"
        className={filtersOpen ? 'v2-filters-body is-open' : 'v2-filters-body'}
      >
        <h2>Filtros</h2>
        {sideSelect(
          'filtro-departamento',
          'Departamento',
          'Todos os departamentos',
          filters.department,
          unique(items.map((p) => p.department).filter(Boolean)),
          (department) => update({ department, section: '', category: '' }),
        )}
        {sideSelect(
          'filtro-secao',
          'Seção',
          'Todas as seções',
          filters.section,
          unique(items.filter(inDepartment).map((p) => p.section).filter(Boolean)),
          (section) => update({ section, category: '' }),
        )}
        {sideSelect(
          'filtro-categoria',
          'Categoria',
          'Todas as categorias',
          filters.category,
          unique(
            items
              .filter((p) => inDepartment(p) && inSection(p))
              .map((p) => p.category)
              .filter(Boolean),
          ),
          (category) => update({ category }),
        )}
        {sideSelect(
          'filtro-marca',
          'Marca',
          'Todas as marcas',
          filters.brand,
          unique(
            items
              .filter((p) => inDepartment(p) && inSection(p) && inCategory(p))
              .map((p) => p.brand)
              .filter(Boolean),
          ),
          (brand) => update({ brand }),
        )}
        <div className="v2-filter-field">
          <label htmlFor="filtro-ordem">Ordenar por</label>
          <NativeSelect
            id="filtro-ordem"
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as Filters['sort'] })}
          >
            <option value="featured">Mais relevantes</option>
            <option value="name">Nome: A–Z</option>
          </NativeSelect>
        </div>
        {hasActiveOffers && (
          <label className="v2-filter-check" htmlFor="filtro-promocao">
            <input
              id="filtro-promocao"
              type="checkbox"
              checked={quick === 'offers'}
              onChange={(e) => {
                setQuick(e.target.checked ? 'offers' : '');
                setLimit(PAGE_SIZE);
              }}
            />
            Somente em promoção
          </label>
        )}
        <button
          type="button"
          className="v2-filters-clear"
          onClick={clearFilters}
          disabled={!activeFilters && filters.sort === 'featured'}
        >
          Limpar filtros
        </button>
      </div>
    </aside>
  ) : null;
  function renderBlock(block: Block) {
    if (block.type === 'catalog') {
      const results = (
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
              {!sidebar && (
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
              )}
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
      );
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
          <div className="v2-container v2-catalog-layout">
            {catalogSidebar}
            {results}
          </div>
        </CatalogCampaign>
      );
    }
    return null;
  }
  // Tema de data ativo (fora o Padrão): mesma página, com enfeites
  // e animação no banner e nos cards (app/theme-decor.css).
  const themeId =
    config.campaign?.enabled &&
    config.campaign.mode === 'theme' &&
    config.campaign.theme !== 'padrao'
      ? config.campaign.theme
      : '';
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
  return (
    <>
      {!booted && (
        <div className="site-loader" role="status">
          <img
            src="/distribuidora-laurencini-logo.jpeg"
            alt=""
            width={1600}
            height={960}
          />
          <span className="sr-only">Carregando o site…</span>
        </div>
      )}
      <main
        id="inicio"
        className={`public-catalog site-v2 ${fullCatalogPage ? 'full-catalog-page' : ''} ${themeId ? `v2-theme theme-${themeId}` : ''}`}
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
          products={items}
          onOpenProduct={setSelected}
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
              </div>
            </section>
            {visibleBlocks.map((block) =>
              block.type === 'new-products' ? (
                <NewProductsPanel
                  key={block.id}
                  settings={{ ...config.newProducts, title: block.title }}
                  items={items}
                  onOpen={setSelected}
                />
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
            {has('offers') && (
              <OffersPanel
                config={config}
                settings={{
                  ...config.offers,
                  title:
                    allVisibleBlocks.find((b) => b.type === 'offers')?.title ??
                    config.offers.title,
                }}
                items={items}
                onOpen={setSelected}
              />
            )}
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
        {!editorPreview && <PromoPopupDialog popup={config.popup} />}
        <ProductDetailsDialog
          selected={selected}
          onSelect={setSelected}
          items={items}
          contact={config}
          style={style}
        />
      </main>
    </>
    );
}
