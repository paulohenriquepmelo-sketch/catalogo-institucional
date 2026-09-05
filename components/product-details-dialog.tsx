'use client';
/* oxlint-disable next/no-img-element -- Display the already optimized uploaded image directly. */
import { ArrowRight, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { detailFields, type Product } from '@/lib/catalog-data';
import { similarProducts } from '@/lib/catalog-discovery';
import type { CSSProperties } from 'react';
import { ProductCard } from './product-card';

export function ProductDetailsDialog({
  selected,
  onSelect,
  items,
  email,
  style,
}: {
  selected: Product | null;
  onSelect: (product: Product | null) => void;
  items: Product[];
  email: string;
  style?: CSSProperties;
}) {
  const similar = selected ? similarProducts(items, selected) : [];
  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onSelect(null)}>
      <DialogContent className="product-dialog" style={style}>
        {selected && (
          <>
            <div className="dialog-product-top">
              <div className="dialog-product-media">
                {selected.image ? (
                  <img src={selected.image} alt={selected.name} />
                ) : (
                  <div className="missing-image">
                    <Package /> Imagem não cadastrada
                  </div>
                )}
              </div>
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
                      ([key]) => key !== 'supplier' && selected.details?.[key],
                    )
                    .map(([key, label]) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd>{selected.details?.[key]}</dd>
                      </div>
                    ))}
                </dl>
                {email ? (
                  <a
                    className="primary-action"
                    href={`mailto:${email}?subject=${encodeURIComponent(`Informações sobre ${selected.name} (${selected.code})`)}`}
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
                    <ProductCard key={p.id} product={p} onOpen={onSelect} />
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
  );
}

