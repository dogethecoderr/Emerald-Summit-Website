import { useEffect, useRef, type RefObject } from 'react';

export type DrawFrame = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seconds: number,
) => void;

/** Seconds shown when motion is reduced: a settled, representative frame. */
const STILL_FRAME = 2.5;

/**
 * Runs `draw` every animation frame on a canvas sized to its box (at device
 * pixel ratio). Like the mobile app's effect ticker, the clock pauses while
 * the canvas is off screen or the tab is hidden, and resumes where it left
 * off. Under prefers-reduced-motion it draws one still frame instead.
 */
export function useCanvasLoop(canvasRef: RefObject<HTMLCanvasElement | null>, draw: DrawFrame) {
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let clock = STILL_FRAME;
    let last: number | null = null;
    let frame = 0;
    let onScreen = true;

    const paint = () => {
      if (width === 0 || height === 0) return;
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      drawRef.current(ctx, width, height, clock);
      ctx.restore();
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };

    const tick = (now: number) => {
      if (last !== null) clock += Math.min((now - last) / 1000, 0.1);
      last = now;
      paint();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (reduced || frame || !onScreen || document.hidden) return;
      last = null;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            if (onScreen) start();
            else stop();
          })
        : null;
    io?.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    start();
    return () => {
      stop();
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [canvasRef]);
}

/** Small deterministic random generator, so a motif's particles never jump. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
  flag: boolean;
}

const fields = new Map<string, Particle[]>();

/** A seeded particle field, cached per key (positions stay fixed per motif). */
export function field(key: string, count: number, seed: number): Particle[] {
  let list = fields.get(key);
  if (!list) {
    const r = mulberry32(seed);
    list = Array.from({ length: count }, () => ({
      x: r(),
      y: r(),
      size: r(),
      speed: 0.5 + r(),
      phase: r() * Math.PI * 2,
      flag: r() < 0.5,
    }));
    fields.set(key, list);
  }
  return list;
}
