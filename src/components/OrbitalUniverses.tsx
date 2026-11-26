import { Component, lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { EASE_OUT_ARRAY } from '@/lib/motion';
import SummitLogo from './SummitLogo';
import TechVerseTracks from './TechVerseTracks';
import { useIsPhoneScreen } from '../lib/device';
import { useSummitContent } from '../services/summitContent';
import { landingTrackTitles, techVerseTrackColumns } from '../models/landingTracks';
import { VERSE_DISCIPLINES as USER_DISCIPLINES } from '../models/verseVibes';
import { MOCK_SESSIONS } from '../models/sessions';
import { isSectionJumping, SECTION_JUMP_EVENT } from '../landing/jumpToSection';

/**
 * A discipline's public titles, in its description's order: tracks are sessions. Not the
 * session's `track` column, which some rows fill with the discipline's own name
 * ("NovaSphere") or a group ("Engineering Track"), so it named the discipline as
 * a track and folded sessions that share it into one.
 */
function sessionTitles(discipline: string): string[] {
  return landingTrackTitles(discipline, MOCK_SESSIONS);
}

// The planets as 3D spheres, loaded on demand so three.js stays out of the first paint.
const OrbitPlanets3D = lazy(() => import('./OrbitPlanets3D'));

/** No WebGL (or three.js failed to load): keep the flat planets. */
class Fallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const COUNT = USER_DISCIPLINES.length;
/** Ring radius, in percent of the square stage, so it scales fluidly. */
const R = 42;
const STEP = 360 / COUNT;

/**
 * The six universes as a scroll-driven orbit.
 *
 * A tall section pins one frame while the reader scrolls: the ring turns with
 * the scroll and each universe comes round to the top in its turn, while the
 * panel beside it shows that universe's tracks. The index of names jumps the
 * scroll to any one of them. Phones and reduced motion get the same content
 * as a plain index, with nothing pinned.
 */
export default function OrbitalUniverses() {
  const reduceMotion = useReducedMotion();
  // On a phone the pinned orbit was ~4 screens of scrolling with the track
  // list cut off at the bottom, so phones get the plain index too.
  const phone = useIsPhoneScreen();
  // Tracks arrive from the database after first paint; re-render when they do.
  useSummitContent();
  if (reduceMotion || phone) return <UniverseIndex />;
  return <UniverseOrbit />;
}

function UniverseOrbit() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Each universe sits exactly at the top of the ring at the middle of its
  // slice of the scroll; the turn between them is a linear scrub, smoothed
  // just enough by a stiff spring that a wheel's steps don't judder.
  // Positive: the ring turns clockwise as the reader scrolls down.
  const turnAt = (p: number) => Math.min(Math.max(p * COUNT - 0.5, 0), COUNT - 1) * STEP;
  const activeAt = (p: number) => Math.min(COUNT - 1, Math.max(0, Math.floor(p * COUNT)));
  // The ring's target follows the scroll, except while a nav or footer scroll
  // passes through (isSectionJumping): then it holds, and on landing it snaps.
  const turn = useMotionValue(turnAt(scrollYProgress.get()));
  const rotate = useSpring(turn, { stiffness: 220, damping: 34, mass: 0.6 });
  const counterRotate = useTransform(rotate, (r) => -r);

  const [active, setActive] = useState(0);
  // The flat planets show until the 3D ones have a renderer.
  const [spheres, setSpheres] = useState(false);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (isSectionJumping()) return;
    turn.set(turnAt(v));
    const i = activeAt(v);
    setActive((prev) => (prev === i ? prev : i));
  });
  useEffect(() => {
    const land = () => {
      const v = scrollYProgress.get();
      turn.jump(turnAt(v));
      rotate.jump(turnAt(v));
      setActive(activeAt(v));
    };
    window.addEventListener(SECTION_JUMP_EVENT, land);
    return () => window.removeEventListener(SECTION_JUMP_EVENT, land);
    // turnAt/activeAt are pure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollYProgress, turn, rotate]);

  /** Scroll to the middle of universe i's slice of the pinned track. */
  const goTo = (i: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.5) / COUNT) * travel, behavior: 'smooth' });
  };

  const d = USER_DISCIPLINES[active];
  const tracks = sessionTitles(d.name);

  return (
    <section
      id="disciplines"
      ref={sectionRef}
      className="lp lp-night lp-orbit"
      aria-labelledby="universes-title"
    >
      {/* The section glows in the color of the discipline at the top of the ring. */}
      <div className="lp-orbit__pin" style={{ '--orbit-glow': d.color } as CSSProperties}>
        <div className="container lp-grid lp-orbit__inner">
          <div className="lp-orbit__stage" aria-hidden>
            <div className="lp-orbit__ring" />
            <Fallback>
              <Suspense fallback={null}>
                <OrbitPlanets3D
                  rotate={rotate}
                  active={active}
                  planets={USER_DISCIPLINES.map((u) => ({ name: u.name, color: u.color }))}
                  radius={R}
                  onReady={() => setSpheres(true)}
                />
              </Suspense>
            </Fallback>
            <motion.div className="lp-orbit__wheel" style={{ rotate }}>
              {USER_DISCIPLINES.map((u, i) => {
                // Laid out counterclockwise from the top, so a clockwise turn brings each one up in order.
                const angle = (-i / COUNT) * 2 * Math.PI - Math.PI / 2;
                const isActive = i === active;
                return (
                  <div
                    key={u.name}
                    className="lp-orbit__slot"
                    style={{
                      left: `${50 + R * Math.cos(angle)}%`,
                      top: `${50 + R * Math.sin(angle)}%`,
                    }}
                  >
                    <motion.div className="lp-orbit__body" style={{ rotate: counterRotate }}>
                      <motion.span
                        className="lp-orbit__planet"
                        style={{ '--uni': u.color, visibility: spheres ? 'hidden' : undefined } as CSSProperties}
                        animate={{ scale: isActive ? 1.7 : 1, opacity: isActive ? 1 : 0.6 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                      />
                      <span className={`lp-orbit__label${isActive ? ' is-active' : ''}`}>
                        {u.label}
                      </span>
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>
            <div className="lp-orbit__core">
              <SummitLogo />
            </div>
          </div>

          <div className="lp-orbit__panel">
            <h2 id="universes-title">Disciplines</h2>

            <nav className="lp-orbit__index" aria-label="Disciplines">
              {USER_DISCIPLINES.map((u, i) => (
                <button
                  key={u.name}
                  type="button"
                  className="lp-orbit__pick"
                  style={{ '--uni': u.color } as CSSProperties}
                  aria-current={i === active ? 'true' : undefined}
                  onClick={() => goTo(i)}
                >
                  {u.label}
                </button>
              ))}
            </nav>

            <motion.div
              key={d.name}
              className="lp-orbit__detail"
              style={{ '--uni': d.color } as CSSProperties}
              initial={{ opacity: 0, transform: 'translateY(8px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{ duration: 0.35, ease: EASE_OUT_ARRAY }}
            >
              <h3 className="lp-orbit__name">{d.label}</h3>
              <p className="lp-orbit__desc">{d.description}</p>
              {d.name === 'techverse' ? (
                <TechVerseTracks columns={techVerseTrackColumns(MOCK_SESSIONS)} className="lp-orbit__tech-tracks" />
              ) : (
                <ul className="lp-orbit__tracks" aria-label={`${d.label} tracks`}>
                  {tracks.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The same six universes and their tracks, as a plain index: phones and reduced motion. */
function UniverseIndex() {
  return (
    <section id="disciplines" className="lp-section lp-universes" aria-labelledby="universes-title">
      <div className="container">
        <div className="lp-head">
          <h2 id="universes-title">Disciplines</h2>
        </div>
        <ul className="lp-uni">
          {USER_DISCIPLINES.map((d) => (
            <li
              key={d.name}
              className="lp-grid lp-uni__row"
              style={{ '--uni': d.color } as CSSProperties}
            >
              <h3 className="lp-uni__name">{d.label}</h3>
              <p className="lp-uni__desc">{d.description}</p>
              {d.name === 'techverse' ? (
                <TechVerseTracks columns={techVerseTrackColumns(MOCK_SESSIONS)} className="lp-uni__tech-tracks" />
              ) : (
                <ul className="lp-uni__tracks" aria-label={`${d.label} tracks`}>
                  {sessionTitles(d.name).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
