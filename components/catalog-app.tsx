'use client';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  Building2,
  Menu,
  Package,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { detailFields, type Product } from '@/lib/catalog-data';
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
import { api } from '@/lib/client-api';
import { useCatalogTools } from '@/hooks/use-catalog-tools';
import { CatalogBanners } from './catalog-banners';
import { CatalogBrands } from './catalog-brands';

function ProductCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (product: Product) => void;
}) {
  return (
    <button
      className={`product-card group ${product.image ? '' : 'without-photo'}`}
      onClick={() => onOpen(product)}
      aria-label={`Ver detalhes de ${product.name}`}
    >
      <span className="product-image-wrap">
        {product.image ? (
          <img
            src={product.image}
            alt=""
            className="product-image"
            loading="lazy"
          />
        ) : (
          <span className="missing-image">
            <Package /> Imagem não cadastrada
          </span>
        )}
        <span className="product-code">{product.code}</span>
        {product.featured && <span className="featured-badge">Destaque</span>}
      </span>
      <span className="product-copy">
        <span>
          <span className="product-brand">{product.brand}</span>
          <span className="product-name">{product.name}</span>
        </span>
        <ArrowRight className="size-5" />
      </span>
      <span className="product-path">
        {product.section} · {product.category}
      </span>
      {product.details?.packaging && (
        <span className="packaging-line">
          {product.details.packaging} · {product.details.salesUnitDescription}
        </span>
      )}
    </button>
  );
}
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
export function CatalogApp() {
  const [items, setItems] = useState<Product[]>([]);
  const [config, setConfig] = useState<CatalogConfig>(defaultConfig);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<Product | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [limit, setLimit] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    try {
      const [data, settings] = await Promise.all([
        api<Product[]>('/api/products'),
        api<{ config: CatalogConfig }>('/api/config'),
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
  }, []);
  const filtered = useMemo(() => discover(items, filters), [items, filters]);
  const similar = selected ? similarProducts(items, selected) : [];
  const visibleBlocks = config.blocks.filter((b) => b.visible);
  const has = (type: Block['type']) =>
    visibleBlocks.some((b) => b.type === type);
  function update(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setLimit(12);
  }
  function discovery(key: 'brand' | 'segment', value: string) {
    setFilters({ ...emptyFilters, [key]: value });
    setLimit(12);
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
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
    '--primary': config.primary,
    '--accent': config.accent,
    '--background': config.background,
  } as CSSProperties;
  const logo = (
    <>
      {config.logo ? (
        <img className="site-logo" src={config.logo} alt="" />
      ) : (
        <span className="brand-mark">{config.name.charAt(0)}</span>
      )}
      <span>
        {config.name}
        <small>CATÁLOGO</small>
      </span>
    </>
  );
  function renderBlock(block: Block) {
    if (block.type === 'banners')
      return (
        <CatalogBanners key={block.id} config={config} title={block.title} />
      );
    if (block.type === 'catalog')
      return (
        <section key={block.id} id="catalogo" className="catalog-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Catálogo institucional</span>
              <h1>{block.title}</h1>
            </div>
            <p>{block.body}</p>
          </div>
          <div className="catalog-toolbar">
            <label className="search-field">
              <Search className="size-5" />
              <Input
                aria-label="Buscar produtos"
                value={filters.query}
                onChange={(e) => update({ query: e.target.value })}
                placeholder="Buscar por nome, código ou característica…"
              />
            </label>
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
          </div>
          <div className="catalog-filters">
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
            <Filter
              label="Marca"
              value={filters.brand}
              options={unique(items.map((p) => p.brand))}
              onChange={(brand) => update({ brand })}
            />
            <Filter
              label="Segmento"
              value={filters.segment}
              options={unique(items.map((p) => p.segment))}
              onChange={(segment) => update({ segment })}
            />
            <Button
              variant="ghost"
              onClick={() => {
                setFilters(emptyFilters);
                setLimit(12);
              }}
            >
              Limpar filtros
            </Button>
          </div>
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
              <Button variant="outline" onClick={() => setLimit((n) => n + 12)}>
                Mostrar mais produtos ({filtered.length - limit})
              </Button>
            </div>
          )}
        </section>
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
          <div className="segment-grid">
            {config.segments.map((s, i) => (
              <button key={s.name} onClick={() => discovery('segment', s.name)}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <Building2 className="size-7" />
                <strong>{s.name}</strong>
                <small>{s.note}</small>
                <em>
                  {items.filter((p) => p.segment === s.name).length} produtos{' '}
                  <ArrowRight className="size-4" />
                </em>
              </button>
            ))}
          </div>
          {!config.segments.length && <p>Nenhum segmento cadastrado.</p>}
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
            onSelect={(name) => discovery('brand', name)}
          />
        </section>
      );
    return (
      <section key={block.id} id={`bloco-${block.id}`} className="text-section">
        <span className="eyebrow">{config.name}</span>
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
          {logo}
        </a>
        <nav
          aria-label="Principal"
          className={menuOpen ? 'main-nav is-open' : 'main-nav'}
          onClick={() => setMenuOpen(false)}
        >
          <a href="#catalogo">Catálogo</a>
          {has('segments') && <a href="#segmentos">Segmentos</a>}
          {has('brands') && <a href="#marcas">Marcas</a>}
          <a href="/editor" className="editor-link">
            <Settings2 className="size-4" /> Editor
          </a>
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
      <footer>
        <a href="#inicio" className="brand-lockup">
          {logo}
        </a>
        <p>{config.footer}</p>
        <span>
          © {new Date().getFullYear()} {config.name}
        </span>
      </footer>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="product-dialog" style={style}>
          {selected && (
            <>
              <div className="dialog-product-top">
                {selected.image ? (
                  <img src={selected.image} alt={selected.name} />
                ) : (
                  <div className="missing-image">
                    <Package /> Imagem não cadastrada
                  </div>
                )}
                <div className="dialog-product-info">
                  <DialogHeader>
                    <span className="eyebrow">
                      {selected.brand} · {selected.code}
                    </span>
                    <DialogTitle>{selected.name}</DialogTitle>
                    <DialogDescription>
                      {selected.description ||
                        'Consulte os dados de embalagem e identificação deste produto.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="path-chip">
                    {selected.department} / {selected.section} /{' '}
                    {selected.category}
                  </div>
                  <p className="segment-label">Segmento: {selected.segment}</p>
                  <ul className="spec-list">
                    {selected.specs.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  <dl className="product-specifications">
                    {detailFields
                      .filter(
                        ([key]) =>
                          key !== 'supplier' && selected.details?.[key],
                      )
                      .map(([key, label]) => (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>{selected.details?.[key]}</dd>
                        </div>
                      ))}
                  </dl>
                  {config.email ? (
                    <a
                      className="primary-action"
                      href={`mailto:${config.email}?subject=${encodeURIComponent(`Informações sobre ${selected.name} (${selected.code})`)}`}
                    >
                      Solicitar informações <ArrowRight className="size-4" />
                    </a>
                  ) : (
                    <p className="contact-empty">
                      Contato comercial ainda não cadastrado.
                    </p>
                  )}
                </div>
              </div>
              <div className="similar-block">
                <span className="eyebrow">
                  Mesma seção, categoria ou aplicação
                </span>
                <h3>Itens similares</h3>
                {similar.length ? (
                  <div className="similar-grid">
                    {similar.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        onOpen={setSelected}
                      />
                    ))}
                  </div>
                ) : (
                  <p>Ainda não há itens similares publicados.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
