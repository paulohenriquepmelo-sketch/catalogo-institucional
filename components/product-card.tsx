'use client';
/* oxlint-disable next/no-img-element -- Uploaded images are already optimized to WebP before storage. */
import { Package } from 'lucide-react';
import type { Product } from '@/lib/catalog-data';
export function ProductCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (product: Product) => void;
}) {
  const unit =
    product.details?.salesUnitDescription || product.details?.salesUnit;
  return (
    <button
      type="button"
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
        {product.featured && <span className="featured-badge">Destaque</span>}
      </span>
      <span className="product-card-body">
        <span className="product-brand">{product.brand}</span>
        <span className="product-name">{product.name}</span>
        <span className="product-card-meta">
          <span>Código {product.code}</span>
          {unit && <span>Unidade: {unit}</span>}
          {product.details?.packaging && (
            <span>Embalagem: {product.details.packaging}</span>
          )}
        </span>
      </span>
    </button>
  );
}
