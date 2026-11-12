import { useEffect, useRef } from 'react';

/**
 * The arrival: an emerald sun rises from behind the range left of centre,
 * crests over the central summit and sets behind the range on the right, the
 * way the mobile app's launch splash ("Arc Traverse") does. It is drawn
 * inside the hero's own sky, under its ridges, so when it has set the sky it
 * leaves is already the hero.
 *
 * The sun is light, not a ball: everything is painted additively and fades
 * to nothing, so there is no rim to see, and a fringe of rays breathes out
 * of it (the same recipe the first arrival sequence used).
 */
const SKY_CORE = [12, 74, 53];

/** One full rise and set. */
export const SUN_ARC_MS = 4600;

/** How far either side of centre the sun rises and sets, as a share of the width. */
const ARC_HALF_SPAN = 0.21;
/** Height of the crest and of the two horizons, as shares of the sky's height. */
const ARC_TOP = 0.17;
const ARC_BASE = 0.98;
const SPOKES = 120;
const TAU = Math.PI * 2;

const rgba = ([r, g, b]: number[], a: number) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);

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
      sky.addColorStop(0, rgba(SKY_CORE, 0.5 * day));
      sky.addColorStop(0.55, rgba(SKY_CORE, 0.2 * day));
      sky.addColorStop(1, rgba(SKY_CORE, 0));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // A narrow arc about the centre; low enough at both ends that the ridges hide it.
      const x = w * (0.5 + ARC_HALF_SPAN * (2 * t - 1));
      const y = h * (ARC_BASE - day * (ARC_BASE - ARC_TOP));
      const r = Math.max(36, Math.min(112, Math.min(w, h) * 0.115));
      const a = clamp01(0.12 + day * 1.25);
      const secs = (t * SUN_ARC_MS) / 1000;
      // The rays swell toward the crest and breathe a little all the way across.
      const energy = clamp01(0.3 + 0.5 * day + 0.12 * Math.sin(secs * 2.1));

      ctx.globalCompositeOperation = 'lighter';

      // Bloom: the light the sun throws across the sky.
      const bloomR = r * (4.6 + energy * 1.6);
      const bloom = ctx.createRadialGradient(x, y, 0, x, y, bloomR);
      const bloomA = (0.07 + 0.11 * energy) * a;
      bloom.addColorStop(0, `rgba(52, 211, 153, ${bloomA})`);
      bloom.addColorStop(0.45, `rgba(20, 160, 110, ${bloomA * 0.42})`);
      bloom.addColorStop(1, 'rgba(12, 122, 85, 0)');
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(x, y, bloomR, 0, TAU);
      ctx.fill();

      // Corona: the soft halo the core sits inside.
      const corona = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
      corona.addColorStop(0, `rgba(120, 245, 200, ${0.26 * a})`);
      corona.addColorStop(0.32, `rgba(52, 211, 153, ${0.12 * a})`);
      corona.addColorStop(0.68, `rgba(16, 150, 105, ${0.05 * a})`);
      corona.addColorStop(1, 'rgba(16, 150, 105, 0)');
      ctx.fillStyle = corona;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.4, 0, TAU);
      ctx.fill();

      // Rays: spokes that start inside the glow and taper away, each growing
      // and retracting on its own slow wave so the fringe never repeats.
      ctx.lineCap = 'butt';
      for (let i = 0; i < SPOKES; i++) {
        const ang = (i / SPOKES) * TAU + secs * 0.05;
        const n = clamp01(
          0.5 +
            0.24 * Math.sin(i * 0.7 + secs * 0.9) +
            0.16 * Math.sin(i * 1.9 - secs * 0.6) +
            0.12 * Math.sin(i * 3.3 + secs * 1.4),
        );
        const reach = smooth(n) * (0.3 + 0.6 * energy);
        const fade = (0.04 + 0.22 * energy) * smooth(n) * a;
        if (fade <= 0.003) continue;
        // Rooted further out than the core's bright heart, so a bigger sun doesn't mean longer rays.
        const inner = r * 0.5;
        const outer = r * (1.3 + reach);
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        const g = ctx.createLinearGradient(x + dx * inner, y + dy * inner, x + dx * outer, y + dy * outer);
        // Nothing at the root: a ray that starts lit leaves a beaded ring round the core.
        g.addColorStop(0, 'rgba(214, 255, 236, 0)');
        g.addColorStop(0.3, `rgba(214, 255, 236, ${fade})`);
        g.addColorStop(0.58, `rgba(110, 231, 183, ${fade * 0.5})`);
        g.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = r * (0.016 + 0.03 * n);
        ctx.beginPath();
        ctx.moveTo(x + dx * inner, y + dy * inner);
        ctx.lineTo(x + dx * outer, y + dy * outer);
        ctx.stroke();
      }

      // The core: blown out to white at the heart and falling away into the
      // corona well past where a rim would be, so no edge is left to read.
      const coreR = r * 2.2;
      const core = ctx.createRadialGradient(x, y, 0, x, y, coreR);
      core.addColorStop(0, `rgba(240, 255, 249, ${0.9 * a})`);
      core.addColorStop(0.1, `rgba(226, 255, 243, ${0.82 * a})`);
      core.addColorStop(0.2, `rgba(208, 252, 230, ${0.74 * a})`);
      core.addColorStop(0.31, `rgba(170, 244, 208, ${0.56 * a})`);
      core.addColorStop(0.43, `rgba(118, 232, 184, ${0.34 * a})`);
      core.addColorStop(0.56, `rgba(84, 222, 168, ${0.2 * a})`);
      core.addColorStop(0.7, `rgba(60, 214, 156, ${0.1 * a})`);
      core.addColorStop(0.85, `rgba(52, 211, 153, ${0.035 * a})`);
      core.addColorStop(1, 'rgba(52, 211, 153, 0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, coreR, 0, TAU);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';
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
