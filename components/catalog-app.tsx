'use client';
import { useEffect, useMemo, useState } from 'react';
import { catalogColorStyle } from '@/lib/catalog-colors';
import { Menu, Package, Search, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { type Product } from '@/lib/catalog-data';
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
import { CatalogBanners } from './catalog-banners';
import { CatalogBrands } from './catalog-brands';
import { CatalogSegments } from './catalog-segments';
import { catalogLayoutStyle } from '@/lib/catalog-layout';
import { ProductCard } from './product-card';
import { ProductDetailsDialog } from './product-details-dialog';
import { CatalogCampaign } from './catalog-campaign';
import { defaultCampaign } from '@/lib/catalog-campaign';
import { ProductShowcaseCarousel } from './product-showcase-carousel';
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
const unique = (values: string[]) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
export function CatalogApp({
  showEditorLink = true,
  editorPreview = false,
}: {
  showEditorLink?: boolean;
  editorPreview?: boolean;
}) {
  const [items, setItems] = useState<Product[]>([]);
  const [config, setConfig] = useState<CatalogConfig>(defaultConfig);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [limit, setLimit] = useState(12);
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
        ),
      ]);
      setItems(data);
      setConfig(settings.config);
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
  const filtered = useMemo(() => discover(items, filters), [items, filters]);
  const searchResults = useMemo(
    () =>
      searchQuery.trim()
        ? discover(items, { ...emptyFilters, query: searchQuery.trim() })
        : [],
    [items, searchQuery],
  );
  const visibleBlocks = config.blocks.filter((b) => b.visible);
  const has = (type: Block['type']) =>
    visibleBlocks.some((b) => b.type === type);
  function update(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setLimit(12);
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
          campaign={config.campaign ?? defaultCampaign}
          intro={<div className="campaign-visual-spacer" aria-hidden="true" />}
        >
          <div className="catalog-filter-band">
            <div className="catalog-toolbar catalog-taxonomy-toolbar">
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
            </div>
          </div>
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
            {filtered.length > limit && (
              <div className="load-more">
                <Button
                  variant="outline"
                  onClick={() => setLimit((n) => n + 12)}
                >
                  Mostrar mais produtos ({filtered.length - limit})
                </Button>
              </div>
            )}
          </section>
        </CatalogCampaign>
      );
    if (block.type === 'offers')
      return (
        <ProductShowcaseCarousel
          key={block.id}
          kind="offers"
          settings={{ ...config.offers, title: block.title }}
          items={items}
          onOpen={setSelected}
        />
      );
    if (block.type === 'new-products')
      return (
        <ProductShowcaseCarousel
          key={block.id}
          kind="new-products"
          settings={{ ...config.newProducts, title: block.title }}
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
              <h2>{block.title}</h2>
            </div>
            <p>{block.body}</p>
          </div>
          <CatalogSegments
            segments={config.segments}
            items={items}
            email={config.email}
            style={style}
          />
        </section>
      );
    if (block.type === 'brands')
      return (
        <section key={block.id} id="marcas" className="brands-section">
          <span className="eyebrow">Conheça nossas marcas</span>
          <h2>{block.title}</h2>
          <p>{block.body}</p>
          <CatalogBrands
            brands={config.brands}
            items={items}
            email={config.email}
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
  return (
    <main
      id="inicio"
      className={`public-catalog ${config.font === 'serif' ? 'serif-headings' : ''}`}
      style={style}
    >
      <a className="skip-link" href="#catalogo">
        Pular para o catálogo
      </a>
      <div className="announcement">
        <span>{config.tagline}</span>
      </div>
      <header className="site-header">
        <a
          href="#inicio"
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
          {has('segments') && <a href="#segmentos">Segmentos</a>}
          {has('brands') && <a href="#marcas">Marcas</a>}
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
        <div className="access-message" role="status">
          Carregando catálogo…
        </div>
      ) : error ? (
        <div className="access-message">
          <p role="alert">{error}</p>
          <Button onClick={() => void load()}>Tentar novamente</Button>
        </div>
      ) : (
        visibleBlocks.map(renderBlock)
      )}
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <a
              href="#inicio"
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
            {has('segments') && <a href="#segmentos">Segmentos atendidos</a>}
            {has('brands') && <a href="#marcas">Marcas parceiras</a>}
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
        email={config.email}
        style={style}
      />
    </main>
  );
}

