import ThemeToggle from './ThemeToggle';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { EASE_OUT_ARRAY } from '@/lib/motion';
import { ChevronDown, Menu, X } from '@/components/icons';
import BrandMark from './BrandMark';
import { NAV_LOGO_ATTR, playSummit27Intro } from './Summit27Intro';
import { cn } from '@/lib/utils';
import { jumpToSection } from '../landing/jumpToSection';

/** Keynote, Experts and Team live on their own page (KeynoteTeamPage); the rest are sections of "/". */
const LINEUP_PATH = '/lineup';
type SectionLink = { id: string; label: string; path?: string };
/** Grouped under one "Summit '27" menu so the bar isn't nine links wide. */
const SUMMIT_LINKS: SectionLink[] = [
  // All four live on the Lineup page, in its order.
  { id: 'keynote', label: 'Keynote', path: LINEUP_PATH },
  { id: 'sponsors', label: 'Sponsors', path: LINEUP_PATH },
  { id: 'experts', label: 'Experts', path: LINEUP_PATH },
  { id: 'team', label: 'Team', path: LINEUP_PATH },
];
const SUMMIT_LABEL = "Summit '27";
const SECTION_LINKS: (SectionLink | 'summit')[] = [
  { id: 'about', label: 'About' },
  { id: 'disciplines', label: 'Disciplines' },
  'summit',
  { id: 'faq', label: 'FAQ' },
  { id: 'donate', label: 'Donate' },
  { id: 'contact', label: 'Contact' },
];

interface LandingNavProps {
  /**
   * Float above the page instead of taking layout space, so the hero's night
   * sky runs behind the bar rather than the light page background showing
   * through it.
   */
  overlay?: boolean;
  /**
   * Drives the slide-down entrance. Leave undefined for no entrance at all
   * (the bar is simply there); pass `false` to park it above the viewport and
   * `true` to drop it in. Timed off the caller's reveal, not off mount.
   */
  entered?: boolean;
  /** Seconds to hold after `entered` flips before the bar drops. */
  entranceDelay?: number;
}

/**
 * Marketing nav shared by the landing page and the /app showcase: an
 * edge-aligned bar, clear over the sky and solid once the page moves, with
 * Sign in always in reach. "About"/"Universes"/"FAQ"/"Contact" are
 * anchors on "/"; from elsewhere they route home and pass the target id via
 * nav state, which WelcomePage picks up on mount to finish the scroll.
 */
export default function LandingNav({
  overlay = false,
  entered,
  entranceDelay = 0,
}: LandingNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [summitOpen, setSummitOpen] = useState(false);
  const summitBtnRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // The phone menu: Escape closes it and hands focus back to its button;
  // opening it moves focus to its first link.
  useEffect(() => {
    if (!open) return;
    sheetRef.current?.querySelector<HTMLElement>('.lp-nav__link')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      menuBtnRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  // Clear over the sky while parked at the top; solid once the page moves.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goToSection = (id: string, path = '/') => {
    setOpen(false);
    setSummitOpen(false);
    if (location.pathname === path) {
      jumpToSection(id);
    } else {
      navigate(path, { state: { scrollTo: id } });
    }
  };
  // The first Summit '27 link of the browser session plays the portal's Summit '27 intro (Summit27Intro.tsx).
  const goToSummitLink = (l: SectionLink) => {
    setOpen(false);
    setSummitOpen(false);
    playSummit27Intro(() => goToSection(l.id, l.path));
  };

  return (
    <motion.header
      className={cn(
        'lp lp-night lp-nav',
        overlay && 'lp-nav--overlay',
        (scrolled || open) && 'is-scrolled',
      )}
      initial={entered === undefined ? false : { transform: 'translateY(-105%)' }}
      animate={{ transform: entered === false ? 'translateY(-105%)' : 'translateY(0%)' }}
      transition={{
        duration: 0.5,
        delay: entered ? entranceDelay : 0,
        ease: EASE_OUT_ARRAY,
      }}
    >
      <div className="lp-nav__track">
        <div className="lp-nav__bar">
          <div className="container lp-nav__inner">
            <BrandMark
              logoClassName="h-9 w-9 lg:h-10 lg:w-10"
              titleClassName="text-base font-semibold tracking-tight text-white lg:text-[17px]"
              showSubtitle={false}
              gap="gap-2.5"
              logoProps={{ [NAV_LOGO_ATTR]: '' }}
            />

            <nav className="lp-nav__links" aria-label="Main">
              {SECTION_LINKS.map((s) =>
                s === 'summit' ? (
                  <div
                    key="summit"
                    className="lp-nav__group"
                    onMouseEnter={() => setSummitOpen(true)}
                    onMouseLeave={() => setSummitOpen(false)}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSummitOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Escape' || !summitOpen) return;
                      setSummitOpen(false);
                      summitBtnRef.current?.focus();
                    }}
                  >
                    {/* Opens (never toggles) on click, so a click after hover-open doesn't shut it. */}
                    <button
                      ref={summitBtnRef}
                      type="button"
                      className="lp-nav__link"
                      aria-expanded={summitOpen}
                      aria-controls="lp-nav-summit"
                      onClick={() => setSummitOpen(true)}
                    >
                      {SUMMIT_LABEL}
                      <ChevronDown className="lp-nav__caret" aria-hidden="true" />
                    </button>
                    {summitOpen && (
                      <div id="lp-nav-summit" className="lp-nav__dropdown">
                        <div className="lp-nav__dropdown-panel">
                          {SUMMIT_LINKS.map((l) => (
                            <button key={l.id} type="button" className="lp-nav__link" onClick={() => goToSummitLink(l)}>
                              {l.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goToSection(s.id, s.path)}
                    className="lp-nav__link"
                  >
                    {s.label}
                  </button>
                ),
              )}
            </nav>

            <div className="lp-nav__actions">
              <ThemeToggle tone="onDark" />
              <button
                type="button"
                className="lp-btn lp-btn--quiet"
                onClick={() => navigate('/home')}
              >
                Sign in
              </button>
            </div>

            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              ref={menuBtnRef}
              className="lp-nav__menu-btn"
              aria-label="Toggle menu"
              aria-expanded={open}
              aria-controls="lp-nav-sheet"
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        <AnimatePresence>
        {open && (
          <motion.div
            id="lp-nav-sheet"
            ref={sheetRef}
            className="lp-nav__sheet"
            initial={reduceMotion ? false : { opacity: 0, transform: 'translateY(-8px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transform: 'translateY(-8px)', transition: { duration: 0.15 } }}
            transition={{ duration: 0.22, ease: EASE_OUT_ARRAY }}
          >
            <div className="container lp-nav__sheet-list">
              <ThemeToggle tone="onDark" labels className="mb-2 self-start" />
              {SECTION_LINKS.map((s) =>
                s === 'summit' ? (
                  <div key="summit" role="group" aria-labelledby="lp-nav-sheet-summit" className="lp-nav__sheet-group">
                    <p id="lp-nav-sheet-summit" className="lp-nav__sheet-label">{SUMMIT_LABEL}</p>
                    {SUMMIT_LINKS.map((l) => (
                      <button key={l.id} type="button" onClick={() => goToSummitLink(l)} className="lp-nav__link">
                        {l.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goToSection(s.id, s.path)}
                    className="lp-nav__link"
                  >
                    {s.label}
                  </button>
                ),
              )}
              <button
                type="button"
                className="lp-btn"
                onClick={() => {
                  setOpen(false);
                  navigate('/home');
                }}
              >
                Sign in
              </button>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
