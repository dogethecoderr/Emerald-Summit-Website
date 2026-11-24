import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SummitLogo from './SummitLogo';
import { reducedMotion } from './verse/useCircleReveal';
import { EASE_IN_OUT, EASE_OUT } from '@/lib/motion';

/* Timeline, in ms (about 1.8 s in all). */
const BLUR_MS = 340; // the page you're on blurs out
const SWAP_AT = 300; // ...and Summit '27 opens underneath once it's hidden
const RISE_DELAY = 120; // the logo starts rising while the blur comes in
const RISE_MS = 720;
const HOLD_MS = 140; // the logo rests in the middle of the screen
const FLY_MS = 720; // ...then glides into the Support EAF card as the blur clears
const ROLL_MS = 480; // each letter of the "Summit '27" heading rolling in
const ROLL_STAGGER = 32;
const WAIT_MAX_MS = 4000; // longest to wait for Summit '27 to load before clearing anyway

/** The Support EAF card's logo on Summit '27, where the flying logo lands. */
export const EAF_LOGO_ATTR = 'data-summit-eaf-logo';
/** The landing navbar's logo: where it lands on public pages, which have no Support EAF card. */
export const NAV_LOGO_ATTR = 'data-summit-nav-logo';
/** The "Summit '27" heading, whose letters roll in as the blur clears. */
export const ROLL_ATTR = 'data-summit-roll';
/** On <body> while the intro runs: hides that logo and heading until their turn (index.css). */
const BODY_CLASS = 'summit-intro';
/** sessionStorage: the intro plays once per browser session. */
const PLAYED_KEY = 'summit27-intro-played';

const listeners = new Set<(go: () => void) => void>();

function playedThisSession(): boolean {
  try {
    return sessionStorage.getItem(PLAYED_KEY) === '1';
  } catch {
    return false;
  }
}

function markPlayed() {
  try {
    sessionStorage.setItem(PLAYED_KEY, '1');
  } catch {
    // Storage blocked: it may play again, which is harmless.
  }
}

/**
 * Opens Summit '27 with its intro: the sidebar tab calls this instead of
 * navigating. The intro plays once per browser session; after that, without
 * the host mounted, or under reduced motion, it's a plain navigation (the
 * caller passes its own `navigate`).
 */
export function openSummit27(to: string, navigate: (to: string) => void) {
  playSummit27Intro(() => navigate(to));
}

/**
 * Runs `go` (the navigation) under the intro the first time this browser
 * session, or straight away otherwise. The landing navbar's Summit '27 menu
 * uses it so its links can carry their scroll-to-section state.
 */
export function playSummit27Intro(go: () => void) {
  if (listeners.size === 0 || reducedMotion() || playedThisSession()) {
    go();
    return;
  }
  markPlayed();
  listeners.forEach((l) => l(go));
}

/**
 * Summit '27's intro, mounted once above the routes so it can start on the
 * page you clicked from: that page blurs out and a sun comes up at the
 * bottom edge and expands a little, the Summit logo rises into the middle,
 * Summit '27 opens underneath, then the logo glides into its place in the
 * Support EAF card and the "Summit '27" heading rolls in, letter by letter,
 * as the blur clears. A click or Escape skips it.
 */
