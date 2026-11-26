import { useEffect, useRef } from 'react';

/**
 * The arrival: an emerald sun rises straight up from behind the central summit,
 * at full strength, and comes to rest above it, where it dims and stays,
 * pulsing slowly (since Nov 20, 2026; it used to cross from left to right). It is drawn inside the
 * hero's own sky, under its ridges. With `rise` off (repeat visits, or after
 * Skip) it is simply there at the top.
 *
 * The sun is light, not a ball: everything is painted additively and fades
 * to nothing, so there is no rim to see, and a fringe of rays breathes out
 * of it (the same recipe the first arrival sequence used).
 */
const SKY_CORE = [12, 74, 53];

/** The climb from the horizon to the crest. */
const RISE_MS = 4100;
/** Above 1 the sun slows more as it settles into the crest. */
const SETTLE_EASE = 2.2;
/** Overall brightness at rest (1 = full strength, which it climbs at). */
const DIM = 0.62;
/** After reaching the top, how long it takes to dim from full strength to DIM. */
const DIM_MS = 2500;
/** One slow breath of the resting sun, and how deep it goes (0.15 = dims to 85%). */
const PULSE_MS = 9000;
const PULSE_DEPTH = 0.15;
/** The resting sun moves slowly, so it repaints at ~24fps, not 60. */
const REST_FRAME_MS = 1000 / 24;

/** Height of the crest and of the horizon, as shares of the sky's height. */
const ARC_TOP = 0.23;
const ARC_BASE = 0.98;
const SPOKES = 120;
const TAU = Math.PI * 2;

const rgba = ([r, g, b]: number[], a: number) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);

export default function SunArc({
  rise = true,
  onFrame,
  onDone,
}: {
  /** Climb up from the horizon first; off, the sun starts at rest at the top. */
  rise?: boolean;
  /** Every frame of the climb, with the timeline from 0 (horizon) to 0.5 (crest). */
  onFrame?: (t: number) => void;
  /** The sun has reached the crest. */
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

    // `glow` scales all the light: dimmed, and breathing once the sun is at rest.
    const paint = (t: number, secs: number, glow: number) => {
      const day = Math.sin(t * Math.PI); // 0 on the horizon, 1 at the crest
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);

      // The sky warms to emerald while the sun is up, and gives the stars back as it sets.
      const sky = ctx.createRadialGradient(w * 0.5, h * 0.34, 0, w * 0.5, h * 0.34, Math.max(w, h) * 0.95);
      sky.addColorStop(0, rgba(SKY_CORE, 0.62 * day * glow));
      sky.addColorStop(0.55, rgba(SKY_CORE, 0.27 * day * glow));
      sky.addColorStop(1, rgba(SKY_CORE, 0));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Straight up the middle, from behind the summit.
      const x = w * 0.5;
      const y = h * (ARC_BASE - day * (ARC_BASE - ARC_TOP));
      // Like a real day: the sun and its rays are smallest on the horizons and fullest at the crest.
      const grow = smooth(day);
      // Sized so the whole sun, rays included, fits between the top edge and the hero's lede.
      const r = Math.max(56, Math.min(118, Math.min(w, h) * 0.105)) * (0.42 + 0.58 * grow);
      const a = clamp01(0.12 + day * 1.25) * glow;
      const energy = clamp01(0.3 + 0.55 * day);

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
      const coronaR = r * (3.1 + 0.6 * grow);
      const corona = ctx.createRadialGradient(x, y, 0, x, y, coronaR);
      corona.addColorStop(0, `rgba(120, 245, 200, ${0.26 * a})`);
      corona.addColorStop(0.32, `rgba(52, 211, 153, ${0.12 * a})`);
      corona.addColorStop(0.68, `rgba(16, 150, 105, ${0.05 * a})`);
      corona.addColorStop(1, 'rgba(16, 150, 105, 0)');
      ctx.fillStyle = corona;
      ctx.beginPath();
      ctx.arc(x, y, coronaR, 0, TAU);
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
        // Short on the horizons, longest at the crest, and even then inside the halo.
        const reach = smooth(n) * (0.22 + 0.4 * energy) * (0.35 + 0.65 * grow);
        const fade = (0.04 + 0.22 * energy) * smooth(n) * a * (0.45 + 0.55 * grow);
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
      const coreR = r * (2.12 + 0.16 * grow);
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

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Only paint while the hero is on screen: the resting sun would otherwise run forever.
    let onScreen = true;
    let raf = 0;
    // Resting off screen, the loop stops outright (no idle frame wake-ups) and restarts when the hero is back.
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen && !raf && !still) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    let start = 0;
    let restAt = 0; // when the sun reached the crest
    let lastPaint = 0;
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      if (!start) start = now;
      const secs = (now - start) / 1000;
      const p = rise ? Math.min(1, (now - start) / RISE_MS) : 1;
      if (p < 1) {
        // Climbing: decelerates into the crest so it settles rather than stops.
        const t = 0.5 * (1 - (1 - p) ** SETTLE_EASE);
        paint(t, secs, 1);
        onFrameRef.current?.(t);
        return;
      }
      if (!restAt) {
        restAt = now;
        onFrameRef.current?.(0.5);
        onDoneRef.current?.();
      }
      if (!onScreen) {
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      if (now - lastPaint < REST_FRAME_MS) return;
      lastPaint = now;
      // Settles from full strength to DIM, then a slow breath down by PULSE_DEPTH and back.
      const settled = rise ? smooth(clamp01((now - restAt) / DIM_MS)) : 1;
      const breath = 0.5 - 0.5 * Math.cos((TAU * (now - restAt)) / PULSE_MS);
      paint(0.5, secs, (1 - (1 - DIM) * settled) * (1 - PULSE_DEPTH * breath * settled));
    };

    if (still) {
      // Reduced motion: no climb, no pulse; one still frame, redrawn on resize.
      const draw = () => paint(0.5, 0, DIM);
      draw();
      onDoneRef.current?.();
      window.addEventListener('resize', draw);
      return () => {
        io.disconnect();
        window.removeEventListener('resize', size);
        window.removeEventListener('resize', draw);
      };
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', size);
    };
  }, []);

  return <canvas ref={canvasRef} className="lp-sun" aria-hidden />;
}
