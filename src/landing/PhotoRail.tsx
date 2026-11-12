import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from '@/components/icons';

export interface RailPhoto {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * The owner's photographs as a horizontal rail: scrolls by touch, wheel and
 * arrow keys, with Previous/Next for a mouse, and opens any photo full size.
 * The controls sit in the section's head row (rendered by the caller through
 * `renderControls`) so they line up with the heading.
 */
export default function PhotoRail({
  photos,
  label,
  renderControls,
}: {
  photos: RailPhoto[];
  label: string;
  renderControls: (controls: JSX.Element) => JSX.Element;
}) {
  const railRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const page = (dir: 1 | -1) => {
    const el = railRef.current;
    const first = el?.querySelector('li');
    if (!el || !first) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * (first.getBoundingClientRect().width + gap), behavior: reduce ? 'auto' : 'smooth' });
  };

  const step = (dir: 1 | -1) =>
    setOpen((i) => (i === null ? i : (i + dir + photos.length) % photos.length));

  const controls = (
    <div className="lp-rail__controls">
      <button
        type="button"
        className="lp-icon-btn"
        onClick={() => page(-1)}
        disabled={atStart}
        aria-label="Previous photos"
      >
        <ChevronLeft aria-hidden />
      </button>
      <button
        type="button"
        className="lp-icon-btn"
        onClick={() => page(1)}
        disabled={atEnd}
        aria-label="Next photos"
      >
        <ChevronRight aria-hidden />
      </button>
    </div>
  );

  const current = open === null ? null : photos[open];

  return (
    <>
      {renderControls(controls)}
      <div className="lp-rail-wrap">
        <ul ref={railRef} className="lp-rail" tabIndex={0} aria-label={label}>
          {photos.map((p, i) => {
            const tall = p.height > p.width;
            return (
              <li key={p.src}>
                <button
                  type="button"
                  className={`lp-rail__photo${tall ? ' lp-rail__photo--tall' : ''}`}
                  data-slot={`day-${i + 1}`}
                  data-alt={p.alt}
                  onClick={() => setOpen(i)}
                  aria-label={`View larger: ${p.alt}`}
                >
                  <img
                    src={p.src}
                    width={p.width}
                    height={p.height}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Dialog.Root open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="lp lp-viewer__overlay" />
          <Dialog.Content
            className="lp lp-night lp-viewer"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') step(1);
              if (e.key === 'ArrowLeft') step(-1);
            }}
            aria-describedby={undefined}
          >
            {current && (
              <>
                <Dialog.Title className="visually-hidden">{current.alt}</Dialog.Title>
                <figure className="lp-viewer__figure">
                  <img src={current.src} width={current.width} height={current.height} alt={current.alt} />
                  <figcaption className="lp-viewer__caption">
                    <span>{current.alt}</span>
                    <span className="num">
                      {open! + 1} of {photos.length}
                    </span>
                  </figcaption>
                </figure>
                <div className="lp-viewer__bar">
                  <button type="button" className="lp-icon-btn" onClick={() => step(-1)} aria-label="Previous photo">
                    <ChevronLeft aria-hidden />
                  </button>
                  <button type="button" className="lp-icon-btn" onClick={() => step(1)} aria-label="Next photo">
                    <ChevronRight aria-hidden />
                  </button>
                  <Dialog.Close className="lp-icon-btn" aria-label="Close">
                    <X aria-hidden />
                  </Dialog.Close>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
