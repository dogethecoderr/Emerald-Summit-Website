import { useRef } from 'react';
import { rgba, type VerseVibe } from '../../models/verseVibes';
import { cn } from '@/lib/utils';
import { useCanvasLoop } from './useCanvasLoop';

const TAU = Math.PI * 2;
const SAMPLES = 220;

interface Perimeter {
  xs: Float64Array;
  ys: Float64Array;
  /** Inward normal at each sample. */
  nx: Float64Array;
  ny: Float64Array;
  /** Sample nearest the top center, where the intro pours in. */
  top: number;
}

const perimeters = new Map<string, Perimeter>();

/** Evenly spaced points around a rounded rectangle, with inward normals. */
function perimeterOf(w: number, h: number, radius: number): Perimeter {
  const key = `${Math.round(w)}x${Math.round(h)}r${radius}`;
  const cached = perimeters.get(key);
  if (cached) return cached;
  if (perimeters.size > 8) perimeters.clear();

  const r = Math.min(radius, w / 2, h / 2);
  const straightW = w - 2 * r;
  const straightH = h - 2 * r;
  const arc = (Math.PI / 2) * r;
  // Clockwise from the top-left end of the top edge.
  const segments: Array<{ len: number; at: (s: number) => [number, number, number, number] }> = [
    { len: straightW, at: (s) => [r + s, 0, 0, 1] },
    { len: arc, at: (s) => corner(w - r, r, -Math.PI / 2 + s / r) },
    { len: straightH, at: (s) => [w, r + s, -1, 0] },
    { len: arc, at: (s) => corner(w - r, h - r, s / r) },
    { len: straightW, at: (s) => [w - r - s, h, 0, -1] },
    { len: arc, at: (s) => corner(r, h - r, Math.PI / 2 + s / r) },
    { len: straightH, at: (s) => [0, h - r - s, 1, 0] },
    { len: arc, at: (s) => corner(r, r, Math.PI + s / r) },
  ];
  function corner(cx: number, cy: number, a: number): [number, number, number, number] {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [cx + c * r, cy + s * r, -c, -s];
  }
  const total = segments.reduce((sum, s) => sum + s.len, 0);
  const p: Perimeter = {
    xs: new Float64Array(SAMPLES),
    ys: new Float64Array(SAMPLES),
    nx: new Float64Array(SAMPLES),
    ny: new Float64Array(SAMPLES),
    top: 0,
  };
  let best = Infinity;
  for (let i = 0; i < SAMPLES; i++) {
    let d = (total * i) / SAMPLES;
    let seg = 0;
    while (seg < segments.length - 1 && d > segments[seg].len) {
      d -= segments[seg].len;
      seg++;
    }
    const [x, y, nx, ny] = segments[seg].at(Math.min(d, segments[seg].len));
    p.xs[i] = x;
    p.ys[i] = y;
    p.nx[i] = nx;
    p.ny[i] = ny;
    const dist = (x - w / 2) ** 2 + y ** 2;
    if (dist < best) {
      best = dist;
      p.top = i;
    }
  }
  perimeters.set(key, p);
  return p;
}

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;

/**
 * A band of liquid light flowing around the edge of its box in a verse's
 * colors (port of the mobile app's FlowingBorder). It pours in from the top
 * center after `introDelayMs`. Place it over the content; it ignores clicks.
 */
