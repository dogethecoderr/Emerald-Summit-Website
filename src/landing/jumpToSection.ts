/**
 * Fired on window when a nav or footer scroll has landed, so the scroll-driven
 * pieces (OrbitalUniverses, HairlineFigure) catch up to where the page is now.
 */
export const SECTION_JUMP_EVENT = 'lp:section-jump';
/** Fired on window when a nav or footer scroll starts, so costly drawing (the planets' canvas) can pause for the trip. */
export const SECTION_JUMP_START_EVENT = 'lp:section-jump-start';

const FLAG = 'data-lp-jumping';
/** Scroll quiet this long counts as landed (Safari before 18.2 has no scrollend). */
const QUIET_MS = 140;
/** Never stay frozen longer than this, whatever happens. */
const MAX_MS = 4000;

/** True while a nav or footer scroll is under way: the scroll-driven sections hold still until it lands. */
export function isSectionJumping(): boolean {
  return document.documentElement.hasAttribute(FLAG);
}

let finish: (() => void) | null = null;

/**
 * Smooth-scroll to a landing-page section from the nav or footer without
 * setting off the pinned, scroll-driven sections it passes (Summit day's
 * terraces, the disciplines orbit, the role badges): they hold still on the
 * way, then catch up to the landing spot at once instead of playing through.
 */
export function jumpToSection(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  finish?.();
  const root = document.documentElement;
  root.setAttribute(FLAG, '');
  window.dispatchEvent(new Event(SECTION_JUMP_START_EVENT));

  let quiet = 0;
  const done = () => {
    window.clearTimeout(quiet);
    window.clearTimeout(cap);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('scrollend', done);
    window.removeEventListener('wheel', done);
    window.removeEventListener('touchstart', done);
    root.removeAttribute(FLAG);
    finish = null;
    window.dispatchEvent(new Event(SECTION_JUMP_EVENT));
  };
  const onScroll = () => {
    window.clearTimeout(quiet);
    quiet = window.setTimeout(done, QUIET_MS);
  };
  const cap = window.setTimeout(done, MAX_MS);
  finish = done;
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('scrollend', done);
  // The reader takes over (wheel or touch): give the sections back at once.
  window.addEventListener('wheel', done, { passive: true });
  window.addEventListener('touchstart', done, { passive: true });
  // Already there (no scroll will fire): land after a beat.
  quiet = window.setTimeout(done, QUIET_MS * 3);

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
