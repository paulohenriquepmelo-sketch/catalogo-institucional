'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, ChevronDown, LayoutGrid, Menu, Search, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Product, products, segments } from '@/lib/catalog-data';

const departments = ['Todos', 'Mobiliário', 'Iluminação'];

function ProductCard({ product, onOpen }: { product: Product; onOpen: (product: Product) => void }) {
  return (
    <button className="product-card group" onClick={() => onOpen(product)}>
      <span className="product-image-wrap">
        <img src={product.image} alt={product.name} className="product-image" />
        <span className="product-code">{product.code}</span>
      </span>
      <span className="product-copy">
        <span><span className="product-brand">{product.brand}</span><span className="product-name">{product.name}</span></span>
        <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
      </span>
      <span className="product-path">{product.section} · {product.category}</span>
    </button>
  );
}

export function CatalogApp() {
  const [query, setQuery] = useState('');
  const [activeDepartment, setActiveDepartment] = useState('Todos');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<Product[]>(products);

  useEffect(() => {
    fetch('/api/products')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: Array<Product & { published?: boolean }>) => setCatalogItems(data.filter((item) => item.published !== false)))
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return catalogItems.filter((product) => {
      const matchesDepartment = activeDepartment === 'Todos' || product.department === activeDepartment;
      const haystack = `${product.name} ${product.brand} ${product.category} ${product.segment}`.toLowerCase();
      return matchesDepartment && (!normalized || haystack.includes(normalized));
    });
  }, [query, activeDepartment, catalogItems]);

  const similar = selectedProduct
    ? catalogItems.filter((item) => item.id !== selectedProduct.id && (item.category === selectedProduct.category || item.segment === selectedProduct.segment)).slice(0, 3)
    : [];

  const applyDiscovery = (value: string) => {
    setActiveDepartment('Todos');
    setQuery(value);
    document.querySelector('#catalogo')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="announcement"><span>Catálogo institucional 2026</span><span className="announcement-rule" /><span>Curadoria para projetos que permanecem</span></div>

      <header className="site-header">
        <a href="#inicio" className="brand-lockup" aria-label="Nexo catálogo — início"><span className="brand-mark">N</span><span>NEXO <small>CATÁLOGO</small></span></a>
        <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'}>
          <a href="#catalogo">Catálogo</a><a href="#segmentos">Segmentos</a><a href="#marcas">Marcas</a>
          <a href="/editor" className="editor-link"><Sparkles className="size-4" /> Editor</a>
        </nav>
        <Button variant="ghost" size="icon" className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">{menuOpen ? <X /> : <Menu />}</Button>
      </header>

      <section id="inicio" className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">Design, função e identidade</span>
          <h1>Escolhas que<br /><em>transformam</em> espaços.</h1>
          <p>Explore uma curadoria completa de produtos para projetos corporativos, residenciais e de hospitalidade.</p>
          <div className="hero-actions"><a href="#catalogo" className="primary-action">Explorar catálogo <ArrowRight className="size-4" /></a><span>{catalogItems.length} produtos · {new Set(catalogItems.map((item) => item.brand)).size} marcas</span></div>
        </div>
        <div className="hero-art">
          <img src={catalogItems[0]?.image ?? products[0].image} alt="Cadeira de design em ambiente contemporâneo" />
          <div className="hero-card"><span>Em destaque</span><strong>{catalogItems[0]?.name ?? 'Cadeira Aurora'}</strong><button onClick={() => setSelectedProduct(catalogItems[0] ?? products[0])}>Ver detalhes <ArrowRight className="size-4" /></button></div>
          <div className="hero-index">01 / 06</div>
        </div>
      </section>

      <section id="catalogo" className="catalog-section">
        <div className="section-heading">
          <div><span className="eyebrow">Catálogo completo</span><h2>Encontre o produto certo.</h2></div>
          <p>Navegue por departamento, refine sua busca e encontre informações detalhadas em poucos cliques.</p>
        </div>
        <div className="catalog-toolbar">
          <label className="search-field"><Search className="size-5" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto, marca ou segmento..." /></label>
          <div className="category-tabs" aria-label="Filtrar por departamento">
            {departments.map((department) => <button key={department} className={activeDepartment === department ? 'active' : ''} onClick={() => setActiveDepartment(department)}>{department}</button>)}
          </div>
          <Button variant="outline" className="filter-button"><LayoutGrid /> Departamento <ChevronDown /></Button>
        </div>
        <div className="result-line"><span>{filtered.length} itens encontrados</span><span>Ordenar: Destaques <ChevronDown className="size-4" /></span></div>
        <div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} onOpen={setSelectedProduct} />)}</div>
        {filtered.length === 0 && <div className="empty-state">Nenhum item encontrado. Tente outro termo ou departamento.</div>}
      </section>

      <section id="segmentos" className="segments-section">
        <div className="section-heading light">
          <div><span className="eyebrow">Seleção inteligente</span><h2>Produtos por segmento.</h2></div>
          <p>Nossa classificação analisa características, aplicações e contexto de uso para agrupar automaticamente cada produto.</p>
        </div>
        <div className="segment-grid">
          {segments.map((segment, index) => (
            <button key={segment.name} onClick={() => applyDiscovery(segment.name)}><span>0{index + 1}</span><Building2 className="size-7" /><strong>{segment.name}</strong><small>{segment.note}</small><em>{catalogItems.filter((item) => item.segment === segment.name).length} produtos <ArrowRight className="size-4" /></em></button>
          ))}
        </div>
      </section>

      <section id="marcas" className="brands-section">
        <span className="eyebrow">Marcas parceiras</span>
        <div className="brand-row">{['LINEA', 'FORMA', 'NORD', 'VÉRTICE', 'CASA 27', 'ATELIÊ'].map((brand) => <button key={brand} onClick={() => applyDiscovery(brand)}>{brand}</button>)}</div>
      </section>

      <footer><div className="brand-lockup"><span className="brand-mark">N</span><span>NEXO <small>CATÁLOGO</small></span></div><p>Uma plataforma institucional para apresentar produtos, marcas e soluções com clareza.</p><span>© 2026 Nexo Catálogo</span></footer>

      <Dialog open={Boolean(selectedProduct)} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="product-dialog">
          {selectedProduct && <>
            <div className="dialog-product-top">
              <img src={selectedProduct.image} alt={selectedProduct.name} />
              <div className="dialog-product-info">
                <DialogHeader><span className="eyebrow">{selectedProduct.brand} · {selectedProduct.code}</span><DialogTitle>{selectedProduct.name}</DialogTitle><DialogDescription>{selectedProduct.description}</DialogDescription></DialogHeader>
                <div className="path-chip">{selectedProduct.department} / {selectedProduct.section} / {selectedProduct.category}</div>
                <dl>{selectedProduct.specs.map((spec) => <div key={spec}><dt>•</dt><dd>{spec}</dd></div>)}</dl>
                <Button className="dialog-cta">Solicitar informações <ArrowRight /></Button>
              </div>
            </div>
            <div className="similar-block">
              <div><span className="eyebrow">Você também pode gostar</span><h3>Itens similares</h3></div>
              <div className="similar-grid">{(similar.length > 0 ? similar : catalogItems.filter((item) => item.id !== selectedProduct.id).slice(0, 3)).map((item) => <ProductCard key={item.id} product={item} onOpen={setSelectedProduct} />)}</div>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
