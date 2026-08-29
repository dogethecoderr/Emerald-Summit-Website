import { useEffect, useRef } from 'react';
import { RIDGES, RIDGE_WIDTH } from './skyGeometry';

const TAU = Math.PI * 2;
const STAR_COUNT = 900;

/* Timeline, in seconds. Each mark is where that beat *finishes*. */
const T_WARP = 5.0; // hyperspace at full tilt
const T_SETTLE = 7.6; // slowing; stars fall back, sun resolves, ridges rise
const T_PULSE = 11.8; // sun radiates and shrinks, three decaying beats
const T_SET = 14.6; // sun dims and drops behind the range — hero copy starts
const T_END = 16.4; // stars finished flickering back in

/** Where in the pulse window each beat crests, and how wide each swell is. */
const BEATS = [0.0833, 0.4167, 0.75];
const BEAT_WIDTH = 0.62;

/**
 * Where each range's snow band sits, as a fraction of its own box. Tuned to
 * each ridge's peak line (far peaks sit lower in their box than near ones).
 */
const SNOW = [
  { start: 0.2, end: 0.36, opacity: 0.3 },
  { start: 0.15, end: 0.32, opacity: 0.34 },
  { start: 0.08, end: 0.26, opacity: 0.4 },
];

/** Alpha/width buckets for the star batching. */
const ALPHA_STEPS = 14;
const WIDTH_STEPS = 4;
const WIDTH_MIN = 0.8;
const WIDTH_MAX = 3.8;

/**
 * Deep green rock, kept well below the sky in value so the range still reads
 * as a dark mass and the sun stays the brightest thing on screen. Lit faces
 * carry more of the emerald; shadowed ones fall almost to black.
 */
const FACET_DARK = ['#13251c', '#0d1a14', '#050c09'];
const FACET_LIT = ['#3d6a55', '#2d5140', '#1d3729'];

/** Blend two hex colours — used once at render to shade the slope faces. */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round((pa >> 16) + (((pb >> 16) - (pa >> 16)) * t));
  const g = Math.round(
    ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t),
  );
  const bl = Math.round((pa & 255) + (((pb & 255) - (pa & 255)) * t));
  return `rgb(${r}, ${g}, ${bl})`;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Smoothstep — eases both ends, so no beat starts or stops abruptly. */
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** Normalised progress through a window of the timeline. */
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

interface Star {
  slot: number;
  angle: number;
  cos: number;
  sin: number;
  dist: number;
  speed: number;
  bright: number;
  size: number;
  phase: number;
  rate: number;
  delay: number;
}

function slotAngle(slot: number): number {
  return ((slot + Math.random()) / STAR_COUNT) * TAU;
}

interface MountainSkylineProps {
  playIntro?: boolean;
  skip?: boolean;
  onCueContent?: () => void;
}

/**
 * The hero's night sky, and — on a first visit — the arrival sequence that
 * lands on it. Stars, sun and ridges share one clock in one layer, so the
 * sequence *becomes* the finished sky rather than dissolving into a copy of
 * it. The sun is drawn on the canvas, which sits under the ridge SVGs, so it
 * genuinely passes behind the range as it sets.
 */
