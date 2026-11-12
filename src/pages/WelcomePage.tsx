import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { markIntroPlayed, shouldPlayIntro } from '../components/introSession';
import LandingNav from '../components/LandingNav';
import SkyVideo from '../components/SkyVideo';
import FaqSection from '../components/FaqSection';
import OrbitalUniverses from '../components/OrbitalUniverses';
import PhotoMosaic from '../components/PhotoMosaic';
import LandingFooter from '../components/LandingFooter';
import PhotoRail from '../landing/PhotoRail';
import HairlineFigure from '../landing/HairlineFigure';
import { SIGN_IN_ROLES } from '../models/roles';
import { DAY_PARTS, type DayPart } from '../landing/dayParts';
import SunArc from '../landing/SunArc';
import '../landing/landing.css';

const VENUE = 'Emerald High School, Dublin, CA';

/** Opens the venue in Google Maps (a new tab, or the Maps app on phones). */
const VENUE_MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(VENUE)}`;

const FACTS: { label: string; text: string; href?: string }[] = [
  { label: 'Date', text: 'Saturday, January 23, 2027' },
  { label: 'Hours', text: '9:00 AM to 5:00 PM' },
  { label: 'Place', text: 'Emerald High School, 3600 Central Pkwy, Dublin, CA', href: VENUE_MAP_URL },
  { label: 'Cost', text: 'Free to attend and to compete' },
];

const ABOUT_STATS = [
  { value: '20+', label: 'Tracks', note: 'From Robothon to Mock Trial' },
  { value: '30+', label: 'Visiting experts', note: 'Judging the tracks and giving the talks' },
  { value: '6', label: 'Universes', note: 'TechVerse to CivicVerse' },
  { value: '1', label: 'Day', note: 'One campus, Emerald High' },
];

/** The five roles anyone can sign in as, in the order the badges hang. */
const BADGE_ROLES = SIGN_IN_ROLES;

/** The owner's own photographs from the last Summit, in rail order. */
const DAY_PHOTOS: { n: number; alt: string; tall?: boolean }[] = [
  { n: 19, alt: 'Two students pitch their project to a visiting expert' },
  { n: 10, alt: 'Students gather around a competition robot' },
  { n: 13, alt: 'A student walks a visitor through her design project poster' },
  { n: 28, alt: 'A VentureVerse panel on stage in the lecture hall' },
  { n: 17, alt: 'Three students present to a judge' },
  { n: 26, alt: 'Students and families fill the gym bleachers' },
  { n: 30, alt: 'A team presents their BiteWise nutrition pitch' },
  { n: 34, alt: 'Two students hold up their award certificates', tall: true },
  { n: 21, alt: 'Winners on the gym floor with flowers and a judge' },
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
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
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
/** The headline's glide from the middle of the sky down to its place. */
const GLIDE_MS = 900;
const SKIP_GLIDE_MS = 450;
/** The ground under the sky fading off (landing.css, .lp-hero__ground). */
const GROUND_FADE_MS = 700;

export default function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  // When the sequence plays, the page holds still and the copy waits for it.
  const [playingIntro] = useState(shouldPlayIntro);
  const [revealed, setRevealed] = useState(() => !shouldPlayIntro());
  const [locked, setLocked] = useState(playingIntro);
  const [skipped, setSkipped] = useState(false);
  /** The sun is still crossing the sky. */
  const [sunUp, setSunUp] = useState(playingIntro);
  /** The intro's ground and pinned headline, dropped once both have settled. */
  const [introGone, setIntroGone] = useState(!playingIntro);
  const titleRef = useRef<HTMLSpanElement>(null);
  const glidingRef = useRef(false);
  const [part, setPart] = useState(0);
  const [badge, setBadge] = useState(-1);

  useEffect(() => {
    if (playingIntro) markIntroPlayed();
  }, [playingIntro]);

  // While the sun crosses, the headline waits in the middle of the sky, wiped
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
    const dy = h.top + h.height * 0.46 - (t.top + t.height / 2);
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.clipPath = 'inset(0 100% 0 0)';
  }, [playingIntro]);

  /** The wipe: from 28% to 52% of the sun's crossing, easing out. */
  const onSunFrame = (t: number) => {
    const el = titleRef.current;
    if (!el || glidingRef.current) return;
    const p = Math.min(1, Math.max(0, (t - 0.28) / 0.24));
    const e = 1 - (1 - p) ** 3;
    el.style.clipPath = `inset(-0.2em ${(1 - e) * 100}% -0.2em 0)`;
  };

  /** The sun has set (or Skip): the headline glides to its place and the page comes in. */
  const settle = (ms: number) => {
    if (glidingRef.current) return;
    glidingRef.current = true;
    setSunUp(false);
    setRevealed(true);
    const el = titleRef.current;
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

  const skipIntro = () => {
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
        {/* Ledge: the night sky is the tall field; the name rests at its base. */}
        {/* The arrival plays in this same sky: the sun rises and sets behind
            its ridges, while a ground below hides the rest of the page; then
            the headline glides down to its place and the ground fades off. */}
        <section
          className={`lp-hero lp-night${introGone ? '' : ' lp-hero--intro'}`}
          aria-labelledby="hero-title"
        >
          <SkyVideo
            behindRidges={sunUp && !skipped ? <SunArc onFrame={onSunFrame} onDone={() => settle(GLIDE_MS)} /> : null}
          />
          <div className="lp-hero__scrim" aria-hidden />
          {!introGone && <div className="lp-hero__ground" data-done={revealed || undefined} aria-hidden />}

          <motion.div
            className="container lp-grid lp-hero__inner"
            variants={stagger}
            initial={reduceMotion ? false : 'hidden'}
            animate={revealed ? 'show' : 'hidden'}
            custom={playingIntro ? AFTER_INTRO_DELAY : 0.1}
          >
            <motion.h1 id="hero-title" className="lp-hero__title" variants={playingIntro ? undefined : rise}>
              <span ref={titleRef} className="lp-hero__title-in">
                <span>Emerald</span>
                <span>Summit</span>
              </span>
            </motion.h1>

            <motion.div className="lp-hero__aside" variants={rise}>
              <p className="lead lp-hero__lede">
                The Tri-Valley’s largest student-led STEAM conference.
              </p>
              <p className="lp-hero__when">
                Saturday, January 23, 2027
                <br />
                9 AM to 5 PM, Emerald High School, Dublin
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
                A full day where hundreds of builders move between six
                disciplines (universes), pitch to visiting experts, and leave
                with something better than they started with.
              </p>
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
        <section id="day" className="lp-section lp-day" aria-labelledby="day-title">
          <div className="container lp-grid lp-day__inner">
            <div className="lp-day__head">
              <h2 id="day-title">What happens on Summit day?</h2>
            </div>
            <figure className="lp-day__figure">
              <HairlineFigure
                name="summit"
                label="The Summit day as a stepped mountain of six terraces, check-in at the peak down to awards at the base, with Emerald High's flag on top"
                className="lp-hairline lp-hairline--summit"
                onPick={setPart}
              />
              <figcaption className="lp-day__hint">Hover over a terrace to see that part of the day.</figcaption>
            </figure>
            <DayPanel part={DAY_PARTS[part]} index={part} />
          </div>
        </section>

        {/* The lineup: a scroll-driven orbit of the six universes and their tracks. */}
        <OrbitalUniverses />

        {/* The day, in the owner's photographs. */}
        <section className="lp-section lp-section--tight" aria-labelledby="rail-title">
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

        {/* Where and when, as a table on a change of paper. */}
        <section id="venue" className="lp-section lp-venue" aria-labelledby="venue-title">
          <div className="container">
            <div className="lp-head">
              <h2 id="venue-title">How do I get to Emerald High?</h2>
            </div>
            <dl className="lp-facts">
              {FACTS.map(({ label, text, href }) => (
                <div key={label} className="lp-grid">
                  <dt>{label}</dt>
                  <dd>
                    <span>{text}</span>
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${VENUE} (opens Google Maps)`}
                        className="lp-link"
                      >
                        Open in Google Maps
                      </a>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <FaqSection />

        {/* The close: who you're coming as, on the badge rack, and the way in. */}
        <section id="roles" className="lp-section lp-roles" aria-labelledby="roles-title">
          <div className="container lp-grid lp-roles__inner">
            <figure className="lp-roles__figure">
              <HairlineFigure
                name="badges"
                label="Five lanyard badges hanging on a rack, one for each way to sign in to the Summit"
                className="lp-hairline"
                onPick={setBadge}
              />
            </figure>
            <div className="lp-roles__text">
              <h2 id="roles-title">Who are you coming as?</h2>
              <ul className="lp-roles__list">
                {BADGE_ROLES.map((r, i) => (
                  <li key={r.name} className={badge === i ? 'is-active' : undefined}>
                    <h3>{r.label}</h3>
                    <p>{r.description}</p>
                  </li>
                ))}
              </ul>
              <button type="button" className="lp-btn" onClick={() => navigate('/roles')}>
                Choose your role
              </button>
            </div>
          </div>
        </section>
      </main>

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
