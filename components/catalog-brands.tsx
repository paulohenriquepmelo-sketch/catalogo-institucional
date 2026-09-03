'use client';
import { useState, type CSSProperties } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { CarouselItem } from '@/components/ui/carousel';
import { DiscoveryCarousel } from './discovery-carousel';
import type { Brand } from '@/lib/catalog-config';
import { publishedBrands } from '@/lib/catalog-brands';
import type { Product } from '@/lib/catalog-data';
import { CollectionProducts } from './collection-products';
import { BrandChoice } from './brand-choice';
import { AllBrandsDialog } from './all-brands-dialog';

export function CatalogBrands({
  brands,
  items,
  email,
  style,
}: {
  brands: Brand[];
  items: Product[];
  email: string;
  style?: CSSProperties;
}) {
  const [brand, setBrand] = useState<Brand | null>(null);
  const visibleBrands = publishedBrands(brands);
  const counts = items.reduce<Record<string, number>>((a, p) => {
    a[p.brand] = (a[p.brand] ?? 0) + 1;
    return a;
  }, {});
  const featured = visibleBrands.filter((b) => b.featured);
  return (
    <>
      <Dialog
        open={!!brand}
        onOpenChange={(open) => {
          if (!open) {
            setBrand(null);
          }
        }}
      >
        {!!featured.length && (
          <DiscoveryCarousel kind="brand" count={featured.length}>
            {featured.map((b, i) => (
              <CarouselItem
                key={b.name}
                aria-label={`${i + 1} de ${featured.length}`}
                aria-roledescription="item"
              >
                <BrandChoice
                  brand={b}
                  count={counts[b.name] ?? 0}
                  onSelect={setBrand}
                />
              </CarouselItem>
            ))}
          </DiscoveryCarousel>
        )}
        {!featured.length && (
          <p>
            Nenhuma marca em destaque no momento. Veja todas as marcas abaixo.
          </p>
        )}
        {brand && (
          <CollectionProducts
            key={brand.name}
            kind="brand"
            name={brand.name}
            logo={brand.logo}
            items={items}
            email={email}
            style={style}
          />
        )}
      </Dialog>
      <AllBrandsDialog
        brands={visibleBrands}
        items={items}
        counts={counts}
        email={email}
        style={style}
      />
    </>
  );
}
