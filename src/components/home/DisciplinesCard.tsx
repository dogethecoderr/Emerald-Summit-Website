import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { USER_DISCIPLINES } from '../../models/disciplines';
import { rgba, vibeFor } from '../../models/verseVibes';
import DisciplineWorld from '../verse/DisciplineWorld';
import { ArrowRight } from '../icons';

// The world floats in the upper part of the box, above the name.
const BOX_WORLD = { fx: 0.5, fy: 0.34, fill: 0.72 };

/** Home's Disciplines row: one box per discipline, in its colors and 3D world, each opening it in Explore. */
export default function DisciplinesCard() {
  const { theme } = useTheme();
  return (
    <section aria-labelledby="home-disciplines">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id="home-disciplines" className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">Disciplines</h2>
        <Link
          to="/disciplines"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-[13px] font-semibold transition-colors hover:border-emerald/40"
        >
          Explore all disciplines <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
        {USER_DISCIPLINES.map((d, i) => {
          const vibe = vibeFor(d.name, theme);
          return (
            <li key={d.name} className="min-w-0">
              <Link
                to={`/disciplines?verse=${encodeURIComponent(d.name)}`}
                className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[22px] p-4 outline-none transition-transform duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                style={{
                  background: vibe.background,
                  color: vibe.text,
                  ['--tw-ring-color' as string]: vibe.accent,
                  boxShadow: `inset 0 0 0 1px ${rgba(vibe.accent, 0.3)}`,
                }}
              >
                <DisciplineWorld discipline={d.name} vibe={vibe} theme={theme} targets={BOX_WORLD} delay={i * 90} className="absolute inset-0" />
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{ background: `linear-gradient(180deg, ${rgba(vibe.background, 0)} 45%, ${rgba(vibe.background, 0.9)} 85%)` }}
                  aria-hidden
                />
                <span className="relative font-display text-lg font-extrabold leading-tight tracking-tight sm:text-xl">{d.label}</span>
                <span className="relative mt-0.5 line-clamp-2 text-xs leading-snug" style={{ color: vibe.textDim }}>{d.description}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
