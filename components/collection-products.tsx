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
  email,
  style,
}: {
  kind: 'brand' | 'segment';
  name: string;
  logo?: string;
  items: Product[];
  email: string;
  style?: CSSProperties;
}) {
  const [productQuery, setProductQuery] = useState('');
  const [productLimit, setProductLimit] = useState(12);
  const [selected, setSelected] = useState<Product | null>(null);
  const products = useMemo(
    () =>
      discover(items, { ...emptyFilters, [kind]: name, query: productQuery }),
    [items, kind, name, productQuery],
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
