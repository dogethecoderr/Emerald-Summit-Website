import { useEffect, useRef } from 'react';

/**
 * Mounts a Hairline figure (public/hairline/<name>.js) on the page, the way
 * the package's bench does, with the kernel left exactly as shipped.
 *
 * The kernel is a classic script that defines `HL`; each figure is a module
 * that ends by calling `hairline({ … })`. Figures load one at a time, so the
 * global `hairline` hook always hands the right figure to the right host.
 * The palette comes from the page's tokens through the kernel's own
 * `--hairline-*` variables (landing.css), so both themes follow the site.
 */

interface Figure {
  name: string;
  means: string;
  range: [number, number, number];
  tour: ([number, number] | null)[] | null;
  mount: (
    host: { stage: HTMLElement; svg: SVGSVGElement; read: { textContent: string | null } },
    value: number,
  ) => { set: (v: number) => void; show?: (i: number) => void; destroy: () => void };
}

interface HL {
  inject: (root: Document) => void;
  mk: (tag: string, attrs: Record<string, string>, parent: Element) => SVGSVGElement;
  tour: (stage: HTMLElement, stops: ([number, number] | null)[], onStop?: (i: number) => void) => { stop: () => void };
  LAP: ([number, number] | null)[];
}

interface Registry {
  /** Tags this page's figure-script URLs, so a script is always run fresh if it has to load again. */
  v: number;
  kernel: Promise<void> | null;
  queue: Promise<unknown>;
  figures: Map<string, Promise<Figure>>;
}

declare global {
  interface Window {
    HL?: HL;
    hairline?: (f: Figure) => void;
    __hairline?: Registry;
  }
}

const BASE = '/hairline/';

/**
 * Kept on the window, not in this module: a browser runs a module script once
 * per page, so if a hot update re-evaluated this file with fresh caches, the
 * figure scripts would never run again and the figures would never mount.
 */
const registry = (): Registry =>
  (window.__hairline ??= { v: Date.now(), kernel: null, queue: Promise.resolve(), figures: new Map() });

function script(src: string, module: boolean) {
  return new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    if (module) el.type = 'module';
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`hairline: could not load ${src}`));
    document.head.appendChild(el);
  });
}

function loadFigure(name: string): Promise<Figure> {
  const reg = registry();
  const cached = reg.figures.get(name);
  if (cached) return cached;
  reg.kernel ??= (window.HL ? Promise.resolve() : script(`${BASE}kernel.js`, false)).then(() => window.HL!.inject(document));
  const p = reg.kernel.then(() => {
    const next = reg.queue.then(
      () =>
        new Promise<Figure>((resolve, reject) => {
          window.hairline = resolve;
          script(`${BASE}${name}.js?v=${reg.v}`, true).catch(reject);
        }),
    );
    reg.queue = next.catch(() => undefined);
    return next;
  });
  reg.figures.set(name, p);
  return p;
}

export default function HairlineFigure({
  name,
  label,
  onRead,
  onPick,
  intensity = 0.5,
  steps = 0,
  className,
}: {
  name: string;
  /** What the figure shows, for people who can't see it. */
  label: string;
  /** The figure's read-out: "rest", or what is under the pointer. */
  onRead?: (text: string) => void;
  /** A click on one of the figure's parts: its 0-based index. */
  onPick?: (index: number) => void;
  /** 0 to 1, mapped onto the figure's own range as the bench's slider does. */
  intensity?: number;
  /**
   * Step through this many parts as the page scrolls through the figure's
   * section, first part at its top, last at its bottom. 0 leaves it to the
   * pointer and the one-lap tour.
   */
  steps?: number;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let handle: ReturnType<Figure['mount']> | null = null;
    let playing: { stop: () => void } | null = null;
    let io: IntersectionObserver | null = null;
    let cancelled = false;
    let onScroll: (() => void) | null = null;
    const picked = (e: Event) => onPickRef.current?.((e as CustomEvent<number>).detail);
    stage.addEventListener('hairline:pick', picked);

    loadFigure(name)
      .then((figure) => {
        if (cancelled || !window.HL) return;
        const HLk = window.HL;
        const [lo, mid, hi] = figure.range;
        const value = intensity <= 0.5 ? lo + (intensity / 0.5) * (mid - lo) : mid + ((intensity - 0.5) / 0.5) * (hi - mid);
        stage.setAttribute('data-hairline', figure.name);
        const svg = HLk.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, stage);
        let text: string | null = null;
        const read = {
          get textContent() { return text; },
          set textContent(v: string | null) { text = v == null ? '' : String(v); onReadRef.current?.(text); },
        };
        handle = figure.mount({ stage, svg, read }, value);
        if (text === null) read.textContent = 'rest';

        // Scroll-driven: the section is a tall track whose content stays pinned
        // (.lp-pin in landing.css), and the scroll through it is split evenly
        // between the parts. Only a change of step calls show, so a hover or
        // tap holds until the next step.
        if (steps > 0 && handle.show) {
          const show = handle.show;
          const section = stage.closest('section') ?? stage;
          let step = -1;
          // Browsers already fire scroll at most once a frame, and this is one rect read.
          onScroll = () => {
            const r = section.getBoundingClientRect(), vh = window.innerHeight;
            if (r.bottom < 0 || r.top > vh) return;
            const p = -r.top / Math.max(1, r.height - vh);
            const next = Math.min(steps - 1, Math.max(0, Math.floor(p * steps)));
            if (next !== step) { step = next; show(next); }
          };
          window.addEventListener('scroll', onScroll, { passive: true });
          window.addEventListener('resize', onScroll);
          onScroll();
          return;
        }

        // One lap of the figure's own tour the first time it comes into view,
        // so the story plays once; a real pointer takes over at any moment.
        const stops = figure.tour ?? HLk.LAP;
        io = new IntersectionObserver(([e]) => {
          if (!e.isIntersecting || playing) return;
          io?.disconnect();
          playing = HLk.tour(stage, stops, (i) => {
            if (stops[i] === null) { playing?.stop(); }
          });
        }, { threshold: 0.6 });
        io.observe(stage);
        // Once a real hand arrives, the tour is over for good: it never takes a
        // clicked or hovered choice back.
        const handsOn = () => { io?.disconnect(); playing?.stop(); playing = { stop: () => {} }; };
        stage.addEventListener('pointerenter', handsOn, { once: true });
        stage.addEventListener('pointerdown', handsOn, { once: true });
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
      stage.removeEventListener('hairline:pick', picked);
      if (onScroll) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
      io?.disconnect();
      playing?.stop();
      handle?.destroy();
      stage.replaceChildren();
    };
  }, [name, intensity, steps]);

  return <div ref={stageRef} className={className} role="img" aria-label={label} />;
}