export default function MountainSkyline({
  playIntro = false,
  skip = false,
  onCueContent,
}: MountainSkylineProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nightRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const ridgeRefs = useRef<(SVGSVGElement | null)[]>([]);
  const crestRefs = useRef<(SVGPathElement | null)[]>([]);

  const cuedRef = useRef(false);
  const onCueRef = useRef(onCueContent);
  onCueRef.current = onCueContent;
  const skipRef = useRef(skip);
  skipRef.current = skip;
  const playRef = useRef(playIntro);
  playRef.current = playIntro;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!wrap || !canvas || !ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = wrap.offsetWidth;
      h = wrap.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const radius = () => Math.hypot(w, h) / 2;
    const stars: Star[] = Array.from({ length: STAR_COUNT }, (_, i) => ({
      slot: i,
      angle: 0,
      cos: 0,
      sin: 0,
      dist: Math.sqrt(Math.random()) * radius(),
      speed: 0.45 + Math.random() * 0.55,
      bright: 0.18 + Math.pow(Math.random(), 2.2) * 0.82,
      size: 1.3 + Math.pow(Math.random(), 1.8) * 2.4,
      phase: Math.random() * TAU,
      rate: 1.6 + Math.random() * 2.2,
      delay: Math.random(),
    }));
    const aim = (s: Star) => {
      s.angle = slotAngle(s.slot);
      s.cos = Math.cos(s.angle);
      s.sin = Math.sin(s.angle);
    };
    stars.forEach(aim);

    const paths: (Path2D | null)[] = new Array(ALPHA_STEPS * WIDTH_STEPS).fill(
      null,
    );
    const beatTimes = BEATS.map((b) => T_SETTLE + (T_PULSE - T_SETTLE) * b);

    const start = performance.now();
    ctx.lineCap = 'round';
    let raf = 0;
    // Offline frame capture (dev only). When the capture page sets this flag
    // before mount, the sequence never self-schedules — the renderer drives it
    // one frame at a time off its own clock, so the encoded video is exact
    // rather than however the recording machine happened to keep up.
    const capturing =
      import.meta.env.DEV && (window as unknown as Record<string, unknown>).__SKY_CAPTURE__ === true;
    // Once the one-time arrival sequence has handed off to the settled sky
    // (or there was none to play), stop redrawing while the canvas is
    // scrolled out of view — nothing past the hero needs this loop running.
    let visible = true;

    /** Disc, corona, bloom and the spokes of light each beat drives. */
    const drawSun = (
      cx: number,
      cy: number,
      r: number,
      alpha: number,
      energy: number,
      t: number,
    ) => {
      if (alpha <= 0.001 || r <= 0) return;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Corona: the wide, soft halo the disc sits inside. Started from zero
      // radius — an inner radius leaves a flat plateau whose edge shows as a
      // seam once the additive layers stack up.
      const corona = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3.4);
      corona.addColorStop(0, `rgba(120, 245, 200, ${0.34 * alpha})`);
      corona.addColorStop(0.32, `rgba(52, 211, 153, ${0.16 * alpha})`);
      corona.addColorStop(0.68, `rgba(16, 150, 105, ${0.05 * alpha})`);
      corona.addColorStop(1, 'rgba(16, 150, 105, 0)');
      ctx.fillStyle = corona;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 3.4, 0, TAU);
      ctx.fill();

      // Emerald bloom the flare throws across the sky, so the light feels
      // like it's coming off the sun rather than sitting behind it.
      const bloomR = r * (5.2 + energy * 2.6);
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomR);
      const bloomA = (0.10 + 0.30 * energy) * alpha;
      bloom.addColorStop(0, `rgba(52, 211, 153, ${bloomA})`);
      bloom.addColorStop(0.45, `rgba(20, 160, 110, ${bloomA * 0.42})`);
      bloom.addColorStop(1, 'rgba(12, 122, 85, 0)');
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(cx, cy, bloomR, 0, TAU);
      ctx.fill();

      // Radiation: spokes of light that ease out of the limb and taper away.
      const spokes = 108;
      ctx.lineCap = 'butt';
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * TAU + t * 0.045;
        // Several incommensurate waves so the fringe undulates smoothly and
        // never falls into a visible repeating pattern.
        const n = clamp01(
          0.5 +
            0.24 * Math.sin(i * 0.7 + t * 0.9) +
            0.16 * Math.sin(i * 1.9 - t * 0.6) +
            0.12 * Math.sin(i * 3.3 + t * 1.4),
        );
        // Smoothstep the reach so spokes grow and retract, never snap.
        const reach = smooth(n) * (0.55 + 1.35 * energy);
        const inner = r * 1.03;
        const outer = r * (1.12 + reach);
        const fade = (0.05 + 0.40 * energy) * smooth(n) * alpha;
        if (fade <= 0.003) continue;

        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const grad = ctx.createLinearGradient(
          cx + cos * inner,
          cy + sin * inner,
          cx + cos * outer,
          cy + sin * outer,
        );
        // Three stops so the taper is gradual rather than a hard ramp.
        grad.addColorStop(0, `rgba(214, 255, 236, ${fade})`);
        grad.addColorStop(0.42, `rgba(110, 231, 183, ${fade * 0.5})`);
        grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = r * (0.02 + 0.045 * n);
        ctx.beginPath();
        ctx.moveTo(cx + cos * inner, cy + sin * inner);
        ctx.lineTo(cx + cos * outer, cy + sin * outer);
        ctx.stroke();
      }
      ctx.lineCap = 'round';

      // The disc, additive like everything else here — drawn normally its soft
      // edge sits over the glow and darkens it into a ring.
      // The disc. A smooth ramp from centre to edge just reads as a shaded
      // ball, so the core is held flat and blown out to white and the drop to
      // the limb is quick — light too bright to look at, not a sphere.
      // Painted out past the limb so its falloff overlaps where the spokes
      // begin; a gap between the two shows up as a dark ring.
      const discR = r * 1.18;
      const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, discR);
      disc.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      disc.addColorStop(0.29, `rgba(255, 255, 255, ${alpha})`);
      disc.addColorStop(0.42, `rgba(226, 255, 243, ${alpha})`);
      disc.addColorStop(0.58, `rgba(167, 243, 208, ${alpha})`);
      disc.addColorStop(0.72, `rgba(52, 211, 153, ${alpha})`);
      disc.addColorStop(0.82, `rgba(45, 205, 145, ${0.6 * alpha})`);
      disc.addColorStop(0.9, `rgba(52, 211, 153, ${0.28 * alpha})`);
      disc.addColorStop(1, 'rgba(52, 211, 153, 0)');
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(cx, cy, discR, 0, TAU);
      ctx.fill();

      ctx.restore();
    };

    const draw = (now: number) => {
      const live = playRef.current && !skipRef.current;
      const elapsed = (now - start) / 1000;
      const t = live ? elapsed : T_END + elapsed;

      if (!cuedRef.current && t >= T_SET) {
        cuedRef.current = true;
        onCueRef.current?.();
      }

      const cx = w / 2;
      const cy = h / 2;
      const maxDist = radius() + 40;

      /* ---- stars -------------------------------------------------- */
      const accel = span(t, 0, T_WARP);
      const decel = smooth(span(t, T_WARP, T_SETTLE));
      const warp = (0.1 + Math.pow(accel, 3) * 78) * (1 - easeOut(decel));

      // Under warp the frame is veiled rather than cleared, which is what
      // smears the streaks into trails. Once stopped we clear instead — an
      // opaque veil would sit on top of the night sky and hide it.
      if (decel < 1) {
        ctx.fillStyle = `rgba(0, 0, 0, ${lerp(1 - accel * 0.78, 1, decel)})`;
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }

      const recede = smooth(span(t, T_WARP * 0.88, T_SETTLE));
      const back = smooth(span(t, T_SET - 0.4, T_END));
      const hole = maxDist * 0.08 * smooth(span(t, 0, T_SETTLE * 0.6));

      // Binned by rounded alpha and width, then stroked a bin at a time —
      // a few dozen draw calls rather than one per star.
      paths.fill(null);
      const streakW = 0.8 + accel * 1.9;
      const dim = lerp(1, 0.1, recede);

      for (const s of stars) {
        const prev = s.dist;
        s.dist += s.speed * warp;
        if (s.dist > maxDist) {
          aim(s);
          s.dist = hole + Math.random() * (hole * 0.5 + 12);
          continue;
        }
        const from = Math.max(prev, hole);
        if (s.dist < hole) continue;

        const mine = clamp01((back - s.delay * 0.55) / 0.45);
        const twinkle = 0.55 + 0.45 * Math.sin(t * s.rate + s.phase);
        const alpha = s.bright * lerp(dim, twinkle, mine);

        const ai = Math.round(alpha * (ALPHA_STEPS - 1));
        if (ai <= 0) continue;

        const width = lerp(streakW, s.size, decel);
        const wi = Math.max(
          0,
          Math.min(
            WIDTH_STEPS - 1,
            Math.round(
              ((width - WIDTH_MIN) / (WIDTH_MAX - WIDTH_MIN)) *
                (WIDTH_STEPS - 1),
            ),
          ),
        );

        const key = ai * WIDTH_STEPS + wi;
        let path = paths[key];
        if (!path) {
          path = new Path2D();
          paths[key] = path;
        }
        path.moveTo(cx + s.cos * from, cy + s.sin * from);
        path.lineTo(cx + s.cos * s.dist, cy + s.sin * s.dist);
      }

      for (let key = 0; key < paths.length; key++) {
        const path = paths[key];
        if (!path) continue;
        ctx.strokeStyle = `rgba(255, 255, 255, ${
          Math.floor(key / WIDTH_STEPS) / (ALPHA_STEPS - 1)
        })`;
        ctx.lineWidth =
          WIDTH_MIN + ((key % WIDTH_STEPS) / (WIDTH_STEPS - 1)) * (WIDTH_MAX - WIDTH_MIN);
        ctx.stroke(path);
      }

      /* ---- sun ---------------------------------------------------- */
      const focus = smooth(span(t, T_WARP * 0.86, T_SETTLE));
      const setting = smooth(span(t, T_PULSE, T_SET));

      // Three beats, each smaller than the last. Gaussian bumps rather than a
      // rectified sine: a sine has a corner where it clips at zero, which the
      // rays showed up as a snap.
      let beat = 0;
      for (let i = 0; i < beatTimes.length; i++) {
        const d = (t - beatTimes[i]) / BEAT_WIDTH;
        beat += Math.exp(-d * d) * (1 - i * 0.26);
      }
      beat = clamp01(beat);

      const baseR = Math.min(w, h) * 0.15;
      const sunR = baseR * lerp(0.3, 1, easeOut(focus)) * (1 + beat * 0.16);
      const sunY = lerp(h * 0.42, h * 1.1, setting);
      const sunA = focus * (1 - setting * 0.92);
      drawSun(cx, sunY, sunR, sunA, beat, t);

      // Sky washes deeper emerald as the flare swells.
      const wash = washRef.current;
      if (wash) {
        wash.style.opacity = `${focus * (1 - setting) * (0.72 + beat * 0.55)}`;
      }

      const skyIn = smooth(span(t, T_WARP, T_SET));
      const night = nightRef.current;
      if (night) night.style.opacity = `${skyIn}`;
      const fade = fadeRef.current;
      if (fade) fade.style.opacity = `${skyIn}`;

      const glow = glowRef.current;
      if (glow) {
        const up = smooth(span(t, T_PULSE, T_END));
        glow.style.opacity = `${up * (0.72 + 0.28 * Math.sin(t * 0.9))}`;
      }

      /* ---- ridges ------------------------------------------------- */
      const rise = span(t, T_WARP * 0.82, T_SETTLE + 0.8);
      const travel = [44, 60, 76];
      const eases = [
        easeOut(clamp01(rise * 1.16)),
        easeOut(clamp01(rise * 1.07)),
        easeOut(rise),
      ];
      const drifts = [Math.sin(t * 0.16) * 9, Math.sin(t * 0.21 + 1.1) * -11, 0];
      for (let i = 0; i < 3; i++) {
        const el = ridgeRefs.current[i];
        if (!el) continue;
        // The translateY travel alone isn't guaranteed to clear a peak off
        // the bottom of every viewport height — tying opacity to the same
        // ease is what actually keeps the range out of frame at t=0.
        el.style.opacity = `${eases[i]}`;
        el.style.transform = `translate(${drifts[i]}px, ${
          (1 - eases[i]) * travel[i]
        }vh)`;
      }

      // Crest catches the light as the sun grazes it, then goes out.
      const rim = Math.sin(span(t, T_PULSE - 0.5, T_SET + 0.4) * Math.PI);
      for (let i = 0; i < 3; i++) {
        const el = crestRefs.current[i];
        if (!el) continue;
        const weight = i === 2 ? 1 : 0.45;
        el.style.opacity = `${(0.28 + rim * 0.62) * weight}`;
        el.style.strokeWidth = `${1.4 + rim * 2.4 * weight}`;
      }

      // Under capture the renderer owns the clock and calls draw itself.
      if (capturing) return;

      // Never pause mid-sequence — `cuedRef` only flips once the sequence has
      // reached the point of cueing the hero copy in, and scroll is still
      // locked at that point, so the canvas is guaranteed on-screen anyway.
      if (visible || !cuedRef.current) {
        raf = requestAnimationFrame(draw);
      } else {
        raf = 0;
      }
    };

    if (capturing) {
      (window as unknown as Record<string, unknown>).__sky = {
        renderAt: (seconds: number) => draw(start + seconds * 1000),
      };
    } else {
      raf = requestAnimationFrame(draw);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && raf === 0) raf = requestAnimationFrame(draw);
      },
      { threshold: 0 },
    );
    observer.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* black void the jump happens in */}
      <div className="absolute inset-0 bg-black" />

      {/* the settled night sky, brought up as the sun goes down */}
      <div
        ref={nightRef}
        className="absolute inset-0"
        style={{
          opacity: 0,
          background:
            'radial-gradient(120% 90% at 50% 15%, #0f3a2a 0%, #0a2a1e 38%, #041712 68%, #020c09 100%)',
        }}
      />

      {/* stars and sun — under the ridges, so the sun sets behind them */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* broad emerald wash the sun throws across the sky */}
      <div
        ref={washRef}
        className="absolute inset-0"
        style={{
          opacity: 0,
          // Runs all the way out — stopping short leaves a visible ellipse
          // edge against the black.
          background:
            'radial-gradient(115% 85% at 50% 44%, rgba(34,197,94,0.24) 0%, rgba(20,150,105,0.13) 30%, rgba(12,122,85,0.05) 58%, transparent 100%)',
        }}
      />

      {/* resting emerald glow behind the summit */}
      <div
        ref={glowRef}
        className="absolute left-1/2 top-[18%] h-[420px] w-[620px] max-w-[90vw] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          opacity: 0,
          background:
            'radial-gradient(circle, #22C55E44 0%, #0C7A5522 45%, transparent 75%)',
        }}
      />

      {RIDGES.map((ridge, i) => (
        <svg
          key={i}
          ref={(el) => {
            ridgeRefs.current[i] = el;
          }}
          className={`absolute inset-x-0 bottom-0 w-full ${ridge.heightClass}`}
          style={{ opacity: 0 }}
          viewBox={`0 0 ${RIDGE_WIDTH} ${ridge.height}`}
          preserveAspectRatio="none"
        >
          <defs>
            {/* Rock tone: paler toward the crest where the sky lights it. */}
            <linearGradient id={`rock${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={['#2c4e3d', '#1f3b2e', '#122418'][i]} />
              <stop offset="1" stopColor={['#16291f', '#0e1d15', '#05100a'][i]} />
            </linearGradient>
            {/* Snow caps. The band has to die out just below the peak line
                or it blankets the whole range and the near ridges wash pale —
                only the tips should poke into it, saddles stay bare rock. */}
            <linearGradient id={`snow${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset={SNOW[i].start}
                stopColor="#e6f2ea"
                stopOpacity={SNOW[i].opacity}
              />
              <stop
                offset={(SNOW[i].start + SNOW[i].end) / 2}
                stopColor="#d2e4d9"
                stopOpacity={SNOW[i].opacity * 0.22}
              />
              <stop offset={SNOW[i].end} stopColor="#d2e4d9" stopOpacity="0" />
            </linearGradient>
            {/* Aerial perspective: distance fills with sky-coloured haze. */}
            <linearGradient id={`haze${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0a2a1e" stopOpacity="0" />
              <stop offset="1" stopColor="#0a2a1e" stopOpacity={[0.62, 0.4, 0.2][i]} />
            </linearGradient>
            {/* Each slope face is a quad dropped to the base, so left alone
                they stack up as vertical columns. Fading them out below the
                crest leaves only the lit upper slopes reading as relief. */}
            <linearGradient id={`facetFade${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="1" />
              <stop offset="0.24" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="0.52" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={`facetMask${i}`}>
              <rect
                x="0"
                y="0"
                width={RIDGE_WIDTH}
                height={ridge.height}
                fill={`url(#facetFade${i})`}
              />
            </mask>
            <clipPath id={`clip${i}`}>
              <path d={ridge.path} />
            </clipPath>
          </defs>

          <path d={ridge.path} fill={`url(#rock${i})`} />
          {/* Slope faces, lit by how squarely each turns toward the sky —
              this is what gives the range relief rather than a flat cut-out. */}
          <g mask={`url(#facetMask${i})`}>
            {ridge.facets.map((facet) => (
              <path
                key={facet.shade}
                d={facet.d}
                fill={mixHex(FACET_DARK[i], FACET_LIT[i], facet.shade)}
              />
            ))}
          </g>
          <g clipPath={`url(#clip${i})`}>
            <rect
              x="0"
              y="0"
              width={RIDGE_WIDTH}
              height={ridge.height}
              fill={`url(#snow${i})`}
            />
            <rect
              x="0"
              y="0"
              width={RIDGE_WIDTH}
              height={ridge.height}
              fill={`url(#haze${i})`}
            />
          </g>
          <path
            ref={(el) => {
              crestRefs.current[i] = el;
            }}
            d={ridge.crest}
            fill="none"
            stroke="#34D399"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ))}

      {/* soft fade into the light page below */}
      <div
        ref={fadeRef}
        data-sky-fade
        className="absolute inset-x-0 bottom-0 h-24"
        style={{
          opacity: 0,
          background:
            'linear-gradient(to bottom, transparent, hsl(var(--background)))',
        }}
      />
    </div>
  );
}