export default function Summit27IntroHost() {
  const [go, setGo] = useState<(() => void) | null>(null);
  useEffect(() => {
    const l = (next: () => void) => setGo((cur) => cur ?? next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (!go) return null;
  return <Intro go={go} onDone={() => setGo(null)} />;
}

function Intro({ go, onDone }: { go: () => void; onDone: () => void }) {
  const blur = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const flier = useRef<HTMLDivElement>(null);
  const riser = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  const skip = useRef<() => void>(() => {});
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const goRef = useRef(go);
  goRef.current = go;

  useLayoutEffect(() => {
    const b = blur.current;
    const g = glow.current;
    const f = flier.current;
    const r = riser.current;
    const h = halo.current;
    let ended = false;
    let swapped = false;
    const running: Animation[] = [];
    const timers: number[] = [];
    let frame = 0;
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const swap = () => {
      if (swapped) return;
      swapped = true;
      goRef.current();
    };
    const stop = () => {
      timers.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(frame);
      running.forEach((a) => a.cancel());
    };
    const end = () => {
      if (ended) return;
      ended = true;
      stop();
      swap();
      doneRef.current();
    };
    skip.current = end;
    if (!b || !g || !f || !r || !h || typeof b.animate !== 'function') {
      end();
      return;
    }
    const play = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
      const a = el.animate(frames, opts);
      running.push(a);
      return a;
    };

    const vh = window.innerHeight;
    const size = f.offsetWidth;

    // 1. The page you're on blurs out, and a sun comes up at the bottom edge,
    //    then keeps expanding a little until the logo sets off.
    play(b, [{ opacity: 0 }, { opacity: 1 }], { duration: BLUR_MS, easing: 'ease-out', fill: 'forwards' });
    const sunMs = RISE_DELAY + RISE_MS + HOLD_MS + FLY_MS * 0.4;
    play(
      g,
      [
        { opacity: 0, transform: 'translateY(16%) scale(0.5)', easing: EASE_OUT },
        { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.35, easing: 'ease-in-out' },
        { opacity: 1, transform: 'translateY(0) scale(1.12)' },
      ],
      { duration: sunMs, fill: 'forwards' },
    );
    later(swap, SWAP_AT);

    // 2. The logo rises from below the screen to the middle.
    const rise = play(
      r,
      [
        { transform: `translateY(${vh / 2 + size}px) scale(0.72)`, opacity: 0 },
        { opacity: 1, offset: 0.45 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ],
      { duration: RISE_MS, delay: RISE_DELAY, easing: EASE_OUT, fill: 'both' },
    );
    play(h, [{ opacity: 0 }, { opacity: 1 }], {
      duration: RISE_MS,
      delay: RISE_DELAY + RISE_MS * 0.4,
      easing: 'ease-out',
      fill: 'both',
    });

    // 3. Glide to the Support EAF card's logo and clear the blur. Summit '27
    //    may still be loading, so wait (a frame at a time) for that logo.
    const clear = (opts: KeyframeAnimationOptions) => {
      play(h, [{ opacity: 1 }, { opacity: 0 }], { duration: FLY_MS * 0.6, easing: EASE_OUT, fill: 'forwards' });
      play(b, [{ opacity: 1 }, { opacity: 0 }], opts);
      play(g, [{ opacity: 1 }, { opacity: 0 }], opts);
      rollHeading();
    };
    // The heading's letters roll up into place, left to right. Not in
    // `running`: they finish on their own after the intro has gone.
    const rollHeading = () => {
      const letters = document.querySelectorAll<HTMLElement>(`[${ROLL_ATTR}] > *`);
      letters.forEach((el, i) =>
        el.animate(
          [
            { opacity: 0, transform: 'translateY(0.6em) rotateX(-85deg)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: ROLL_MS, delay: FLY_MS * 0.3 + i * ROLL_STAGGER, easing: EASE_OUT, fill: 'backwards' },
        ),
      );
    };
    const fly = (spot: DOMRect) => {
      const from = f.getBoundingClientRect();
      const dx = spot.left - from.left;
      const dy = spot.top - from.top;
      const k = spot.width / from.width;
      // Below the fold (a short window): head for it and fade out on the way.
      const visible = spot.bottom > 0 && spot.top < window.innerHeight;
      const glide = play(
        f,
        [
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: visible ? 1 : 0 },
        ],
        { duration: FLY_MS, easing: EASE_IN_OUT, fill: 'forwards' },
      );
      clear({ duration: FLY_MS, delay: FLY_MS * 0.15, easing: 'ease-in-out', fill: 'forwards' });
      glide.finished.then(end, () => {});
    };
    const fadeAway = () => {
      const out = play(f, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.9)' }], {
        duration: 420,
        easing: EASE_OUT,
        fill: 'forwards',
      });
      clear({ duration: 520, easing: 'ease-in-out', fill: 'forwards' });
      out.finished.then(end, () => {});
    };
    let waited = 0;
    let found = 0;
    const seek = () => {
      if (ended) return;
      const el = document.querySelector(`[${EAF_LOGO_ATTR}]`) ?? document.querySelector(`[${NAV_LOGO_ATTR}]`);
      const spot = el?.getBoundingClientRect();
      if (spot && spot.width > 0) {
        // Two frames after it appears, so the page has laid out.
        if (++found >= 2) return fly(spot);
      } else if ((waited += 16) > WAIT_MAX_MS) {
        return fadeAway();
      }
      frame = requestAnimationFrame(seek);
    };
    rise.finished.then(() => later(seek, HOLD_MS), () => {});

    return stop;
  }, [go]);

  // The page stays put under the blur, the card's logo hides until the flying
  // one lands, and Escape skips the intro.
  useEffect(() => {
    const body = document.body;
    const overflow = body.style.overflow;
    body.style.overflow = 'hidden';
    body.classList.add(BODY_CLASS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      body.style.overflow = overflow;
      body.classList.remove(BODY_CLASS);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return createPortal(
    <div aria-hidden className="fixed inset-0 z-[60]" onClick={() => skip.current()}>
      <div
        ref={blur}
        className="absolute inset-0 bg-background/20 backdrop-blur-xl backdrop-saturate-150"
        style={{ opacity: 0 }}
      />
      {/* a sun centred on the bottom edge: a bright core with soft light
          pouring out of it (a wide blurred bloom behind a tighter one); the
          rest of the screen stays the blurred page */}
      <div
        ref={glow}
        className="absolute"
        style={{
          opacity: 0,
          width: '120vmin',
          height: '120vmin',
          left: 'calc(50% - 60vmin)',
          bottom: '-60vmin',
        }}
      >
        <div
          className="absolute -inset-[28%] rounded-full blur-2xl"
          style={{
            background:
              'radial-gradient(circle, rgb(240 253 244 / 0.92) 0%, rgb(187 247 208 / 0.7) 16%, rgb(110 231 183 / 0.45) 30%, rgb(52 211 153 / 0.22) 44%, rgb(16 185 129 / 0.08) 56%, transparent 67%)',
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgb(255 255 250) 0%, rgb(255 253 240 / 0.98) 7%, rgb(220 252 231 / 0.85) 13%, rgb(167 243 208 / 0.5) 22%, rgb(110 231 183 / 0.2) 32%, transparent 46%)',
          }}
        />
      </div>
      <div
        ref={flier}
        className="fixed h-[min(200px,40vw)] w-[min(200px,40vw)]"
        // Centred with left/top, so the glide's transform is the only one.
        style={{ left: 'calc(50% - min(100px, 20vw))', top: 'calc(50% - min(100px, 20vw))', transformOrigin: '0 0' }}
      >
        <div ref={riser} className="relative h-full w-full" style={{ opacity: 0 }}>
          <div
            ref={halo}
            className="absolute -inset-[45%] rounded-full"
            style={{
              opacity: 0,
              background: 'radial-gradient(circle, rgb(110 231 183 / 0.5) 0%, rgb(16 185 129 / 0.18) 38%, transparent 68%)',
            }}
          />
          <div className="relative h-full w-full drop-shadow-[0_12px_36px_rgb(2_44_34_/_0.35)]">
            <SummitLogo />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
