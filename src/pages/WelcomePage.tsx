import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { EASE_OUT_ARRAY } from '@/lib/motion';
import { markIntroPlayed, shouldPlayIntro } from '../components/introSession';
import LandingNav from '../components/LandingNav';
import SkyVideo from '../components/SkyVideo';
import FaqSection from '../components/FaqSection';
import OrbitalUniverses from '../components/OrbitalUniverses';
import PhotoMosaic from '../components/PhotoMosaic';
import LandingFooter from '../components/LandingFooter';
import DonateSection from '../landing/DonateSection';
import PhotoRail from '../landing/PhotoRail';
import HairlineFigure from '../landing/HairlineFigure';
import { SIGN_IN_ROLES } from '../models/roles';
import { DAY_PARTS, type DayPart } from '../landing/dayParts';
import SunArc from '../landing/SunArc';
import { Mail } from '@/components/icons';
import { useIsTouchScreen } from '../lib/device';
import '../landing/landing.css';
import { SUMMIT_ABOUT, SUMMIT_DATE_LABEL, SUMMIT_HOURS, VENUE } from '../models/summitFacts';
import { jumpToSection } from '../landing/jumpToSection';
import LineupPreview from '../landing/LineupPreview';

const CONTACT_EMAIL = 'contact@ehsacademics.org';

const ABOUT_STATS = [
  { value: '1', label: 'Day', note: 'One campus, Emerald High' },
  { value: '6', label: 'Disciplines', note: 'TechVerse to CivicVerse' },
  { value: '20+', label: 'Tracks', note: 'From Robothon to Mock Trial' },
  { value: '30+', label: 'Visiting experts', note: 'Giving feedback and leading the talks' },
];

/** The five roles anyone can sign in as, in the order the badges hang. */
const BADGE_ROLES = SIGN_IN_ROLES;

/**
 * Where a badge or role row leads: that role's sign-up. Admins have no sign-up
 * (the allowlist decides who is one), so theirs is Organizer sign in.
 */
const signUpPath = (role: string) => (role === 'admin' ? '/login/admin' : `/login/${role}?mode=signup`);

/** The owner's own photographs from the last Summit, in rail order. */
const DAY_PHOTOS: { n: number; alt: string; tall?: boolean }[] = [
  { n: 19, alt: 'Two students show their project to a visiting expert' },
  { n: 10, alt: 'Students gather around a robot they built' },
  { n: 13, alt: 'A student walks a visitor through her design project poster' },
  { n: 28, alt: 'A VentureVerse panel on stage in the lecture hall' },
  { n: 17, alt: 'Three students present to a visiting expert' },
  { n: 26, alt: 'Students and families fill the gym bleachers' },
  { n: 30, alt: 'A team presents their BiteWise nutrition idea' },
];

const photo = (n: number) => `/gallery/photo-${String(n).padStart(2, '0')}.jpg`;

const RAIL_PHOTOS = DAY_PHOTOS.map((p) => ({
  src: photo(p.n),
  alt: p.alt,
  width: p.tall ? 900 : 1200,
  height: p.tall ? 1200 : 798,
}));

/**
 * Container that cascades its children in. `custom` is the beat to hold
 * before the first child moves: long enough after the jump for the night
 * sky to stand alone for a moment, short on an ordinary load.
 */
const stagger: Variants = {
  hidden: {},
  show: (delayChildren: number) => ({
    transition: { staggerChildren: 0.08, delayChildren },
  }),
};

/** One settle: a fade with an 8px rise. */
const rise: Variants = {
  hidden: { opacity: 0, transform: 'translateY(8px)' },
  show: {
    opacity: 1,
    transform: 'translateY(0px)',
    transition: { duration: 0.6, ease: EASE_OUT_ARRAY },
  },
};

/**
 * The sky cues us the moment the sun is down, so the copy arrives *with* the
 * returning stars rather than after them; only a short beat is needed here.
 */
