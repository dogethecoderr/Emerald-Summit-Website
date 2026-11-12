import { useEffect, useRef } from 'react';

/**
 * The arrival: an emerald sun rises from behind the left of the range, arcs
 * across the night sky and sets behind the right, the way the mobile app's
 * launch splash ("Arc Traverse") does. It is drawn inside the hero's own sky,
 * under its ridges, so when it has set the sky it leaves is already the hero.
 *
 * Colours are the app splash's palette, so the two read as one brand.
 */
const SKY_CORE = [12, 74, 53];
const SUN_CORE = [234, 255, 246];
const SUN_BODY = [52, 225, 196];
const SUN_HALO = [46, 200, 170];

/** One full rise and set. */
export const SUN_ARC_MS = 4200;

const rgba = ([r, g, b]: number[], a: number) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;

/** Small seeded generator, so every visit draws the same rays. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RAYS = (() => {
  const r = seeded(23);
  const n = 44;
  return Array.from({ length: n }, (_, i) => ({
    angle: (i / n) * Math.PI * 2 + r() * 0.06,
    length: 0.55 + r() * 0.9,
    width: 0.6 + r() * 1.3,
    alpha: 0.25 + r() * 0.55,
  }));
})();

export default function SunArc({
  onFrame,
  onDone,
}: {
  /** Every frame, with the timeline from 0 (rising) to 1 (set). */
  onFrame?: (t: number) => void;
  /** The sun has set. */
  onDone?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener('resize', size);

    const paint = (t: number) => {
      const day = Math.sin(t * Math.PI); // 0, up to 1 at the crest, back to 0
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);

      // The sky warms to emerald while the sun is up, and gives the stars back as it sets.
      const sky = ctx.createRadialGradient(w * 0.5, h * 0.34, 0, w * 0.5, h * 0.34, Math.max(w, h) * 0.95);
      sky.addColorStop(0, rgba(SKY_CORE, 0.7 * day));
      sky.addColorStop(0.55, rgba(SKY_CORE, 0.28 * day));
      sky.addColorStop(1, rgba(SKY_CORE, 0));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Left to right on an arc; low enough at both ends that the ridges hide it.
      const x = w * (0.2 + 0.6 * t);
      const y = h * (0.97 - day * 0.75);
      const r = Math.max(26, Math.min(70, Math.min(w, h) * 0.085));
      const a = Math.max(day, 0.08);

      const glowR = r * 3.2;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      glow.addColorStop(0, rgba(SUN_CORE, 0.55 * a));
      glow.addColorStop(0.28, rgba(SUN_BODY, 0.3 * a));
      glow.addColorStop(1, rgba(SUN_HALO, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Fine needle rays, turning slowly.
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const spin = t * 0.4;
      for (const ray of RAYS) {
        const tw = 0.75 + 0.25 * Math.sin(t * Math.PI * 6 * ray.width + ray.angle * 7);
        const ra = ray.alpha * a * tw;
        if (ra <= 0.01) continue;
        const ang = ray.angle + spin;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        const x0 = x + dx * r * 1.05;
        const y0 = y + dy * r * 1.05;
        const x1 = x + dx * r * (1.05 + ray.length);
        const y1 = y + dy * r * (1.05 + ray.length);
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, rgba(SUN_CORE, ra * 0.8));
        g.addColorStop(1, rgba(SUN_BODY, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = ray.width;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';

      const disc = ctx.createRadialGradient(x, y - r * 0.15, 0, x, y - r * 0.15, r);
      disc.addColorStop(0, rgba(SUN_CORE, a));
      disc.addColorStop(0.55, rgba(SUN_BODY, 0.95 * a));
      disc.addColorStop(1, rgba(SUN_HALO, 0.15 * a));
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    let raf = 0;
    let start = 0;
    let done = false;
    const frame = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / SUN_ARC_MS);
      paint(t);
      onFrameRef.current?.(t);
      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else if (!done) {
        done = true;
        ctx.clearRect(0, 0, w, h);
        onDoneRef.current?.();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
    };
  }, []);

  return <canvas ref={canvasRef} className="lp-sun" aria-hidden />;
}
