'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import type { CatalogConfig } from '@/lib/catalog-config';

export function CatalogBanners({
  config,
  title,
}: {
  config: CatalogConfig;
  title: string;
}) {
  const banners = config.banners.filter((b) => b.visible);
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!api) return;
    const update = () => setIndex(api.selectedScrollSnap());
    update();
    api.on('select', update);
    api.on('reInit', update);
    return () => {
      api.off('select', update);
      api.off('reInit', update);
    };
  }, [api]);
  useEffect(() => {
    if (
      !api ||
      !config.autoplay ||
      paused ||
      hover ||
      reduced ||
      banners.length < 2
    )
      return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') api.scrollNext();
    }, config.interval * 1000);
    return () => window.clearInterval(timer);
  }, [
    api,
    config.autoplay,
    config.interval,
    paused,
    hover,
    reduced,
    banners.length,
  ]);
  if (!banners.length) return null;
  return (
    <section className="banner-section" id="destaques">
      <Carousel
        setApi={setApi}
        opts={{ loop: true, duration: reduced ? 0 : 25 }}
        aria-label={title}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocusCapture={() => setPaused(true)}
      >
        <CarouselContent>
          {banners.map((b, i) => (
            <CarouselItem
              key={b.id}
              aria-label={`${i + 1} de ${banners.length}`}
              aria-hidden={i !== index}
            >
              <article className="banner-slide">
                <div className="banner-copy">
                  <span className="eyebrow">{title}</span>
                  <h2>{b.title}</h2>
                  <p>{b.description}</p>
                  <a
                    className="primary-action"
                    href={b.link}
                    tabIndex={i === index ? 0 : -1}
                  >
                    Explorar seleção <ArrowRight className="size-4" />
                  </a>
                </div>
                <div className="banner-image">
                  {b.image ? (
                    <img src={b.image} alt="" loading="lazy" />
                  ) : (
                    <span>Imagem não cadastrada</span>
                  )}
                </div>
              </article>
            </CarouselItem>
          ))}
        </CarouselContent>
        {banners.length > 1 && (
          <div className="banner-controls">
            <span aria-live={paused ? 'polite' : 'off'}>
              {String(index + 1).padStart(2, '0')} /{' '}
              {String(banners.length).padStart(2, '0')}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Banner anterior"
              onClick={() => {
                setPaused(true);
                api?.scrollPrev();
              }}
            >
              <ArrowLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próximo banner"
              onClick={() => {
                setPaused(true);
                api?.scrollNext();
              }}
            >
              <ArrowRight />
            </Button>
            {config.autoplay && !reduced && (
              <Button
                variant="outline"
                size="icon"
                aria-label={paused ? 'Retomar animação' : 'Pausar animação'}
                onClick={() => setPaused(!paused)}
              >
                {paused ? <Play /> : <Pause />}
              </Button>
            )}
          </div>
        )}
      </Carousel>
    </section>
  );
}