const AFTER_INTRO_DELAY = 0.25;
/** Nav drops in just behind the copy, then scrolling is handed back. */
const NAV_DELAY = 0.5;
const UNLOCK_MS = 1400;
/** The headline's glide from the middle of the sky up to its place, clearing room for the details. */
const GLIDE_MS = 900;
const SKIP_GLIDE_MS = 450;
/**
 * The opening: the sky stands still, then the view starts a long, slow push in
 * toward the upper sky (its length is on .lp-sky in landing.css), and the sun
 * rises while it is still under way.
 */
const OPEN_HOLD_MS = 1000;
const OPEN_SUN_DELAY_MS = 1500;
/** The beat the name rests under the night sky after the sun has set, before it lifts. */
const SETTLE_HOLD_MS = 900;
/** The ground under the sky fading off (landing.css, .lp-hero__ground). */
const GROUND_FADE_MS = 700;

export default function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const touch = useIsTouchScreen();

  // When the sequence plays, the page holds still and the copy waits for it.
  const [playingIntro] = useState(shouldPlayIntro);
  const [revealed, setRevealed] = useState(() => !shouldPlayIntro());
  const [locked, setLocked] = useState(playingIntro);
  const [skipped, setSkipped] = useState(false);
  /** The intro's ground and pinned headline, dropped once both have settled. */
  const [introGone, setIntroGone] = useState(!playingIntro);
  /** The opening push-in: the view is zoomed toward the summit, and the sun may start once it has arrived. */
  const [zoomed, setZoomed] = useState(false);
  const [sunStarted, setSunStarted] = useState(false);
  const openRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const titleRef = useRef<HTMLSpanElement>(null);
  const glidingRef = useRef(false);
  const holdRef = useRef<ReturnType<typeof setTimeout>>();
  const [part, setPart] = useState(0);
  const [badge, setBadge] = useState(-1);

  useEffect(() => {
    if (playingIntro) markIntroPlayed();
  }, [playingIntro]);

  // While the sun crosses, the headline waits in the very middle of the sky, wiped
  // on as the sun climbs (the app's splash does the same with its wordmark).
  useLayoutEffect(() => {
    const el = titleRef.current;
    const hero = el?.closest('.lp-hero');
    if (!playingIntro || !el || !hero || glidingRef.current) return;
    // Measured from its own place, so running twice (React's dev check) still centres it.
    el.style.transform = '';
    const h = hero.getBoundingClientRect();
    const t = el.getBoundingClientRect();
    const dx = h.left + h.width / 2 - (t.left + t.width / 2);
    const dy = h.top + h.height * 0.5 - (t.top + t.height / 2);
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.clipPath = 'inset(0 100% 0 0)';
  }, [playingIntro]);

  /** The wipe: from 0.2 to 0.45 of the timeline (the crest is 0.5), once the sun has climbed clear of the name. */
  const onSunFrame = (t: number) => {
    const el = titleRef.current;
    if (!el || glidingRef.current) return;
    // Daylight, 0 on the horizons and 1 at the crest: the stylesheet lights the range with it.
    el.closest<HTMLElement>('.lp-hero')?.style.setProperty('--sun', Math.sin(t * Math.PI).toFixed(3));
    const p = Math.min(1, Math.max(0, (t - 0.2) / 0.25));
    const e = 1 - (1 - p) ** 3;
    el.style.clipPath = `inset(-0.2em ${(1 - e) * 100}% -0.2em 0)`;
  };

  /** The sun has reached the top (or Skip): the headline lifts to its place and the details come in under it. */
  const settle = (ms: number) => {
    if (glidingRef.current) return;
    glidingRef.current = true;
    openRef.current.forEach(clearTimeout);
    setRevealed(true);
    const el = titleRef.current;
    el?.closest<HTMLElement>('.lp-hero')?.style.removeProperty('--sun');
    const done = () => setIntroGone(true);
    if (!el) {
      done();
      return;
    }
    const from = el.style.transform || 'none';
    el.style.transform = '';
    el.style.clipPath = '';
    const anim = el.animate([{ transform: from }, { transform: 'none' }], {
      duration: ms,
      easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    });
    setTimeout(done, Math.max(ms, GROUND_FADE_MS) + 50);
    anim.onfinish = () => anim.cancel();
  };

  // The opening beats, in order: hold on the sky, push in, then let the sun rise.
  useEffect(() => {
    if (!playingIntro) return;
    openRef.current = [
      setTimeout(() => setZoomed(true), OPEN_HOLD_MS),
      setTimeout(() => setSunStarted(true), OPEN_HOLD_MS + OPEN_SUN_DELAY_MS),
    ];
    return () => openRef.current.forEach(clearTimeout);
  }, [playingIntro]);

  /** The sun is at the top: let the sky stand a moment, then bring the page in. */
  const onSunSet = () => {
    holdRef.current = setTimeout(() => settle(GLIDE_MS), SETTLE_HOLD_MS);
  };
  useEffect(() => () => clearTimeout(holdRef.current), []);

  const skipIntro = () => {
    clearTimeout(holdRef.current);
    setSkipped(true);
    settle(SKIP_GLIDE_MS);
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

  // Depth: the ridges, sun and name shift by their distance as the pointer moves
  // and as the page scrolls, so the sky reads as layers rather than a flat
  // picture. The stylesheet does the moving from these three variables.
  const heroRef = useRef<HTMLElement>(null);
  // Off screen, the hero's endless CSS animations (the wordmark's glint) pause.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => hero.toggleAttribute('data-offscreen', !e.isIntersecting));
    io.observe(hero);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || reduceMotion) return;
    // Each value glides toward its target every frame (an exponential ease), so a
    // wheel's steps or a fast flick come out as one smooth motion instead of jumps.
    const target = { px: 0, py: 0, sy: Math.min(window.scrollY, window.innerHeight) };
    const now = { ...target };
    let frame = 0;
    let last = 0;
    const step = (t: number) => {
      const dt = last ? Math.min((t - last) / 1000, 0.05) : 1 / 60;
      last = t;
      const k = 1 - Math.exp(-dt * 9); // about 0.14 of the gap per 60 fps frame
      let moving = false;
      for (const key of ['px', 'py', 'sy'] as const) {
        const gap = target[key] - now[key];
        // Close enough: land exactly on the target and let this one rest.
        if (Math.abs(gap) > (key === 'sy' ? 0.3 : 0.001)) {
          now[key] += gap * k;
          moving = true;
        } else now[key] = target[key];
        hero.style.setProperty(`--${key}`, now[key].toFixed(3));
      }
      frame = moving ? requestAnimationFrame(step) : 0;
      if (!moving) last = 0;
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      target.px = (e.clientX / window.innerWidth) * 2 - 1;
      target.py = (e.clientY / window.innerHeight) * 2 - 1;
      kick();
    };
    const onScroll = () => {
      target.sy = Math.min(window.scrollY, window.innerHeight);
      kick();
    };
    for (const key of ['px', 'py', 'sy'] as const) hero.style.setProperty(`--${key}`, now[key].toFixed(3));
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, [reduceMotion]);

  // Cross-route anchor nav: LandingNav sends { scrollTo: id } when the link
  // is clicked from a different route; finish the scroll once we've landed.
  useEffect(() => {
    const scrollTo = (location.state as { scrollTo?: string } | null)
      ?.scrollTo;
    if (!scrollTo) return;
    const frame = requestAnimationFrame(() => jumpToSection(scrollTo));
    window.history.replaceState({}, '');
    return () => cancelAnimationFrame(frame);
  }, [location.state]);

  return (
    <div className="lp lp-page">
      <LandingNav
        overlay
        entered={playingIntro ? revealed : undefined}
        entranceDelay={NAV_DELAY}
      />

      {playingIntro && !revealed && !skipped && (
        <div className="lp-night lp-skip">
          <button type="button" onClick={skipIntro} className="lp-btn lp-btn--quiet">
            Skip
          </button>
        </div>
      )}

      <main id="main">
        {/* The night sky fills the first screen, the name centred in it with the
            date and place beneath. */}
        {/* The arrival plays in this same sky: the sun rises over the central
            summit and sets behind the ridges while the name is wiped on in
            the middle; then the name lifts and the details come in under it. */}
        <section
          ref={heroRef}
          className={`lp-hero lp-night${introGone ? '' : ' lp-hero--intro'}`}
          data-zoom={zoomed || undefined}
          aria-labelledby="hero-title"
        >
          <SkyVideo
            behindRidges={!playingIntro || sunStarted || skipped
              ? <SunArc rise={playingIntro && !skipped} onFrame={onSunFrame} onDone={playingIntro ? onSunSet : undefined} />
              : null}
          />
          <div className="lp-hero__scrim" aria-hidden />
          {!introGone && <div className="lp-hero__ground" data-done={revealed || undefined} aria-hidden />}

          <motion.div
            className="container lp-hero__inner"
            variants={stagger}
            initial={reduceMotion ? false : 'hidden'}
            animate={revealed ? 'show' : 'hidden'}
            custom={playingIntro ? AFTER_INTRO_DELAY : 0.1}
          >
            <motion.p className="lp-hero__lede" variants={rise}>
              The Tri-Valley’s largest student-led conference
            </motion.p>

            <motion.h1 id="hero-title" className="lp-hero__title" variants={playingIntro ? undefined : rise}>
              <span ref={titleRef} className="lp-hero__title-in">
                <span>Emerald</span>
                <span>Summit</span>
              </span>
            </motion.h1>

            <motion.div className="lp-hero__aside" variants={rise}>
              <p className="lp-hero__when">
                <span>{SUMMIT_DATE_LABEL}</span>
                <span>{SUMMIT_HOURS}</span>
                <span>{VENUE}</span>
              </p>
              <div className="lp-hero__actions">
                <button type="button" className="lp-btn" onClick={() => navigate('/home')}>
                  Get started
                </button>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* What is it? The answer, the owner's photograph, the four figures. */}
        <section id="about" className="lp-section" aria-labelledby="about-title">
          <div className="container lp-grid">
            <div className="lp-about__text">
              <h2 id="about-title">What is Emerald Summit?</h2>
              <p>
                {SUMMIT_ABOUT} Emerald Summit values collaboration over competition. Students present work in progress, learn from
                their peers, and receive guidance from professionals across six disciplines, leaving with a clearer
                path forward for their ideas.
              </p>
              {/* The Summit's vision in one line, instead of a page of its own. */}
              <blockquote className="lp-about__quote">
                “A spark: not just to show what’s been done, but to light up what’s possible.”
              </blockquote>
            </div>
            <PhotoMosaic className="lp-about__photo" />
            <dl className="lp-figures">
              {ABOUT_STATS.map((s) => (
                <div key={s.label}>
                  <dt>
                    <span className="lp-figures__label">{s.label}</span>
                    <span className="lp-figures__note">{s.note}</span>
                  </dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* The day from the peak down: the Summit figure, and the part of the day it has out. */}
        <section id="day" className="lp-section lp-day lp-pin" aria-labelledby="day-title">
          <div className="container lp-grid lp-day__inner lp-pin__stage">
            <div className="lp-day__head">
              <h2 id="day-title">What happens on Summit day?</h2>
            </div>
            <figure className="lp-day__figure">
              <HairlineFigure
                name="summit"
                label="The Summit day as a stepped mountain of six terraces, check-in at the peak down to the landing at the base, with Emerald High's flag on top"
                className="lp-hairline lp-hairline--summit"
                onPick={setPart}
                steps={DAY_PARTS.length}
              />
              <figcaption className="lp-day__hint">
                {touch ? 'Tap' : 'Hover over'} a terrace to see that part of the day.
              </figcaption>
            </figure>
            <DayPanel part={DAY_PARTS[part]} index={part} />
          </div>
        </section>

        {/* The lineup: a scroll-driven orbit of the six disciplines and their tracks. */}
        <OrbitalUniverses />

        {/* Who makes the Summit happen: previews of the Lineup page's Keynote, Sponsors, Experts and Team, each opening it. */}
        <LineupPreview />

        {/* The day, in the owner's photographs. */}
        <section className="lp-section lp-section--tight lp-ruled" aria-labelledby="rail-title">
          <PhotoRail
            photos={RAIL_PHOTOS}
            label="Photographs from the last Summit"
            renderControls={(controls) => (
              <div className="container">
                <div className="lp-head lp-head--row">
                  <h2 id="rail-title">What did the previous years look like?</h2>
                  {controls}
                </div>
              </div>
            )}
          />
        </section>

        <FaqSection />

        {/* The close: who you're coming as, on the badge rack, and the way in. */}
        <section id="roles" className="lp-section lp-roles lp-pin" aria-labelledby="roles-title">
          <div className="container lp-grid lp-roles__inner lp-pin__stage">
            {/* The figure is a picture for screen readers; the role rows beside it are the real links. */}
            {/* Not clickable: scrolling alone swings the badges (the role rows are the links). */}
            <figure className="lp-roles__figure">
              <HairlineFigure
                name="badges"
                label="Five lanyard badges hanging on a rack, one for each way to sign in to the Summit"
                className="lp-hairline"
                onPick={setBadge}
                steps={BADGE_ROLES.length}
              />
            </figure>
            <div className="lp-roles__text">
              <h2 id="roles-title">Who are you coming as?</h2>
              <ul className="lp-roles__list">
                {BADGE_ROLES.map((r, i) => (
                  <li key={r.name} className={badge === i ? 'is-active' : undefined}>
                    <Link to={signUpPath(r.name)} className="lp-roles__link">
                      <h3>{r.label}</h3>
                      <p>{r.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
              <button type="button" className="lp-btn" onClick={() => navigate('/roles')}>
                Choose your role
              </button>
            </div>
          </div>
        </section>

        {/* Near the end, right before Contact: anyone can give, through EAF's Zeffy donation form. */}
        <DonateSection />
      </main>

      {/* The close: the way in, and who to write to. */}
      <section id="contact" className="lp-night lp-cta" aria-labelledby="contact-title">
        <div className="container lp-cta__inner">
          <h2 id="contact-title">Start the trek.</h2>
          <p className="lp-cta__lede">
            Let’s create, learn and grow, together. Free to attend. Questions? Email us.
          </p>
          <div className="lp-cta__actions">
            <button type="button" className="lp-btn" onClick={() => navigate('/home')}>
              Get started
            </button>
            <a href={`mailto:${CONTACT_EMAIL}`} className="lp-btn lp-btn--quiet">
              <Mail aria-hidden /> {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

/** The part of the day the Summit figure has out: its photograph, name and the facts about it. */
function DayPanel({ part, index }: { part: DayPart; index: number }) {
  return (
    <div className="lp-day__panel" aria-live="polite">
      {part.photo ? (
        <figure className="lp-day__photo" data-slot={`day-part-${index + 1}`} data-alt={part.photo.alt}>
          <img
            key={part.photo.n}
            src={photo(part.photo.n)}
            width={1200}
            height={798}
            alt={part.photo.alt}
            loading="lazy"
            decoding="async"
          />
        </figure>
      ) : null}
      <p className="lp-day__step num">
        {index + 1} of {DAY_PARTS.length}
      </p>
      <h3 className="lp-day__name">{part.name}</h3>
      <ul className="lp-day__points">
        {part.points.map((pt) => (
          <li key={pt}>{pt}</li>
        ))}
        {part.pending && (
          <li>
            <span className="fill" data-fill={part.name}>
              {part.pending}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
