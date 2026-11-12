import ThemeToggle from './ThemeToggle';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Menu, X } from '@/components/icons';
import BrandMark from './BrandMark';
import { cn } from '@/lib/utils';

const SECTION_LINKS = [
  { id: 'about', label: 'About' },
  { id: 'universes', label: 'Universes' },
  { id: 'faq', label: 'FAQ' },
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

  const goToSection = (id: string) => {
    setOpen(false);
    if (location.pathname === '/') {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate('/', { state: { scrollTo: id } });
    }
  };

  return (
    <motion.header
      className={cn(
        'lp lp-night lp-nav',
        overlay && 'lp-nav--overlay',
        (scrolled || open) && 'is-scrolled',
      )}
      initial={entered === undefined ? false : { y: '-105%' }}
      animate={{ y: entered === false ? '-105%' : 0 }}
      transition={{
        duration: 0.5,
        delay: entered ? entranceDelay : 0,
        ease: [0.16, 1, 0.3, 1],
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
            />

            <nav className="lp-nav__links" aria-label="Main">
              {SECTION_LINKS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToSection(s.id)}
                  className="lp-nav__link"
                >
                  {s.label}
                </button>
              ))}
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
            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -8, transition: { duration: 0.15 } }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="container lp-nav__sheet-list">
              <ThemeToggle tone="onDark" labels className="mb-2 self-start" />
              {SECTION_LINKS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToSection(s.id)}
                  className="lp-nav__link"
                >
                  {s.label}
                </button>
              ))}
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
