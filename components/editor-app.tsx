'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Blocks, Check, ChevronRight, CircleUserRound, Eye, GripVertical, Image as ImageIcon,
  LayoutDashboard, Loader2, Megaphone, Package, Palette, Plus, Save, Search, Sparkles, Tags, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { classifySegment } from '@/lib/segment-classifier';
import { products as starterProducts, type Product } from '@/lib/catalog-data';

type EditableProduct = Product & { published: boolean };

const navGroups = [
  { label: 'Visão geral', icon: LayoutDashboard },
  { label: 'Produtos', icon: Package, active: true },
  { label: 'Departamentos', icon: Blocks },
  { label: 'Marcas', icon: Tags },
  { label: 'Banners e carrosséis', icon: Megaphone },
  { label: 'Aparência do site', icon: Palette },
];

const emptyProduct: EditableProduct = {
  id: 0, code: '', name: '', description: '', department: 'Mobiliário', section: 'Estar', category: 'Poltronas',
  segment: 'Residencial', brand: 'Forma', image: '', specs: [], published: true,
};

export function EditorApp({ userName }: { userName: string }) {
  const [items, setItems] = useState<EditableProduct[]>(starterProducts.map((item) => ({ ...item, published: true })));
  const [selectedId, setSelectedId] = useState<number>(1);
  const [draft, setDraft] = useState<EditableProduct>({ ...items[0] });
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState<'products' | 'layout'>('products');
  const [blocks, setBlocks] = useState([
    { name: 'Banner principal', detail: 'Carrossel com produtos em destaque', visible: true },
    { name: 'Catálogo', detail: 'Busca, filtros e grade de produtos', visible: true },
    { name: 'Segmentos', detail: 'Classificação automática por aplicação', visible: true },
    { name: 'Marcas parceiras', detail: 'Logos e links para produtos da marca', visible: true },
  ]);

  useEffect(() => {
    fetch('/api/products').then((response) => response.ok ? response.json() : Promise.reject()).then((data: EditableProduct[]) => {
      if (data.length) { setItems(data); setSelectedId(data[0].id); setDraft(data[0]); }
    }).catch(() => undefined);
  }, []);

  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.code} ${item.brand}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const analysis = useMemo(() => classifySegment(draft), [draft]);

  const selectProduct = (product: EditableProduct) => { setSelectedId(product.id); setDraft({ ...product }); setSaved(false); };
  const newProduct = () => { setSelectedId(0); setDraft({ ...emptyProduct }); setSaved(false); };

  const saveProduct = async () => {
    setSaving(true); setSaved(false);
    const payload = { ...draft, segment: analysis.segment };
    try {
      const response = await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const savedProduct = { ...payload, id: result.id ?? draft.id };
      setDraft(savedProduct); setSelectedId(savedProduct.id);
      setItems((current) => current.some((item) => item.id === savedProduct.id) ? current.map((item) => item.id === savedProduct.id ? savedProduct : item) : [savedProduct, ...current]);
      setSaved(true);
    } catch {
      const localId = draft.id || Math.max(0, ...items.map((item) => item.id)) + 1;
      const savedProduct = { ...payload, id: localId };
      setDraft(savedProduct); setSelectedId(localId);
      setItems((current) => current.some((item) => item.id === localId) ? current.map((item) => item.id === localId ? savedProduct : item) : [savedProduct, ...current]);
      setSaved(true);
    } finally { setSaving(false); }
  };

  const uploadImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const preview = URL.createObjectURL(file);
    setDraft((current) => ({ ...current, image: preview }));
    try {
      const form = new FormData(); form.append('file', file);
      const response = await fetch('/api/uploads', { method: 'POST', body: form });
      if (response.ok) { const result = await response.json(); setDraft((current) => ({ ...current, image: result.url })); }
    } finally { setUploading(false); }
  };

  return (
    <main className="editor-shell">
      <aside className="editor-sidebar">
        <a href="/" className="brand-lockup"><span className="brand-mark">N</span><span>NEXO <small>EDITOR</small></span></a>
        <nav>
          <span className="editor-nav-title">Conteúdo</span>
          {navGroups.map(({ label, icon: Icon, active }) => (
            <button key={label} className={(active && view === 'products') || (label === 'Banners e carrosséis' && view === 'layout') ? 'active' : ''} onClick={() => setView(label === 'Banners e carrosséis' || label === 'Aparência do site' ? 'layout' : 'products')}>
              <Icon /> {label} {active && <span>{items.length}</span>}
            </button>
          ))}
        </nav>
        <div className="editor-user"><CircleUserRound /><span><strong>{userName.split('@')[0]}</strong><small>Administrador</small></span></div>
      </aside>

      <section className="editor-workspace">
        <header className="editor-topbar">
          <div><a href="/"><ArrowLeft /> Ver site</a><span>/</span><strong>{view === 'products' ? 'Produtos' : 'Página inicial'}</strong></div>
          <div><span className="online-dot" /> Alterações sincronizadas <Button variant="outline" onClick={() => window.open('/', '_blank')}><Eye /> Pré-visualizar</Button><Button onClick={saveProduct}><Save /> Publicar</Button></div>
        </header>

        {view === 'products' ? (
          <div className="editor-columns">
            <section className="product-list-panel">
              <div className="panel-heading"><div><span className="eyebrow">Catálogo</span><h1>Produtos</h1></div><Button onClick={newProduct}><Plus /> Novo produto</Button></div>
              <label className="editor-search"><Search /><Input placeholder="Buscar por nome, código ou marca" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <div className="product-list-head"><span>{filtered.length} produtos</span><span>Status</span></div>
              <div className="editor-product-list">
                {filtered.map((product) => (
                  <button key={product.id} className={selectedId === product.id ? 'active' : ''} onClick={() => selectProduct(product)}>
                    <img src={product.image} alt="" /><span><strong>{product.name}</strong><small>{product.code} · {product.brand}</small></span>
                    <em className={product.published ? 'published' : ''}>{product.published ? 'Publicado' : 'Rascunho'}</em><ChevronRight />
                  </button>
                ))}
              </div>
            </section>

            <section className="product-form-panel">
              <div className="form-title"><div><span className="eyebrow">{draft.id ? 'Editar item' : 'Novo item'}</span><h2>{draft.name || 'Produto sem título'}</h2></div><label className="publish-toggle"><span>Publicado</span><Switch checked={draft.published} onCheckedChange={(checked) => setDraft({ ...draft, published: checked })} /></label></div>
              <div className="editor-form-grid">
                <label className="wide"><span>Nome do produto</span><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
                <label><span>Código</span><Input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} /></label>
                <label><span>Marca</span><Input value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} /></label>
                <label className="wide"><span>Descrição</span><Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
                <label><span>Departamento</span><Input value={draft.department} onChange={(event) => setDraft({ ...draft, department: event.target.value })} /></label>
                <label><span>Seção</span><Input value={draft.section} onChange={(event) => setDraft({ ...draft, section: event.target.value })} /></label>
                <label><span>Categoria</span><Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
                <div className="ai-segment-card">
                  <span><Sparkles /> Segmento automático</span><strong>{analysis.segment}</strong><small>{analysis.confidence}% de confiança · {analysis.signals.length ? analysis.signals.join(', ') : 'análise inicial'}</small>
                </div>
                <label className="wide"><span>Características técnicas</span><Input value={draft.specs.join(', ')} onChange={(event) => setDraft({ ...draft, specs: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="Separe as características por vírgula" /></label>
              </div>
              <div className="image-editor">
                <div>{draft.image ? <img src={draft.image} alt="Prévia" /> : <ImageIcon />}</div>
                <span><strong>Imagem principal</strong><small>JPG, PNG ou WebP. Recomendado: 1200 × 1200 px.</small><label className="upload-button"><Upload /> {uploading ? 'Enviando...' : 'Substituir imagem'}<input type="file" accept="image/*" hidden onChange={(event) => uploadImage(event.target.files?.[0])} /></label></span>
              </div>
              <div className="form-actions"><span>{saved && <><Check /> Produto salvo e segmento atualizado.</>}</span><Button variant="outline" onClick={() => selectedId && selectProduct(items.find((item) => item.id === selectedId) ?? draft)}>Cancelar</Button><Button onClick={saveProduct} disabled={saving || !draft.name || !draft.code}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Salvar produto</Button></div>
            </section>
          </div>
        ) : (
          <div className="layout-editor">
            <section>
              <span className="eyebrow">Editor visual</span><h1>Estrutura da página</h1><p>Reordene, oculte ou edite os blocos que formam a página pública do catálogo.</p>
              <div className="block-list">{blocks.map((block, index) => <div key={block.name}><GripVertical /><span><strong>{block.name}</strong><small>{block.detail}</small></span><Switch checked={block.visible} onCheckedChange={(checked) => setBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, visible: checked } : item))} /><Button variant="ghost">Editar</Button></div>)}</div>
              <Button variant="outline" className="add-block"><Plus /> Adicionar banner, carrossel ou seção</Button>
            </section>
            <aside className="live-preview"><div className="preview-toolbar"><span /><span /><span /><em>nexocatalogo.sites.app</em></div><div className="preview-canvas"><div className="mini-header">NEXO <span>Catálogo · Segmentos · Marcas</span></div><div className="mini-hero"><strong>Escolhas que<br />transformam espaços.</strong><img src={starterProducts[0].image} alt="" /></div><div className="mini-grid">{starterProducts.slice(0, 3).map((item) => <img key={item.id} src={item.image} alt="" />)}</div></div></aside>
          </div>
        )}
      </section>
    </main>
  );
}
