import { useRef, useState } from 'react';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import SummitLogo from './SummitLogo';
import { VERSE_DISCIPLINES as USER_DISCIPLINES } from '../models/verseVibes';
import { tracksForUniverse } from '../models/tracks';

/**
 * Scroll-driven "solar system" of the six disciplines.
 *
 * A tall section pins a single frame while the reader scrolls; the orbit ring
 * rotates with scroll progress and each universe takes its turn at the center
 * core, glowing in its own color. Falls back to a calm static grid when the
 * viewer prefers reduced motion.
 */
export default function OrbitalUniverses() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Ring rotation + a counter-rotation so every label stays upright.
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 300]);
  const counterRotate = useTransform(rotate, (r) => -r);

  const count = USER_DISCIPLINES.length;
  const [active, setActive] = useState(0);

  // Drive the active universe from scroll progress (updates ~6 times total).
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const idx = Math.min(count - 1, Math.max(0, Math.floor(v * count)));
    setActive((prev) => (prev === idx ? prev : idx));
  });

  if (reduceMotion) {
    return (
      <section
        id="universes"
        className="scroll-mt-20 bg-navy px-6 py-24 lg:scroll-mt-24 lg:px-14"
      >
        <div className="mx-auto max-w-6xl">
          <SectionHeading />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {USER_DISCIPLINES.map((d) => (
              <div
                key={d.name}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
              >
                <span
                  className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${d.color}, ${d.color}22)`,
                    boxShadow: `0 0 24px -4px ${d.color}88`,
                  }}
                  aria-hidden
                />
                <h3 className="font-display text-lg font-semibold text-white">{d.label}</h3>
                <p className="mt-1 text-sm text-white/60">{d.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const activeDisc = USER_DISCIPLINES[active];

  // Ring geometry, in percent of the square container so it scales fluidly.
  const R = 44;

  return (
    <section
      id="universes"
      ref={sectionRef}
      className="relative h-[440vh] scroll-mt-20 bg-navy lg:scroll-mt-24"
    >
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center gap-9 overflow-hidden lg:gap-12">
        {/* active-tinted ambient glow */}
        <motion.div
          key={`glow-${active}`}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${activeDisc.color}33 0%, transparent 60%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />

        <div className="relative z-10 px-6 text-center">
          <SectionHeading />
        </div>

        {/* orbit stage + tracks panel — the side-by-side split is web-view
            only (lg+); on mobile the tracks panel is hidden and the orbit
            stays centered exactly as before. */}
        <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-8 lg:px-14">
        <div className="relative mx-auto aspect-square w-[min(86vw,460px)] lg:w-[min(34vw,420px)]">
          {/* orbit guide ring */}
          <div
            className="absolute inset-[6%] rounded-full border border-white/15"
            aria-hidden
          />

          {/* rotating ring of spheres */}
          <motion.div className="absolute inset-0" style={{ rotate }}>
            {USER_DISCIPLINES.map((d, i) => {
              const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
              const x = 50 + R * Math.cos(angle);
              const y = 50 + R * Math.sin(angle);
              const isActive = i === active;
              return (
                <div
                  key={d.name}
                  className="absolute"
                  style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <motion.div
                    style={{ rotate: counterRotate }}
                    animate={{ y: [0, -7, 0] }}
                    transition={{
                      duration: 5 + i * 0.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="flex flex-col items-center"
                  >
                    <motion.span
                      className="block rounded-full"
                      animate={{
                        width: isActive ? 68 : 34,
                        height: isActive ? 68 : 34,
                        opacity: isActive ? 1 : 0.55,
                      }}
                      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                      style={{
                        background: `radial-gradient(circle at 32% 28%, #ffffffcc 0%, ${d.color} 42%, ${d.color} 100%)`,
                        boxShadow: isActive
                          ? `0 0 34px -2px ${d.color}, inset 0 0 18px -6px #00000055`
                          : `0 0 16px -4px ${d.color}aa`,
                      }}
                    />
                    <span
                      className="mt-2 whitespace-nowrap font-mono text-[11px] font-semibold tracking-wide transition-opacity"
                      style={{ color: d.color, opacity: isActive ? 1 : 0.7 }}
                    >
                      {d.label}
                    </span>
                  </motion.div>
                </div>
              );
            })}
          </motion.div>

          {/* center core — active universe detail */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex w-[58%] flex-col items-center text-center">
              <div className="h-10 w-10 opacity-90 lg:h-12 lg:w-12">
                <SummitLogo />
              </div>
              {/* Keyed re-mount (no AnimatePresence) so the label always
                  reflects the current active universe even when scroll fires
                  many rapid changes. */}
              <motion.div
                key={activeDisc.name}
                initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="mt-3"
              >
                <div
                  className="font-hero text-2xl font-bold tracking-tight lg:text-3xl"
                  style={{ color: activeDisc.color }}
                >
                  {activeDisc.label}
                </div>
                <div className="mt-1 text-[13px] leading-snug text-white/60 lg:text-sm">
                  {activeDisc.description}
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* tracks panel — web view only */}
        <div className="hidden lg:flex lg:flex-col lg:items-start lg:justify-center">
          <motion.div
            key={activeDisc.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: activeDisc.color, boxShadow: `0 0 10px -1px ${activeDisc.color}` }}
                aria-hidden
              />
              <span
                className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: activeDisc.color }}
              >
                {activeDisc.label} tracks
              </span>
            </div>
            <ul className="mt-4 space-y-2.5">
              {tracksForUniverse(activeDisc.name).map((track) => (
                <li
                  key={track}
                  className="flex items-center gap-2.5 text-[15px] text-white/85"
                >
                  <span className="h-1 w-1 shrink-0 rounded-full bg-white/40" aria-hidden />
                  {track}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
        </div>

        {/* progress rail + caption, kept close together as one group */}
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            {USER_DISCIPLINES.map((d, i) => (
              <span
                key={d.name}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === active ? 26 : 8,
                  background: i === active ? d.color : 'rgba(255,255,255,0.25)',
                }}
                aria-hidden
              />
            ))}
          </div>

          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
            Scroll to explore
          </p>
        </div>
      </div>
    </section>
  );
}

function SectionHeading() {
  return (
    <>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
        The six universes
      </p>
      <h2 className="mt-3 max-w-3xl font-hero text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
        <span
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage: 'linear-gradient(100deg, #d1fae5 5%, #6ee7b7 45%, #22c55e 95%)',
          }}
        >
          Six universes
        </span>{' '}
        to explore...
      </h2>
    </>
  );
}
