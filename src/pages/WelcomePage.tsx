import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { markIntroPlayed, shouldPlayIntro } from '../components/introSession';
import LandingNav from '../components/LandingNav';
import SkyVideo from '../components/SkyVideo';
import PhotoMosaic from '../components/PhotoMosaic';
import SummitLogo from '../components/SummitLogo';
import FaqSection from '../components/FaqSection';
import CtaBand from '../components/CtaBand';
import LandingFooter from '../components/LandingFooter';
import OrbitalUniverses from '../components/OrbitalUniverses';
import { USER_DISCIPLINES } from '../models/disciplines';
import { Button } from '@/components/ui/button';

const FACTS = [
  { icon: CalendarDays, text: 'January 2027' },
  { icon: Clock3, text: '9:00 AM – 5:00 PM' },
  { icon: MapPin, text: 'Emerald High School, Dublin, CA' },
];

const ABOUT_STATS = [
  { value: '20+', label: 'Tracks' },
  { value: '30+', label: 'Visiting experts' },
  { value: '6', label: 'Universes' },
  { value: '1', label: 'Day' },
];



/**
 * Container that cascades its children in. `custom` is the beat to hold
 * before the first child moves — long enough after the jump for the night
 * sky to stand alone for a moment, short on an ordinary load.
 */
const stagger: Variants = {
  hidden: {},
  show: (delayChildren: number) => ({
    transition: { staggerChildren: 0.09, delayChildren },
  }),
};

/** Soft rise used for most hero elements. */
const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

/**
 * Shared scroll-in for the sections below the hero. Trips as soon as a slice
 * of the block is on screen (rather than 80px past the edge), travels a
 * shorter distance over longer, and rides a gentle curve instead of the
 * hero's snappy expo — so things ease in as you scroll rather than popping.
 */
const scrollIn = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.95, ease: [0.22, 0.61, 0.36, 1] },
} as const;

/** Masked line that slides up from behind its clip. */
const lineReveal: Variants = {
  hidden: { y: '110%' },
  show: {
    y: '0%',
    transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] },
  },
};

/** Barely-there emerald wash under the "Emerald" line — still reads white. */
const EMERALD_GRADIENT =
  'linear-gradient(100deg, #ffffff 5%, #f2fdf8 45%, #d1fae5 95%)';
/** Emerald run under the "Summit" line. */
const SUMMIT_GRADIENT =
  'linear-gradient(100deg, #d1fae5 5%, #6ee7b7 45%, #22c55e 95%)';

/** Highlight colours for the sweep — pale emerald up top, white below. */
const GLINT_EMERALD = 'rgba(167, 243, 208, 0.95)';
const GLINT_WHITE = 'rgba(255, 255, 255, 0.92)';
/**
 * Hold before the lower line picks the sweep up, so one highlight appears to
 * travel from the "E" of Emerald through to the "t" of Summit.
 */
const GLINT_HANDOFF = '0.7s';

/** Narrow highlight band riding above the line's own gradient. */
function glintLayers(base: string, band: string) {
  return {
    backgroundImage: `linear-gradient(100deg, transparent 47%, ${band} 50%, transparent 53%), ${base}`,
    backgroundSize: '300% 100%, 100% 100%',
  };
}

/**
 * The sky cues us the moment the sun is down, so the copy arrives *with* the
 * returning stars rather than after them — only a short beat is needed here.
 */
const AFTER_INTRO_DELAY = 0.25;
/** Nav drops in just behind the copy, then scrolling is handed back. */
const NAV_DELAY = 1.2;
const UNLOCK_MS = 2200;

