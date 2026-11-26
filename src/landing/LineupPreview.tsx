// "Who makes the Summit happen?" on the landing page: a slideshow of the
// Lineup page's sections (Keynote, Sponsors, Experts, Team, in its order), each
// a live, scaled-down copy of the real section fading out toward the bottom,
// with a "View …" button that opens /lineup on that section.
//
// Kept light: the copies load only when the section nears the screen (their
// module is split out), they're static (inert, no buttons, so the sponsor
// form never preloads), the slides cross-fade on opacity alone, and the
// slideshow only advances while it's on screen, the tab is visible and nobody
// is hovering or focused in it; never by itself under reduced motion.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { ArrowRight } from '@/components/icons';
import { cn } from '@/lib/utils';

const SLIDES = [
  { id: 'keynote', title: 'Keynote' },
  { id: 'sponsors', title: 'Sponsors' },
  { id: 'experts', title: 'Experts' },
  { id: 'team', title: 'Team' },
] as const;
type SlideId = (typeof SLIDES)[number]['id'];

/** How long each slide shows before the next. */
export const SLIDE_MS = 6000;
/** The copies are laid out at this width, then scaled to fit the frame. */
const PAGE_W = 1200;

const LineupBody = lazy(() => import('../components/LineupSections').then((m) => ({ default: m.LineupBody })));

export default function LineupPreview() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [scale, setScale] = useState(0.5);
  const section = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);

  // Load the copies once the section is within ~a screen; advance only while it's actually showing.
  useEffect(() => {
    const el = section.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const nearIo = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '600px 0px' });
    const seenIo = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.35 });
    nearIo.observe(el);
    seenIo.observe(el);
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      nearIo.disconnect();
      seenIo.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Fit the 1200px-wide copies to the frame.
  useEffect(() => {
    const el = frame.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setScale(Math.max(0.2, el.clientWidth / PAGE_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const playing = !reduce && onScreen && !held && !hidden;
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [playing, active]);

  const open = (id: SlideId) => navigate('/lineup', { state: { scrollTo: id } });
  const current = SLIDES[active];

  return (
    <section
      ref={section}
      id="lineup"
      className="lp-section lp-preview"
      aria-labelledby="lineup-title"
      aria-roledescription="carousel"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setHeld(false)}
    >
      <div className="container">
        <div className="lp-head lp-head--row">
          <h2 id="lineup-title">Who makes the Summit happen?</h2>
          <div className="lp-preview__tabs" role="tablist" aria-label="Lineup sections">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`lineup-tab-${s.id}`}
                aria-selected={i === active}
                aria-controls="lineup-slide"
                className="lp-preview__tab"
                onClick={() => setActive(i)}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>

        <div className="lp-preview__frame" ref={frame} id="lineup-slide" role="tabpanel" aria-labelledby={`lineup-tab-${current.id}`}>
          {/* The copies are pictures, not part of the page: hidden from screen readers and unclickable. */}
          <div className="lp-preview__slides" aria-hidden ref={(el) => { if (el) el.inert = true; }}>
            {SLIDES.map((s, i) => (
              <div key={s.id} className={cn('lp-preview__slide', i === active && 'is-active')}>
                <div className="lp-preview__page" style={{ width: PAGE_W, transform: `scale(${scale})` }}>
                  <div className="lp-head">
                    <p className="lp-preview__heading">{s.title}</p>
                  </div>
                  {near && (
                    <Suspense fallback={null}>
                      <LineupBody id={s.id} preview />
                    </Suspense>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="lp-preview__bar">
            <p className="lp-preview__count num" aria-live="polite">
              {String(active + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')} · {current.title}
            </p>
            <button type="button" className="lp-btn" onClick={() => open(current.id)}>
              View {current.title.toLowerCase()} <ArrowRight aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
