import { useRef } from 'react';
import { mixHex, rgba, type VerseVibe } from '../../models/verseVibes';
import { cn } from '@/lib/utils';
import { field, useCanvasLoop } from './useCanvasLoop';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** Soft glow: a radial fade standing in for Flutter's MaskFilter.blur. */
function glow(ctx: Ctx, x: number, y: number, r: number, blur: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r + blur);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(r / (r + blur), rgba(color, alpha * 0.6));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r + blur, 0, TAU);
  ctx.fill();
}

function dot(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// Each painter below is a port of the matching method in the mobile app's
// _MotifPainter (lib/widgets/discipline_effects.dart), same numbers.

function circuit(ctx: Ctx, w: number, h: number, t: number, v: VerseVibe, compact: boolean) {
  const g = compact ? 16 : 26;
  ctx.fillStyle = rgba(v.accent, 0.13);
  for (let x = g / 2; x < w; x += g) {
    for (let y = g / 2; y < h; y += g) {
      ctx.beginPath();
      ctx.arc(x, y, compact ? 0.6 : 0.8, 0, TAU);
      ctx.fill();
    }
  }
  // Data pulses racing along grid lanes, each with a fading tail.
  const lanesX = Math.floor(w / g);
  const lanesY = Math.floor(h / g);
  for (const p of field(`circuit-${compact}`, compact ? 4 : 11, 7)) {
    const horizontal = p.flag;
    const length = horizontal ? w : h;
    const tail = compact ? 34 : 70;
    const travel = ((t * 0.16 * p.speed + p.phase) % 1.3) - 0.15;
    const head = travel * (length + tail);
    const lane = horizontal
      ? Math.floor(p.y * lanesY) * g + g / 2
      : Math.floor(p.x * lanesX) * g + g / 2;
    const [ax, ay] = horizontal ? [head - tail, lane] : [lane, head - tail];
    const [bx, by] = horizontal ? [head, lane] : [lane, head];
    const color = p.size > 0.5 ? v.accent : v.accent2;
    const grad = ctx.createLinearGradient(ax, ay, bx, by);
    grad.addColorStop(0, rgba(color, 0));
    grad.addColorStop(1, rgba(color, 0.9));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    glow(ctx, bx, by, compact ? 3 : 5, 4, color, 0.45);
    dot(ctx, bx, by, 1.6, '#FFFFFF');
  }
}

function ticker(ctx: Ctx, w: number, h: number, t: number, v: VerseVibe, compact: boolean) {
  const step = compact ? 22 : 44;
  ctx.strokeStyle = rgba(v.accent, 0.06);
  ctx.lineWidth = 1;
  for (let y = step; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // A chart line that scrolls left and trends up and to the right.
  const scroll = t * (compact ? 14 : 26);
  const amp = compact ? 0.6 : 1;
  const yAt = (x: number) => {
    const u = (x + scroll) / 14;
    const wiggle = Math.sin(u * 0.5) * 16 + Math.sin(u * 1.3 + 1) * 8 + Math.sin(u * 0.21) * 26;
    return h * 0.78 - (x / w) * h * 0.32 + wiggle * amp;
  };
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(0, yAt(0));
    for (let x = 6; x <= w + 6; x += 6) ctx.lineTo(x, yAt(x));
  };
  // Area under the line first, then the line on top.
  trace();
  ctx.lineTo(w + 6, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, 0, 0, h);
  fill.addColorStop(0, rgba(v.accent, 0.16));
  fill.addColorStop(1, rgba(v.accent, 0));
  ctx.fillStyle = fill;
  ctx.fill();
  trace();
  ctx.lineWidth = compact ? 1.4 : 2;
  ctx.strokeStyle = rgba(v.accent, 0.55);
  ctx.stroke();

  const headX = w * 0.82;
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  glow(ctx, headX, yAt(headX), (compact ? 5 : 8) + pulse * 4, 5, v.accent2, 0.35);
  dot(ctx, headX, yAt(headX), compact ? 2 : 3, v.accent2);

  // Embers rising off the chart.
  for (const p of field(`ticker-${compact}`, compact ? 6 : 18, 11)) {
    const rise = (t * 0.12 * p.speed + p.phase) % 1;
    const y = h * (1.05 - rise * 1.1);
    const x = p.x * w + Math.sin(t + p.phase) * 8;
    dot(ctx, x, y, 0.8 + p.size * (compact ? 1.2 : 2), rgba(p.flag ? v.accent : v.accent2, (1 - rise) * 0.7));
  }
}

function cells(ctx: Ctx, w: number, h: number, t: number, v: VerseVibe, compact: boolean) {
  for (const p of field(`cells-${compact}`, compact ? 7 : 15, 23)) {
    const r = (compact ? 6 : 12) + p.size * (compact ? 14 : 30);
    const rise = (t * 0.03 * p.speed + p.phase / TAU) % 1;
    const y = h + r - rise * (h + r * 2);
    const x = p.x * w + Math.sin(t * 0.6 + p.phase) * (compact ? 6 : 14);
    const breathe = 1 + 0.06 * Math.sin(t * 1.4 + p.phase);
    const color = p.flag ? v.accent : v.accent2;
    dot(ctx, x, y, r * breathe, rgba(color, 0.06));
    ctx.strokeStyle = rgba(color, 0.32);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r * breathe, 0, TAU);
    ctx.stroke();
    dot(
      ctx,
      x + Math.cos(t * 0.9 + p.phase) * r * 0.22,
      y + Math.sin(t * 1.1 + p.phase) * r * 0.22,
      r * 0.3,
      rgba(color, 0.4),
    );
  }
}

