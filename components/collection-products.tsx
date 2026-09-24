'use client';
/* oxlint-disable next/no-img-element -- Logos are uploaded as optimized images. */
import { useMemo, useState, type CSSProperties } from 'react';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { discover, emptyFilters } from '@/lib/catalog-discovery';
import type { Product } from '@/lib/catalog-data';
import { ProductCard } from './product-card';
import { ProductDetailsDialog } from './product-details-dialog';
export function CollectionProducts({
  kind,
  name,
  logo,
  items,
  groups,
  email,
  style,
}: {
  kind: 'brand' | 'segment';
  name: string;
  logo?: string;
  items: Product[];
  /**
   * Segmentos: os produtos já vêm separados por grupo (insumos, embalagens,
   * revenda...). Sem grupos, a lista é filtrada pelo campo `kind` do produto.
   */
  groups?: { name: string; products: Product[] }[];
  email: string;
  style?: CSSProperties;
}) {
  const [productQuery, setProductQuery] = useState('');
  const [productLimit, setProductLimit] = useState(12);
  const [selected, setSelected] = useState<Product | null>(null);
  const [groupIndex, setGroupIndex] = useState(-1);
  // "Todos": cada produto uma vez só, na ordem dos grupos.
  const allGroupProducts = useMemo(() => {
    if (!groups) return null;
    const seen = new Set<number>();
    return groups.flatMap((g) => g.products).filter((p) => !seen.has(p.id) && seen.add(p.id));
  }, [groups]);
  const groupProducts = useMemo(
    () =>
      groups && groupIndex >= 0 ? (groups[groupIndex]?.products ?? []) : allGroupProducts,
    [groups, groupIndex, allGroupProducts],
  );
  const products = useMemo(
    () =>
      groupProducts
        ? discover(groupProducts, { ...emptyFilters, query: productQuery })
        : discover(items, { ...emptyFilters, [kind]: name, query: productQuery }),
    [groupProducts, items, kind, name, productQuery],
  );
  return (
    <DialogContent className="brand-products-dialog" style={style}>
      <DialogHeader className="brand-products-heading">
        {logo && <img src={logo} alt="" />}
        <div>
          <span className="eyebrow">
            {kind === 'brand' ? 'Produtos da marca' : 'Produtos do segmento'}
          </span>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>
            Explore os produtos e clique em um item para ver os detalhes.
          </DialogDescription>
        </div>
      </DialogHeader>
      {groups && groups.length > 0 && (
        <div className="segment-group-chips" role="tablist" aria-label="Grupos do segmento">
          {[
            { name: 'Todos', count: allGroupProducts?.length ?? 0 },
            ...groups.map((g) => ({ name: g.name, count: g.products.length })),
          ].map(
            (chip, i) => {
              const index = i - 1;
              const active = index === groupIndex;
              return (
                <button
                  key={chip.name}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? 'active' : undefined}
                  onClick={() => {
                    setGroupIndex(index);
                    setProductLimit(12);
                  }}
                >
                  {chip.name} ({chip.count})
                </button>
              );
            },
          )}
        </div>
      )}
      <div className="brand-products-toolbar">
        <Input
          aria-label={
            kind === 'brand'
              ? 'Buscar produtos desta marca'
              : 'Buscar produtos deste segmento'
          }
          placeholder="Buscar por nome, código ou característica…"
          value={productQuery}
          onChange={(e) => {
            setProductQuery(e.target.value);
            setProductLimit(12);
          }}
        />
        <output>
          {products.length}{' '}
          {products.length === 1
            ? 'produto encontrado'
            : 'produtos encontrados'}
        </output>
      </div>
      <div className="brand-products-results">
        <div className="product-grid">
          {products.slice(0, productLimit).map((p) => (
            <ProductCard key={p.id} product={p} onOpen={setSelected} />
          ))}
        </div>
        {!products.length && (
          <div className="empty-state">
            <h3>
              {productQuery
                ? 'Nenhum produto com essa busca.'
                : 'Ainda não há produtos publicados nesta seleção.'}
            </h3>
            {productQuery && (
              <Button variant="outline" onClick={() => setProductQuery('')}>
                Limpar busca
              </Button>
            )}
          </div>
        )}
        {products.length > productLimit && (
          <div className="load-more">
            <Button
              variant="outline"
              onClick={() => setProductLimit((n) => n + 12)}
            >
              Mostrar mais produtos ({products.length - productLimit})
            </Button>
          </div>
        )}
      </div>
      <ProductDetailsDialog
        selected={selected}
        onSelect={setSelected}
        items={items}
        email={email}
        style={style}
      />
    </DialogContent>
  );
}
