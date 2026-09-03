'use client';
/* oxlint-disable next/no-img-element -- Product uploads are already optimized to WebP by the catalog pipeline. */
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, Pause, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import type { Product } from '@/lib/catalog-data';
import type { ProductShowcase } from '@/lib/catalog-config';
import { ProductCard } from './product-card';

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function offerTimeLabel(end: string, now: number) {
  const endTime = new Date(`${end}T23:59:59`).getTime();
  const minutes = Math.max(0, Math.floor((endTime - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `Encerra em ${days}d ${hours}h`;
  return `Encerra em ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function ProductShowcaseCarousel({
  kind,
  settings,
  items,
  onOpen,
}: {
  kind: 'offers' | 'new-products';
  settings: ProductShowcase;
  items: Product[];
  onOpen: (product: Product) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [now, setNow] = useState(0);
  const [today, setToday] = useState('');
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const update = () => {
      const time = Date.now();
      setNow(time);
      setToday(localDateKey(new Date(time)));
    };
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (
      !api ||
      !settings.autoplay ||
      paused ||
      interacting ||
      reduced ||
      items.length < 2
    )
      return;
    const timer = window.setInterval(
      () => api.scrollNext(),
      settings.interval * 1000,
    );
    return () => window.clearInterval(timer);
  }, [api, interacting, items.length, paused, reduced, settings]);
  const visible = useMemo(() => {
    if (!settings.published) return [];
    if (kind === 'offers') {
      return items
        .filter((product) => {
          const offer = product.details?.offer;
          return (
            offer?.enabled === true &&
            offer.startsAt <= today &&
            offer.endsAt >= today
          );
        })
        .slice(0, settings.limit);
    }
    const earliest = now - (settings.days ?? 30) * 86_400_000;
    return [...items]
      .filter((product) => {
        if (product.details?.showAsNew === true) return true;
        if (product.details?.showAsNew === false) return false;
        const created = Date.parse(product.createdAt ?? '');
        return Number.isFinite(created) && created >= earliest;
      })
      .sort(
        (a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''),
      )
      .slice(0, settings.limit);
  }, [items, kind, now, settings, today]);
  if (!visible.length) return null;
  const isOffer = kind === 'offers';
  const label = isOffer ? 'ofertas' : 'novidades';
  return (
    <section className={`product-showcase ${kind}-showcase`}>
      <Carousel
        setApi={setApi}
        opts={{
          align: 'start',
          loop: visible.length > 1,
          duration: reduced ? 0 : 25,
        }}
        onMouseEnter={() => setInteracting(true)}
        onMouseLeave={() => setInteracting(false)}
        onPointerDown={() => setInteracting(true)}
        onPointerUp={() => setInteracting(false)}
        aria-label={`Carrossel de ${label}`}
      >
        <div className="product-showcase-heading">
          <div>
            <span className="eyebrow">{settings.eyebrow}</span>
            <h2>{settings.title}</h2>
          </div>
          <div className="showcase-controls">
            {settings.autoplay && !reduced && visible.length > 1 && (
              <Button
                variant="outline"
                size="icon"
                aria-label={paused ? `Continuar ${label}` : `Pausar ${label}`}
                onClick={() => setPaused((value) => !value)}
              >
                {paused ? <Play /> : <Pause />}
              </Button>
            )}
            <CarouselPrevious aria-label={`Voltar ${label}`} />
            <CarouselNext aria-label={`Avançar ${label}`} />
          </div>
        </div>
        <CarouselContent
          className={
            settings.layout === 'banner'
              ? 'showcase-banner-track'
              : 'showcase-card-track'
          }
        >
          {visible.map((product, index) => (
            <CarouselItem
              key={product.id}
              aria-label={`${index + 1} de ${visible.length}`}
            >
              {isOffer ? (
                <button className="offer-card" onClick={() => onOpen(product)}>
                  <span className="offer-discount">
                    {product.details!.offer!.discount}% OFF
                  </span>
                  <strong>{product.name}</strong>
                  <div className="offer-product-image">
                    {product.image ? (
                      <img src={product.image} alt="" loading="lazy" />
                    ) : (
                      <Sparkles />
                    )}
                  </div>
                  <span className="offer-expiry">
                    <Clock3 aria-hidden="true" />
                    {offerTimeLabel(product.details!.offer!.endsAt, now)}
                  </span>
                  <span className="offer-action">
                    Ver produto <ArrowRight />
                  </span>
                </button>
              ) : (
                <div className="new-product-card">
                  <span className="new-product-badge">NOVO</span>
                  <ProductCard product={product} onOpen={onOpen} />
                </div>
              )}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}
