'use client';
import { useEffect, useState, type FocusEvent, type ReactNode } from 'react';
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';

export function DiscoveryCarousel({
  kind,
  count,
  children,
}: {
  kind: 'segment' | 'brand';
  count: number;
  children: ReactNode;
}) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!api || reducedMotion || interacting || count < 2) return;
    const timer = window.setInterval(() => api.scrollNext(), 4500);
    return () => window.clearInterval(timer);
  }, [api, count, interacting, reducedMotion]);
  const label = kind === 'segment' ? 'segmentos' : 'marcas';
  const leaveFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget))
      setInteracting(false);
  };
  return (
    <Carousel
      className={`discovery-carousel ${kind}-carousel`}
      aria-label={`Carrossel de ${label}`}
      aria-roledescription="carrossel"
      setApi={setApi}
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={leaveFocus}
      onPointerDown={() => setInteracting(true)}
      onPointerUp={() => setInteracting(false)}
      opts={{
        align: 'start',
        slidesToScroll: 'auto',
        loop: count > 1,
        duration: reducedMotion ? 0 : 25,
      }}
    >
      <div className="discovery-carousel-toolbar">
        <span>
          {count} {label} · Arraste ou use as setas
        </span>
        <div className="discovery-carousel-controls">
          <CarouselPrevious aria-label={`Voltar ${label}`} />
          <CarouselNext aria-label={`Avançar ${label}`} />
        </div>
      </div>
      <CarouselContent
        className={kind === 'segment' ? 'segment-grid' : 'brand-row'}
      >
        {children}
      </CarouselContent>
    </Carousel>
  );
}
