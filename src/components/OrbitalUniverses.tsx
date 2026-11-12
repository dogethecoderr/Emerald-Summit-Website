import { useRef, useState, type CSSProperties } from 'react';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import SummitLogo from './SummitLogo';
import { VERSE_DISCIPLINES as USER_DISCIPLINES } from '../models/verseVibes';
import { tracksForUniverse } from '../models/tracks';

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
 * scroll to any one of them; on phones the frame stacks. Reduced motion gets
 * the same content as a plain index, with nothing pinned.
 */
export default function OrbitalUniverses() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <UniverseIndex />;
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
  const turn = useTransform(
    scrollYProgress,
    (p) => -Math.min(Math.max(p * COUNT - 0.5, 0), COUNT - 1) * STEP,
  );
  const rotate = useSpring(turn, { stiffness: 220, damping: 34, mass: 0.6 });
  const counterRotate = useTransform(rotate, (r) => -r);

  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const i = Math.min(COUNT - 1, Math.max(0, Math.floor(v * COUNT)));
    setActive((prev) => (prev === i ? prev : i));
  });

  /** Scroll to the middle of universe i's slice of the pinned track. */
  const goTo = (i: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.5) / COUNT) * travel, behavior: 'smooth' });
  };

  const d = USER_DISCIPLINES[active];
  const tracks = tracksForUniverse(d.name);

  return (
    <section
      id="universes"
      ref={sectionRef}
      className="lp lp-night lp-orbit"
      aria-labelledby="universes-title"
    >
      <div className="lp-orbit__pin">
        <div className="container lp-grid lp-orbit__inner">
          <div className="lp-orbit__stage" aria-hidden>
            <div className="lp-orbit__ring" />
            <motion.div className="lp-orbit__wheel" style={{ rotate }}>
              {USER_DISCIPLINES.map((u, i) => {
                const angle = (i / COUNT) * 2 * Math.PI - Math.PI / 2;
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
                        style={{ '--uni': u.color } as CSSProperties}
                        animate={{ scale: isActive ? 2 : 1, opacity: isActive ? 1 : 0.6 }}
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
            <h2 id="universes-title">Which universe is yours?</h2>

            <nav className="lp-orbit__index" aria-label="Universes">
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <h3 className="lp-orbit__name">{d.label}</h3>
              <p className="lp-orbit__desc">{d.description}</p>
              <ul className="lp-orbit__tracks" aria-label={`${d.label} tracks`}>
                {tracks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
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
    <section id="universes" className="lp-section lp-universes" aria-labelledby="universes-title">
      <div className="container">
        <div className="lp-head">
          <h2 id="universes-title">Which universe is yours?</h2>
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
              <ul className="lp-uni__tracks" aria-label={`${d.label} tracks`}>
                {tracksForUniverse(d.name).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
