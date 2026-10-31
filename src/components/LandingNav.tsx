import ThemeToggle from './ThemeToggle';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import BrandMark from './BrandMark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SECTION_LINKS = [
  { id: 'about', label: 'About' },
  { id: 'universes', label: 'Tracks' },
  { id: 'faq', label: 'FAQ' },
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
 * Sticky marketing navbar shared by the landing page and the /app showcase.
 * "About"/"Universes" are anchors on "/" — when triggered from elsewhere
 * they route home and pass the target id via nav state, which WelcomePage
 * picks up on mount to finish the scroll.
 */
export default function LandingNav({
  overlay = false,
  entered,
  entranceDelay = 0,
}: LandingNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // Solid while parked at the top; only once the page moves does the bar go
  // translucent and let content blur past underneath it.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overlay]);

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
        'z-40 border-b transition-colors duration-300',
        overlay ? 'fixed inset-x-0 top-0' : 'sticky top-0',
        // `#30493e` is the exact colour the old translucent bar composited to
        // over the light page background, so parked-at-top looks unchanged —
        // just now with stars behind it instead of white.
        overlay && !scrolled
          ? 'border-white/5 bg-[#30493e]/95'
          : 'border-white/10 bg-[#0d2a1e]/85 backdrop-blur-xl',
      )}
      initial={entered === undefined ? false : { y: '-105%' }}
      animate={{ y: entered === false ? '-105%' : 0 }}
      transition={{
        duration: 0.5,
        delay: entered ? entranceDelay : 0,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-6 lg:h-20 lg:px-14">
        <BrandMark
          logoClassName="h-8 w-8 lg:h-10 lg:w-10"
          titleClassName="text-sm font-semibold tracking-tight text-white lg:text-base"
          showSubtitle={false}
          gap="gap-2.5"
        />

        <nav className="hidden items-center gap-1 md:flex">
          {SECTION_LINKS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goToSection(s.id)}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              {s.label}
            </button>
          ))}
          <Link
            to="/app"
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10',
              location.pathname === '/app'
                ? 'text-emerald-300'
                : 'text-white/70 hover:text-white',
            )}
          >
            App
          </Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle tone="onDark" />
          <Button
            className="h-10 rounded-full bg-white px-6 text-sm font-semibold text-emerald-950 hover:bg-white/90"
            onClick={() => navigate('/home')}
          >
            Sign in
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg p-2 text-white md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[#0d2a1e]/95 px-6 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            <ThemeToggle tone="onDark" labels className="mb-2 self-start" />
            {SECTION_LINKS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goToSection(s.id)}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
              >
                {s.label}
              </button>
            ))}
            <Link
              to="/app"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
            >
              App
            </Link>
            <Button
              className="mt-2 h-11 w-full rounded-full bg-white text-sm font-semibold text-emerald-950 hover:bg-white/90"
              onClick={() => {
                setOpen(false);
                navigate('/home');
              }}
            >
              Sign in
            </Button>
          </div>
        </div>
      )}
    </motion.header>
  );
}