export default function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  // When the sequence plays, the page holds still and the copy waits for it.
  const [playingIntro] = useState(shouldPlayIntro);
  const [revealed, setRevealed] = useState(() => !shouldPlayIntro());
  const [locked, setLocked] = useState(playingIntro);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (playingIntro) markIntroPlayed();
  }, [playingIntro]);

  const skipIntro = () => {
    setSkipped(true);
    setRevealed(true);
  };

  // Hold the scroll position until the whole reveal has landed. The document
  // scroller here is <html>, so locking <body> alone would do nothing.
  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    const { body } = document;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevBehavior = html.style.scrollBehavior;

    // Snap to the top rather than smooth-scrolling there (the stylesheet sets
    // `scroll-behavior: smooth`, which would animate this).
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.scrollBehavior = prevBehavior;

    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [locked]);

  useEffect(() => {
    if (!revealed || !playingIntro) return;
    const id = setTimeout(() => setLocked(false), UNLOCK_MS);
    return () => clearTimeout(id);
  }, [revealed, playingIntro]);

  // Cross-route anchor nav: LandingNav sends { scrollTo: id } when the link
  // is clicked from a different route; finish the scroll once we've landed.
  useEffect(() => {
    const scrollTo = (location.state as { scrollTo?: string } | null)
      ?.scrollTo;
    if (!scrollTo) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(scrollTo)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    window.history.replaceState({}, '');
    return () => cancelAnimationFrame(frame);
  }, [location.state]);

  return (
    <div className="relative min-h-screen overflow-clip">
      <LandingNav
        overlay
        entered={playingIntro ? revealed : undefined}
        entranceDelay={NAV_DELAY}
      />

      {/* Stays for the whole sequence — halo behind it so it reads against
          both the black void and the lit sun. */}
      {playingIntro && !revealed && (
        <div className="fixed bottom-9 left-1/2 z-[110] -translate-x-1/2">
          <div
            className="pointer-events-none absolute -inset-4 rounded-full bg-black/60 blur-xl"
            aria-hidden
          />
          <button
            type="button"
            onClick={skipIntro}
            className="relative rounded-full border border-white/60 bg-white/10 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white backdrop-blur-md transition hover:border-white hover:bg-white/25"
          >
            Skip
          </button>
        </div>
      )}

      {/* dark night-sky hero band — fills the full viewport so nothing below peeks in on load */}
      <div className="relative min-h-screen overflow-hidden">
        <SkyVideo
          playIntro={playingIntro}
          skip={skipped}
          onCueContent={() => setRevealed(true)}
        />

        <div className="relative z-10 flex min-h-screen flex-col">
          <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-6 lg:px-14">
            <motion.section
              className="flex flex-1 flex-col items-center justify-center pb-20 pt-20 text-center lg:pb-28 lg:pt-24"
              variants={stagger}
              initial="hidden"
              animate={revealed ? 'show' : 'hidden'}
              custom={playingIntro ? AFTER_INTRO_DELAY : 0.15}
            >
              <motion.div
                variants={rise}
                className="h-10 w-10 opacity-95 lg:h-12 lg:w-12"
              >
                <SummitLogo />
              </motion.div>

              <motion.div
                variants={rise}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-emerald-200 backdrop-blur-sm lg:px-5 lg:py-2 lg:text-sm"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Summit ’27 · The Tri-Valley’s largest student-led STEAM conference
              </motion.div>

              <h1 className="mt-7 font-title text-6xl font-normal leading-[0.98] tracking-tight text-white sm:text-7xl md:text-8xl xl:text-9xl">
                <span className="block overflow-hidden pb-[0.06em]">
                  <motion.span
                    className={`block bg-clip-text text-transparent ${
                      reduceMotion ? '' : 'animate-glint'
                    }`}
                    style={
                      reduceMotion
                        ? { backgroundImage: EMERALD_GRADIENT }
                        : glintLayers(EMERALD_GRADIENT, GLINT_EMERALD)
                    }
                    variants={lineReveal}
                  >
                    Emerald
                  </motion.span>
                </span>
                <span className="mt-1 block overflow-hidden pb-[0.06em] sm:mt-2">
                  <motion.span
                    className={`block bg-clip-text text-transparent ${
                      reduceMotion ? '' : 'animate-glint'
                    }`}
                    style={
                      reduceMotion
                        ? { backgroundImage: SUMMIT_GRADIENT }
                        : {
                            ...glintLayers(SUMMIT_GRADIENT, GLINT_WHITE),
                            animationDelay: GLINT_HANDOFF,
                          }
                    }
                    variants={lineReveal}
                  >
                    Summit
                  </motion.span>
                </span>
              </h1>

              <motion.div
                variants={rise}
                className="mt-8 flex flex-wrap items-center justify-center gap-2.5"
              >
                {FACTS.map(({ icon: Icon, text }) => (
                  <span
                    key={text}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-semibold text-emerald-100 backdrop-blur-sm lg:px-6 lg:py-2.5 lg:text-[15px]"
                  >
                    <Icon className="h-3.5 w-3.5 opacity-80 lg:h-4 lg:w-4" />
                    {text}
                  </span>
                ))}
              </motion.div>

              <motion.div
                variants={rise}
                className="mt-10 flex flex-wrap items-center justify-center gap-3"
              >
                <Button
                  size="lg"
                  className="group h-12 rounded-full bg-emerald-400 px-8 text-[15px] font-semibold text-emerald-950 shadow-[0_0_40px_-8px_rgba(52,211,153,0.6)] transition-all duration-200 hover:scale-[1.04] hover:bg-emerald-300 hover:shadow-[0_0_56px_-8px_rgba(52,211,153,0.8)] active:scale-[0.98] lg:h-14 lg:px-12 lg:text-lg"
                  onClick={() => navigate('/home')}
                >
                  Get started
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1 lg:h-5 lg:w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-white/25 bg-white/5 px-8 text-[15px] font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:scale-[1.03] hover:bg-white/10 active:scale-[0.98] lg:h-14 lg:px-12 lg:text-lg"
                  onClick={() => navigate('/app')}
                >
                  Explore the app
                </Button>
              </motion.div>

              {/* discipline strip */}
              <motion.div variants={rise} className="relative mt-14">
                {/* soft blurred halo lifting the labels off the mountain ridgeline */}
                <div
                  className="absolute inset-[-20px] rounded-full bg-black/25 blur-2xl"
                  aria-hidden
                />
                <div className="relative flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                  {USER_DISCIPLINES.map((d) => (
                    <span
                      key={d.name}
                      className="inline-flex items-center gap-1.5 font-mono text-[12px] font-medium tracking-tight text-white/55 lg:gap-2 lg:text-[13px]"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full lg:h-2 lg:w-2"
                        style={{ background: d.color, boxShadow: `0 0 8px -1px ${d.color}` }}
                        aria-hidden
                      />
                      {d.label}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* scroll cue */}
              {!reduceMotion && (
                <motion.button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById('about')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className="mt-12 flex flex-col items-center gap-1 text-white/40 transition-colors hover:text-emerald-200"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: revealed ? 1 : 0 }}
                  transition={{ delay: revealed ? 1.2 : 0, duration: 0.8 }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em]">
                    Scroll
                  </span>
                  <motion.div
                    className="h-8 w-[1.5px] rounded-full bg-gradient-to-b from-emerald-300/70 to-transparent"
                    animate={{ scaleY: [0.4, 1, 0.4], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ transformOrigin: 'top' }}
                  />
                </motion.button>
              )}
            </motion.section>
          </div>
        </div>
      </div>

      <div className="relative mx-auto flex max-w-[1440px] flex-col px-6 lg:px-14">
        {/* about / event summary */}
        <section
          id="about"
          className="scroll-mt-20 py-20 lg:py-28 lg:scroll-mt-24"
        >
          <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16 xl:gap-24">
            <motion.div
              {...scrollIn}
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-emerald-mint">
                About the summit
              </p>
              <h2 className="mt-3 font-hero text-3xl font-bold leading-tight tracking-tight text-navy-bright sm:text-4xl lg:text-5xl">
                One summit. <span className="text-gradient-emerald">Six universes.</span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground lg:text-lg">
                Emerald Summit is the Tri-Valley’s largest student-led STEAM
                conference — a full day where hundreds of builders move between six
                disciplines (universes), pitch to visiting experts, and leave
                with something better than they started with.
              </p>
              
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="glow-emerald h-12 rounded-full bg-primary px-7 text-[15px] font-semibold hover:bg-emerald"
                  onClick={() => navigate('/home')}
                >
                  Get started <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-border/80 bg-secondary/30 px-7 text-[15px] font-semibold hover:border-emerald-glow/50 hover:bg-accent"
                  onClick={() => navigate('/app')}
                >
                  Explore the app
                </Button>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                {ABOUT_STATS.map((s) => (
                  <div
                    key={s.label}
                    className="glass rounded-2xl p-6 text-center"
                    style={{
                      borderColor: 'rgba(30, 58, 107, 0.65)',
                      borderWidth: '2px',
                    }}
                  >
                    <div className="font-hero text-3xl font-bold text-gradient-emerald lg:text-4xl">
                      {s.value}
                    </div>
                    <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              {...scrollIn}
              transition={{ ...scrollIn.transition, delay: 0.12 }}
            >
              <PhotoMosaic />
            </motion.div>
          </div>

          {/* when & where */}
          <motion.div
            className="mt-6 glass rounded-2xl p-6"
            {...scrollIn}
            transition={{ ...scrollIn.transition, delay: 0.24 }}
          >
            <h3 className="font-hero text-lg font-semibold">When &amp; where</h3>
            <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
              {FACTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-emerald-mint" /> {text}
                </li>
              ))}
            </ul>
          </motion.div>
        </section>
      </div>

      {/* six universes — scroll-driven orbit */}
      <OrbitalUniverses />

      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-14">
        <FaqSection />
      </div>

      <CtaBand />

      <LandingFooter />
    </div>
  );
}