export default function FlowingBorder({
  vibe,
  cornerRadius = 28,
  introDelayMs = 280,
  className,
}: {
  vibe: VerseVibe;
  cornerRadius?: number;
  introDelayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mountedAt = useRef(performance.now());

  useCanvasLoop(ref, (ctx, w, h, t) => {
    const flow = vibe.flow;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sinceMount = (performance.now() - mountedAt.current - introDelayMs) / 1400;
    const pour = reduced ? 1 : easeOutCubic(Math.min(Math.max(sinceMount, 0), 1));
    const per = perimeterOf(w, h, cornerRadius);
    const n = SAMPLES;

    // Lub-dub swell for heartbeat flows; 1 for everything else.
    let pulse = 1;
    if (flow.heartbeat) {
      const p = (t % 1.1) / 1.1;
      const bump = (at: number, width: number) => Math.exp(-(((p - at) / width) ** 2));
      pulse = 0.65 + 0.9 * (bump(0.1, 0.04) + 0.6 * bump(0.28, 0.05));
    }

    const reveal = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      if (pour >= 1) {
        reveal[i] = 1;
        continue;
      }
      const steps = Math.abs(i - per.top);
      const dist = Math.min(steps, n - steps) / (n / 2);
      reveal[i] = Math.min(Math.max((pour * 1.25 - dist) / 0.12, 0), 1);
    }

    const waterLine = (layer: number) => {
      const xs = new Float64Array(n);
      const ys = new Float64Array(n);
      const speed = flow.speed * (1 + layer * 0.35);
      for (let i = 0; i < n; i++) {
        const u = i / n;
        const wave =
          0.6 * Math.sin(TAU * flow.waves * u + t * speed + layer * 1.7) +
          0.4 * Math.sin(TAU * (flow.waves * 2 + 1) * u - t * speed * 0.8 + layer);
        const d =
          (flow.depth * (1 + layer * 0.7) +
            flow.amplitude * (1 - layer * 0.25) * pulse * (0.5 + 0.5 * wave)) *
          reveal[i];
        xs[i] = per.xs[i] + per.nx[i] * d;
        ys[i] = per.ys[i] + per.ny[i] * d;
      }
      return { xs, ys };
    };

    // Colors swept around the center, rotating with `spin`.
    const rotation = t * flow.spin * TAU;
    const sweep = (alpha: number): CanvasGradient | string => {
      const colors = [...vibe.flowColors, vibe.flowColors[0]];
      if (typeof ctx.createConicGradient !== 'function') return rgba(colors[0], alpha);
      const g = ctx.createConicGradient(rotation, w / 2, h / 2);
      colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), rgba(c, alpha)));
      return g;
    };
    const trace = (line: { xs: Float64Array; ys: Float64Array }) => {
      ctx.moveTo(line.xs[0], line.ys[0]);
      for (let i = 1; i < n; i++) ctx.lineTo(line.xs[i], line.ys[i]);
      ctx.closePath();
    };

    // Deepest, faintest layer first; the bright surface line last.
    const alphas = [0.3, 0.17, 0.1];
    let surface = waterLine(0);
    for (let layer = 2; layer >= 0; layer--) {
      const line = layer === 0 ? surface : waterLine(layer);
      if (layer === 0) surface = line;
      ctx.beginPath();
      ctx.rect(-2, -2, w + 4, h + 4);
      trace(line);
      ctx.fillStyle = sweep(alphas[layer]);
      ctx.fill('evenodd');
    }
    ctx.beginPath();
    trace(surface);
    ctx.save();
    ctx.shadowColor = rgba(vibe.accent, 0.6);
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;
    ctx.strokeStyle = sweep(0.55);
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 1;
    ctx.strokeStyle = sweep(0.9);
    ctx.stroke();

    // Bright sparks riding the surface.
    if (flow.sparks > 0 && pour > 0.6) {
      const seg = new Float64Array(n + 1);
      for (let i = 1; i <= n; i++) {
        const j = i % n;
        seg[i] = seg[i - 1] + Math.hypot(surface.xs[j] - surface.xs[i - 1], surface.ys[j] - surface.ys[i - 1]);
      }
      const total = seg[n];
      for (let k = 0; k < flow.sparks; k++) {
        const along = ((t * 0.045 * flow.speed * (1 + k * 0.13) + k / flow.sparks) % 1) * total;
        let i = 1;
        while (i < n && seg[i] < along) i++;
        const a = i - 1;
        const b = i % n;
        const f = (along - seg[a]) / Math.max(seg[i] - seg[a], 1e-6);
        const x = surface.xs[a] + (surface.xs[b] - surface.xs[a]) * f;
        const y = surface.ys[a] + (surface.ys[b] - surface.ys[a]) * f;
        const color = vibe.flowColors[k % vibe.flowColors.length];
        const g = ctx.createRadialGradient(x, y, 0, x, y, 11);
        g.addColorStop(0, rgba(color, 0.55));
        g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, TAU);
        ctx.fill();
      }
    }
  });

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 block h-full w-full', className)}
    />
  );
}
