'use client';
/* oxlint-disable next/no-img-element -- Exact campaign artwork is served directly, without an image optimizer. */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import {
  campaignSlides,
  campaignThemes,
  type CatalogCampaign as Campaign,
} from '@/lib/catalog-campaign';

export function CatalogCampaign({
  campaign,
  intro,
  children,
  preview = false,
}: {
  campaign: Campaign;
  intro: ReactNode;
  children?: ReactNode;
  preview?: boolean;
}) {
  const slides = campaignSlides(campaign);
  const theme =
    campaignThemes.find((p) => p.id === campaign.theme) ?? campaignThemes[0];
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(true);
  const visible = campaign.enabled && slides.some((slide) => slide.image);
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
      !visible ||
      !campaign.autoplay ||
      slides.length < 2 ||
      paused ||
      hover ||
      reduced ||
      preview
    )
      return;
    const timer = window.setInterval(
      () => {
        if (document.visibilityState === 'visible') api.scrollNext();
      },
      Math.max(3, campaign.interval) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [
    api,
    visible,
    campaign.autoplay,
    campaign.interval,
    slides.length,
    paused,
    hover,
    reduced,
    preview,
  ]);
  const current = Math.min(index, Math.max(0, slides.length - 1));
  const active = slides[current];
  const style = {
    '--campaign-ink': theme.ink,
    '--campaign-canvas': theme.background,
    '--campaign-overlay': campaign.overlay / 100,
    '--campaign-position': campaign.position,
  } as CSSProperties;
  return (
    <div
      id={preview ? undefined : 'catalogo'}
      className={`campaign-surface ${visible && campaign.scope === 'catalog' ? 'campaign-extends' : ''} ${preview ? 'campaign-preview' : ''}`}
      style={style}
    >
      {visible && campaign.scope === 'catalog' && active?.image && (
        <div
          className="campaign-page-art"
          aria-hidden="true"
          style={{ backgroundImage: `url(${JSON.stringify(active.image)})` }}
        />
      )}
      <div
        className={`campaign-intro-band ${visible ? 'has-background' : ''}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocusCapture={() => setPaused(true)}
      >
        {visible && (
          <>
            <Carousel
              key={`${campaign.theme}-${campaign.mode}`}
              className="campaign-background-carousel"
              setApi={setApi}
              opts={{
                loop: slides.length > 1,
                duration: reduced ? 0 : 35,
                watchDrag: false,
              }}
              aria-hidden="true"
            >
              <CarouselContent className="campaign-track">
                {slides.map((slide, i) => (
                  <CarouselItem className="campaign-item" key={slide.id}>
                    <img
                      className="campaign-image"
                      src={slide.image}
                      alt=""
                      loading={i === 0 ? 'eager' : 'lazy'}
                      fetchPriority={i === 0 && !preview ? 'high' : 'auto'}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
            <div className="campaign-overlay" aria-hidden="true" />
          </>
        )}
        {/* The real catalog controls stay mounted once while only the art changes. */}
        <div className="campaign-intro-content">{intro}</div>
        {visible && slides.length > 1 && (
          <div className="campaign-controls">
            <span aria-live={paused ? 'polite' : 'off'}>
              {String(current + 1).padStart(2, '0')} /{' '}
              {String(slides.length).padStart(2, '0')}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Fundo anterior"
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
              aria-label="Próximo fundo"
              onClick={() => {
                setPaused(true);
                api?.scrollNext();
              }}
            >
              <ArrowRight />
            </Button>
            {campaign.autoplay && !reduced && !preview && (
              <Button
                variant="outline"
                size="icon"
                aria-label={
                  paused
                    ? 'Retomar carrossel de fundo'
                    : 'Pausar carrossel de fundo'
                }
                onClick={() => setPaused(!paused)}
              >
                {paused ? <Play /> : <Pause />}
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="campaign-catalog-content">{children}</div>
    </div>
  );
}