function stars(ctx: Ctx, w: number, h: number, t: number, v: VerseVibe, compact: boolean) {
  for (const p of field(`stars-${compact}`, compact ? 36 : 120, 31)) {
    const twinkle = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * (1 + p.speed) + p.phase));
    const color = p.size > 0.85 ? (p.flag ? v.accent : v.accent2) : '#FFFFFF';
    dot(ctx, p.x * w, p.y * h, 0.4 + p.size * (compact ? 1 : 1.4), rgba(color, twinkle * 0.85));
  }
  // Two tilted orbits, each carrying a planet.
  const [cx, cy] = compact ? [w * 0.72, h * 0.28] : [w * 0.78, h * 0.16];
  const orbit = (rx: number, ry: number, speed: number, planet: string, alpha: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.35);
    ctx.strokeStyle = rgba(v.accent, alpha);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.stroke();
    const a = t * speed;
    const px = Math.cos(a) * rx;
    const py = Math.sin(a) * ry;
    glow(ctx, px, py, compact ? 5 : 8, 6, planet, 0.5);
    dot(ctx, px, py, compact ? 2.4 : 3.6, planet);
    ctx.restore();
  };
  const base = compact ? w * 0.45 : w * 0.42;
  orbit(base, base * 0.32, 0.45, v.accent, 0.2);
  orbit(base * 1.5, base * 0.5, -0.25, v.accent2, 0.1);

  // A shooting star every few seconds.
  if (!compact) {
    const cycle = (t % 6.5) / 6.5;
    if (cycle < 0.14) {
      const k = cycle / 0.14;
      const [dx, dy] = [w * 0.55, h * 0.22];
      const hx = w * 0.15 + dx * k;
      const hy = h * 0.08 + dy * k;
      const tx = hx - dx * 0.25;
      const ty = hy - dy * 0.25;
      const grad = ctx.createLinearGradient(tx, ty, hx, hy);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, `rgba(255,255,255,${(1 - k) * 0.9})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
  }
}

function ripples(ctx: Ctx, w: number, h: number, t: number, v: VerseVibe, compact: boolean) {
  // Faint columns, like a courthouse front.
  ctx.strokeStyle = rgba(v.accent, 0.05);
  ctx.lineWidth = 1;
  const cols = compact ? 4 : 6;
  for (let i = 1; i < cols; i++) {
    const x = (w * i) / cols;
    for (const dx of [-5, 5]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, 0);
      ctx.lineTo(x + dx, h);
      ctx.stroke();
    }
  }
  // Rings spreading from a gavel strike, three at a time.
  const [ox, oy] = compact ? [w * 0.78, h * 0.2] : [w * 0.5, h * 0.12];
  const maxR = Math.sqrt(w * w + h * h) * (compact ? 0.8 : 0.9);
  const period = 3.6;
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 3; k++) {
    const p = (t / period + k / 3) % 1;
    const fade = (1 - p) * (1 - p);
    ctx.strokeStyle = rgba(k % 2 === 0 ? v.accent : v.accent2, fade * 0.35);
    ctx.beginPath();
    ctx.arc(ox, oy, p * maxR, 0, TAU);
    ctx.stroke();
  }
  dot(ctx, ox, oy, compact ? 3 : 4, rgba(v.accent, 0.7));
}

function paint(ctx: Ctx, w: number, h: number, t: number, v: VerseVibe, compact: boolean) {
  const radius = Math.min(w, h) * (compact ? 0.55 : 0.45);
  const colors = v.flowColors;
  ctx.globalCompositeOperation = 'lighter';
  field(`paint-${compact}`, 5, 47).forEach((p, i) => {
    const cx = w * (0.5 + 0.4 * Math.sin(t * 0.23 * p.speed + p.phase));
    const cy = h * (0.5 + 0.42 * Math.sin(t * 0.17 * (2 - p.speed) + p.phase * 1.7));
    // Drift each blob slowly from one palette color to the next.
    const f = (t * 0.08 + i * 0.9) % colors.length;
    const color = mixHex(
      colors[Math.floor(f) % colors.length],
      colors[(Math.floor(f) + 1) % colors.length],
      f - Math.floor(f),
    );
    const r = radius * (0.75 + 0.25 * Math.sin(t * 0.5 + p.phase));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(color, 0.2));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
  });
  ctx.globalCompositeOperation = 'source-over';
}

const PAINTERS = { circuit, ticker, cells, stars, ripples, paint } as const;

/**
 * A verse's animated background (port of the mobile app's AmbientMotif).
 * `compact` draws the lighter version sized for a card. Transparent: put the
 * verse's background color behind it.
 */
export default function VerseMotif({
  vibe,
  compact = false,
  className,
}: {
  vibe: VerseVibe;
  compact?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasLoop(ref, (ctx, w, h, t) => PAINTERS[vibe.motif](ctx, w, h, t, vibe, compact));
  return <canvas ref={ref} aria-hidden className={cn('pointer-events-none block h-full w-full', className)} />;
}
