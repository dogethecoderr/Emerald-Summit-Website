// Painted surfaces for the landing page's discipline planets (OrbitPlanets3D).
// Each planet is drawn once onto small canvases, wrapped around its sphere as
// an equirectangular map: a color map in shades of the discipline's palette,
// and a glow map for its lit details (circuits, city lights, stars). The
// details nod to each discipline's 3D world on the dashboard.
import * as THREE from 'three';
import type { VerseMotif } from '../models/verseVibes';

const W = 512;
const H = 256;

/** Deterministic noise, so every visit paints the same planet. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The color moved toward black (t < 0) or white (t > 0). */
function shade(hex: string, t: number, alpha = 1): string {
  const [r, g, b] = hexRgb(hex);
  const to = t < 0 ? 0 : 255;
  const k = Math.abs(t);
  const mix = (c: number) => Math.round(c + (to - c) * k);
  return `rgba(${mix(r)},${mix(g)},${mix(b)},${alpha})`;
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return [c, c.getContext('2d')!] as const;
}

/** Draw `fn` at x and, near the seam, again one width over, so the map wraps without a line. */
function wrapped(x: number, r: number, fn: (x: number) => void) {
  fn(x);
  if (x - r < 0) fn(x + W);
  if (x + r > W) fn(x - W);
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  wrapped(x, r, (cx) => {
    const g = ctx.createRadialGradient(cx, y, 0, cx, y, r);
    g.addColorStop(0, fill);
    g.addColorStop(1, fill.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Horizontal bands of shades, like a gas giant's cloud belts. */
function bands(ctx: CanvasRenderingContext2D, colors: string[], rand: () => number, count: number) {
  let y = 0;
  while (y < H) {
    const h = 6 + rand() * (H / count);
    const c = colors[Math.floor(rand() * colors.length)];
    // Hex colors get a random light/dark variation; colors already shaded (rgba) are used as given.
    ctx.fillStyle = c.startsWith('#') ? shade(c, (rand() - 0.5) * 0.5) : c;
    // Each belt wobbles a little along its length.
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y + Math.sin((x / W) * Math.PI * 4 + rand()) * 2.5);
    ctx.lineTo(W, y + h);
    for (let x = W; x >= 0; x -= 16) ctx.lineTo(x, y + h + Math.sin((x / W) * Math.PI * 6) * 2.5);
    ctx.closePath();
    ctx.fill();
    y += h;
  }
}

/** Darker poles and a soft light band at the equator, for depth on every planet. */
function poles(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(0.22, 'rgba(0,0,0,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  g.addColorStop(0.78, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Landmasses: clusters of overlapping soft blobs. */
function continents(ctx: CanvasRenderingContext2D, rand: () => number, fills: string[], n: number, minY = 0.15, maxY = 0.85) {
  for (let i = 0; i < n; i++) {
    const cx = rand() * W;
    const cy = (minY + rand() * (maxY - minY)) * H;
    const fill = fills[i % fills.length];
    for (let k = 0; k < 14; k++) blob(ctx, cx + (rand() - 0.5) * 70, cy + (rand() - 0.5) * 34, 8 + rand() * 18, fill);
  }
}

export interface PlanetMaps {
  map: THREE.CanvasTexture;
  glow: THREE.CanvasTexture;
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Paint one discipline's planet. `palette` is its four flow colors, `accent` its highlight. */
export function paintPlanet(motif: VerseMotif | 'gem', base: string, palette: string[], accent: string, seed: number): PlanetMaps {
  const rand = rng(seed);
  const [c, ctx] = canvas();
  const [gc, gctx] = canvas();
  gctx.fillStyle = '#000';
  gctx.fillRect(0, 0, W, H);

  switch (motif) {
    case 'circuit': {
      // TechVerse: a deep-blue world etched with glowing circuit traces, like its server-tower world.
      bands(ctx, [palette[1], palette[2], base], rand, 10);
      continents(ctx, rand, [shade(palette[1], -0.35, 0.7)], 5);
      for (let i = 0; i < 46; i++) {
        let x = rand() * W;
        let y = (0.12 + rand() * 0.76) * H;
        const path: [number, number][] = [[x, y]];
        for (let s = 0; s < 4; s++) {
          if (s % 2 === 0) x += (rand() - 0.5) * 90;
          else y += (rand() - 0.5) * 40;
          path.push([x, y]);
        }
        for (const [g2, color, width] of [[ctx, shade(accent, 0.1, 0.55), 1.2], [gctx, accent, 1.6]] as const) {
          g2.strokeStyle = color;
          g2.lineWidth = width;
          g2.beginPath();
          path.forEach(([px, py], k) => (k ? g2.lineTo(px, py) : g2.moveTo(px, py)));
          g2.stroke();
          const [ex, ey] = path[path.length - 1];
          g2.fillStyle = color;
          g2.beginPath();
          g2.arc(ex, ey, 2.4, 0, Math.PI * 2);
          g2.fill();
        }
      }
      break;
    }
    case 'ticker': {
      // VentureVerse: amber cloud belts, a rising market line round the equator, and city lights.
      bands(ctx, [palette[0], palette[1], palette[2]], rand, 14);
      for (let pass = 0; pass < 2; pass++) {
        const g2 = pass ? gctx : ctx;
        g2.strokeStyle = pass ? palette[1] : shade(palette[3], 0.1, 0.75);
        g2.lineWidth = pass ? 2 : 3;
        g2.beginPath();
        let y = H * 0.56;
        for (let x = 0; x <= W; x += 14) {
          y += (rand() - 0.58) * 10;
          y = Math.min(H * 0.66, Math.max(H * 0.4, y));
          if (x === 0) g2.moveTo(x, y);
          else g2.lineTo(x, y);
        }
        g2.lineTo(W, H * 0.56);
        g2.stroke();
      }
      for (let i = 0; i < 260; i++) {
        const x = rand() * W;
        const y = (0.2 + rand() * 0.6) * H;
        gctx.fillStyle = shade(palette[1], 0.2, 0.4 + rand() * 0.6);
        gctx.fillRect(x, y, 1.6, 1.6);
      }
      break;
    }
    case 'cells': {
      // BioSphere: green continents with leaf veins over a teal sea, a living world.
      bands(ctx, [base, shade(base, -0.25)], rand, 6);
      continents(ctx, rand, palette.map((p) => shade(p, -0.1, 0.85)), 7, 0.12, 0.88);
      ctx.strokeStyle = shade(palette[2] ?? base, 0.35, 0.35);
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const x = rand() * W;
        const y = (0.15 + rand() * 0.7) * H;
        const a = rand() * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a) * 14, y + Math.sin(a) * 4, x + Math.cos(a) * 26, y + Math.sin(a) * 10);
        ctx.stroke();
      }
      for (let i = 0; i < 70; i++) blob(gctx, rand() * W, (0.2 + rand() * 0.6) * H, 2 + rand() * 3, shade(palette[1] ?? base, 0.3, 0.6));
      break;
    }
    case 'stars': {
      // NovaSphere: an Earth of blue oceans, green and sand continents, ice caps and cloud.
      // Blue oceans, like the globe in its dashboard world.
      bands(ctx, ['#1D4E89', '#2563A6', '#1A4479'], rand, 5);
      continents(ctx, rand, [shade(palette[2] ?? base, -0.1, 0.9), shade('#C9A66B', -0.1, 0.75)], 6);
      for (const y of [0, H]) {
        const g = ctx.createLinearGradient(0, y, 0, y ? y - 34 : 34);
        g.addColorStop(0, 'rgba(245,250,255,0.95)');
        g.addColorStop(1, 'rgba(245,250,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y ? y - 34 : 0, W, 34);
      }
      for (let i = 0; i < 26; i++) blob(ctx, rand() * W, (0.15 + rand() * 0.7) * H, 10 + rand() * 22, 'rgba(255,255,255,0.32)');
      break;
    }
    case 'ripples': {
      // CivicVerse: veined marble in its rose and plum shades, with ripples spreading from a point.
      bands(ctx, [palette[0], palette[1], base], rand, 8);
      ctx.strokeStyle = shade(base, 0.6, 0.35);
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 22; i++) {
        let x = rand() * W;
        let y = rand() * H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 6; s++) {
          x += 10 + rand() * 30;
          y += (rand() - 0.5) * 26;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (const [cx, cy] of [[W * 0.3, H * 0.45], [W * 0.78, H * 0.6]]) {
        for (let r = 8; r < 70; r += 9) {
          wrapped(cx, r, (x) => {
            for (const [g2, color] of [[ctx, shade(accent, 0.3, 0.5 - r / 180)], [gctx, shade(accent, 0.2, 0.35 - r / 240)]] as const) {
              g2.strokeStyle = color;
              g2.lineWidth = 1.4;
              g2.beginPath();
              g2.ellipse(x, cy, r, r * 0.55, 0, 0, Math.PI * 2);
              g2.stroke();
            }
          });
        }
      }
      break;
    }
    case 'paint': {
      // ImagineX: swirls of paint in its palette, with a scatter of stage-light sparkles.
      bands(ctx, [base, shade(base, -0.3)], rand, 6);
      for (let i = 0; i < 18; i++) {
        const color = palette[i % palette.length];
        const y0 = rand() * H;
        ctx.strokeStyle = shade(color, (rand() - 0.5) * 0.3, 0.75);
        ctx.lineWidth = 4 + rand() * 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const phase = rand() * Math.PI * 2;
        const amp = 6 + rand() * 18;
        for (let x = -20; x <= W + 20; x += 10) {
          const y = y0 + Math.sin((x / W) * Math.PI * 2 * 2 + phase) * amp;
          if (x === -20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 120; i++) {
        gctx.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.7})`;
        gctx.fillRect(rand() * W, rand() * H, 1.5, 1.5);
      }
      break;
    }
    default: {
      // A discipline added later: its color in belts, with a few bright facets.
      bands(ctx, [base, shade(base, -0.3), shade(base, 0.2)], rand, 10);
    }
  }
  poles(ctx);
  return { map: toTexture(c), glow: toTexture(gc) };
}

/** A ring's strip: bands of the palette fading in and out across its width, mapped radially. */
export function paintRing(palette: string[], seed: number, gaps = 3): THREE.CanvasTexture {
  const rand = rng(seed);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 4;
  const ctx = c.getContext('2d')!;
  for (let x = 0; x < 256; x += 2) {
    const edge = Math.min(x, 256 - x) / 40;
    const gap = Math.sin((x / 256) * Math.PI * gaps) > 0.85 ? 0.15 : 1;
    ctx.fillStyle = shade(palette[Math.floor(rand() * palette.length)], (rand() - 0.5) * 0.4, Math.min(1, edge) * gap * (0.35 + rand() * 0.45));
    ctx.fillRect(x, 0, 2, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
