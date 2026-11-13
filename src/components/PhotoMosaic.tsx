import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/** The downloaded event photos, grouped sequentially into sets of
 * [large tile, top-right tile, bottom-right tile] so the rotation works
 * through the gallery rather than a small curated handful. Left out, at the
 * owner's request: two leaderboard screenshots (photos 32 and 33), and the
 * award photos (21 and 34), since the Summit is not a competition. */
const GALLERY_COUNT = 36;
const LEFT_OUT = new Set([21, 32, 33, 34]);
const PHOTOS = Array.from({ length: GALLERY_COUNT }, (_, i) => i + 1)
  .filter((n) => !LEFT_OUT.has(n))
  .map((n) => `/gallery/photo-${String(n).padStart(2, '0')}.jpg`);
const PHOTO_SETS: [string, string, string][] = Array.from(
  { length: Math.floor(PHOTOS.length / 3) },
  (_, i) => [PHOTOS[i * 3], PHOTOS[i * 3 + 1], PHOTOS[i * 3 + 2]],
);

const ROTATE_MS = 4500;

function Tile({ src, className }: { src: string; className: string }) {
  return (
    <div className={`lp-mosaic__tile ${className}`} data-slot="mosaic" data-alt="A photograph from the last Summit">
      <AnimatePresence initial={false}>
        <motion.img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          // Hands the JPEG decode to the browser's own thread instead of
          // letting it land on the main thread mid-scroll.
          decoding="async"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
        />
      </AnimatePresence>
    </div>
  );
}

/**
 * 1-large + 2-stacked photo mosaic that swaps in a different trio of event
 * photos every few seconds (a crossfade, not a moving effect). It only runs
 * while on screen and holds still under the pointer or keyboard focus (the
 * group is focusable for that); reduced motion shows the first trio and stays put.
 */
export default function PhotoMosaic({ className = '' }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const running = !reduceMotion && seen && !hover && !focus;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % PHOTO_SETS.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [running]);

  // Fetch and decode the next trio while the browser is idle, so the swap
  // never pays for a decode at the moment it needs to paint.
  useEffect(() => {
    if (!running) return;
    const next = PHOTO_SETS[(index + 1) % PHOTO_SETS.length];
    const idle: typeof requestIdleCallback | undefined =
      typeof requestIdleCallback === 'function' ? requestIdleCallback : undefined;

    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      for (const src of next) {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
      }
    };

    const handle = idle ? idle(warm) : setTimeout(warm, 400);
    return () => {
      cancelled = true;
      if (idle && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(handle as number);
      } else {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
      }
    };
  }, [index, running]);

  const [large, topRight, bottomRight] = PHOTO_SETS[index];

  return (
    <div
      ref={rootRef}
      className={`lp-mosaic ${className}`}
      role="group"
      tabIndex={0}
      aria-label="Photographs from the last Summit, changing every few seconds; hover or focus to hold them"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
    >
      <Tile src={large} className="lp-mosaic__tile--large" />
      <Tile src={topRight} className="" />
      <Tile src={bottomRight} className="" />
    </div>
  );
}
