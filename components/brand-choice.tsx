'use client';
/* oxlint-disable next/no-img-element -- Logos use existing optimized uploads. */
import { Star } from 'lucide-react';
import { DialogTrigger } from '@/components/ui/dialog';
import type { Brand } from '@/lib/catalog-config';

export function BrandChoice({
  brand,
  count,
  onSelect,
}: {
  brand: Brand;
  count: number;
  onSelect: (brand: Brand) => void;
}) {
  return (
    <DialogTrigger
      aria-label={`Ver produtos da marca ${brand.name}`}
      className={brand.featured ? 'is-featured-brand' : undefined}
      onClick={() => onSelect(brand)}
    >
      {brand.logo ? (
        <img src={brand.logo} alt={brand.name} loading="lazy" />
      ) : (
        <strong>{brand.name}</strong>
      )}
      <small>{count} produtos</small>
      {brand.featured && (
        <span className="brand-featured-label">
          <Star aria-hidden="true" /> Destaque
        </span>
      )}
    </DialogTrigger>
  );
}
