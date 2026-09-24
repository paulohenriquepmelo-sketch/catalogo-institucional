'use client';
import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { CarouselItem } from '@/components/ui/carousel';
import { DiscoveryCarousel } from './discovery-carousel';
import { CollectionProducts } from './collection-products';
import { segmentIconById } from '@/lib/segment-icons';
import type { Product } from '@/lib/catalog-data';
import { buildSegments, type Segment } from '@/lib/segments';

/**
 * Segmentos de clientes com as mesmas regras do app mobile: um produto pode
 * estar em vários segmentos, e cada segmento é dividido em grupos (insumos,
 * embalagens, revenda...). Calculado no navegador a partir dos produtos
 * publicados — nenhuma consulta extra ao servidor.
 */
export function CatalogSegments({
  items,
  email,
  style,
}: {
  items: Product[];
  email: string;
  style?: CSSProperties;
}) {
  const segments = useMemo(
    () => buildSegments(items).filter((s) => !s.rule.hidden && s.products.length > 0),
    [items],
  );
  const [segment, setSegment] = useState<Segment | null>(null);
  return (
    <Dialog open={!!segment} onOpenChange={(open) => !open && setSegment(null)}>
      {!!segments.length && (
        <DiscoveryCarousel kind="segment" count={segments.length}>
          {segments.map((s, i) => {
            const Icon = segmentIconById(s.rule.icon, s.rule.name);
            return (
              <CarouselItem
                key={s.rule.id}
                aria-label={`${i + 1} de ${segments.length}`}
                aria-roledescription="item"
              >
                <DialogTrigger
                  aria-label={`Ver produtos do segmento ${s.rule.name}`}
                  onClick={() => setSegment(s)}
                >
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <Icon className="size-8" aria-hidden="true" />
                  <strong>{s.rule.name}</strong>
                  <small>{s.rule.note}</small>
                  <em>
                    {s.products.length} produtos{' '}
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
          key={segment.rule.id}
          kind="segment"
          name={segment.rule.name}
          items={items}
          groups={segment.groups}
          email={email}
          style={style}
        />
      )}
    </Dialog>
  );
}
