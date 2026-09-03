'use client';
import { useState, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { CarouselItem } from '@/components/ui/carousel';
import { DiscoveryCarousel } from './discovery-carousel';
import { CollectionProducts } from './collection-products';
import { segmentIcon } from '@/lib/segment-icons';
import type { Product } from '@/lib/catalog-data';
import type { SegmentRule } from '@/lib/catalog-config';
export function CatalogSegments({
  segments,
  items,
  email,
  style,
}: {
  segments: SegmentRule[];
  items: Product[];
  email: string;
  style?: CSSProperties;
}) {
  const [segment, setSegment] = useState<SegmentRule | null>(null);
  const counts = items.reduce<Record<string, number>>((result, p) => {
    result[p.segment] = (result[p.segment] ?? 0) + 1;
    return result;
  }, {});
  return (
    <Dialog open={!!segment} onOpenChange={(open) => !open && setSegment(null)}>
      {!!segments.length && (
        <DiscoveryCarousel kind="segment" count={segments.length}>
          {segments.map((s, i) => {
            const Icon = segmentIcon(s.name);
            return (
              <CarouselItem
                key={s.name}
                aria-label={`${i + 1} de ${segments.length}`}
                aria-roledescription="item"
              >
                <DialogTrigger
                  aria-label={`Ver produtos do segmento ${s.name}`}
                  onClick={() => setSegment(s)}
                >
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <Icon className="size-8" aria-hidden="true" />
                  <strong>{s.name}</strong>
                  <small>{s.note}</small>
                  <em>
                    {counts[s.name] ?? 0} produtos{' '}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </em>
                </DialogTrigger>
              </CarouselItem>
            );
          })}
        </DiscoveryCarousel>
      )}
      {!segments.length && <p>Nenhum segmento cadastrado.</p>}
      {segment && (
        <CollectionProducts
          key={segment.name}
          kind="segment"
          name={segment.name}
          items={items}
          email={email}
          style={style}
        />
      )}
    </Dialog>
  );
}
