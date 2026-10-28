'use client';
/* oxlint-disable next/no-img-element -- Encartes vêm do mesmo pipeline de upload WebP do editor. */
import { useEffect, useMemo, useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { activePopupSlides, type PromoPopup } from '@/lib/catalog-config';
import { catalogDateKey } from '@/lib/catalog-data';

// Uma vez por visita: a chave muda quando os encartes ou a vigência mudam,
// então uma campanha nova aparece de novo para quem já fechou a anterior.
function seenKey(popup: PromoPopup) {
  const text = [popup.startsAt, popup.endsAt, ...popup.slides.map((s) => s.image)].join('|');
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return `promo-popup:${hash}`;
}
function wasSeen(key: string) {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function markSeen(key: string) {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    /* sem armazenamento: o popup pode voltar na próxima página */
  }
}

export function PromoPopupDialog({ popup }: { popup?: PromoPopup }) {
  const slides = useMemo(
    () => (popup ? activePopupSlides(popup, catalogDateKey()) : []),
    [popup],
  );
  const key = popup ? seenKey(popup) : '';
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // sessionStorage só existe no navegador; abre depois da primeira pintura.
  useEffect(() => {
    if (!slides.length || wasSeen(key)) return;
    const frame = requestAnimationFrame(() => {
      setIndex(0);
      setOpen(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [slides.length, key]);

  const count = slides.length;
  const seconds = popup?.interval ?? 4;
  useEffect(() => {
    if (!open || paused || count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), seconds * 1000);
    return () => clearInterval(timer);
  }, [open, paused, count, seconds]);

  if (!count) return null;
  const close = () => {
    markSeen(key);
    setOpen(false);
  };
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);
  const active = Math.min(index, count - 1);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="promo-popup-backdrop" />
        <DialogPrimitive.Popup
          className="promo-popup"
          // O popup recebe o foco ao abrir; pausar no foco travaria o giro.
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <DialogPrimitive.Title className="sr-only">Encartes em destaque</DialogPrimitive.Title>
          <DialogPrimitive.Close className="promo-popup-close" aria-label="Fechar encartes">
            <X aria-hidden="true" />
          </DialogPrimitive.Close>
          <div className="promo-popup-stage" aria-roledescription="carrossel" aria-label="Encartes">
            {slides.map((slide, i) => (
              <img
                key={slide.id}
                src={slide.image}
                alt={slide.alt || `Encarte ${i + 1} de ${count}`}
                className={i === active ? 'is-active' : undefined}
                aria-hidden={i !== active}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
            ))}
            {count > 1 && (
              <>
                <button type="button" className="promo-popup-arrow is-prev" aria-label="Encarte anterior" onClick={() => go(-1)}>
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button type="button" className="promo-popup-arrow is-next" aria-label="Próximo encarte" onClick={() => go(1)}>
                  <ChevronRight aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <div className="promo-popup-footer">
            {count > 1 && (
              <div className="promo-popup-dots">
                {slides.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    aria-label={`Ver encarte ${i + 1} de ${count}`}
                    aria-current={i === active}
                    onClick={() => setIndex(i)}
                  />
                ))}
              </div>
            )}
            <button type="button" className="promo-popup-cta" onClick={close}>
              Ver o catálogo <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
