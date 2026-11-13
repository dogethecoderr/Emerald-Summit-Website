// Split sign-in layout, adapted from "Split Login" (Hirael login-03, MIT,
// Mohammad Shehadeh, https://github.com/MohammadShehadeh/hirael) found via
// 21st.dev: a decorative aside of flowing paths beside a focused sign-in pane,
// with a back link and staggered entrances. Reworked for Emerald Summit: the
// aside is the portal's navy, the paths take the role's color, and they move
// with a CSS stroke animation instead of per-frame JavaScript.
import ThemeToggle from './ThemeToggle';
import type { CSSProperties, ReactNode } from 'react';
import { ChevronLeft, type LucideIcon } from '@/components/icons';
import BrandMark from './BrandMark';
import { cn } from '@/lib/utils';

/** Entrance for each block in the pane (tailwindcss-animate). */
export const AUTH_ENTER =
  'animate-in fade-in slide-in-from-bottom-4 duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] fill-mode-both motion-reduce:animate-none';

export const authStagger = (index: number, step = 60): CSSProperties => ({
  animationDelay: `${index * step}ms`,
});

/** Deterministic 0–1 per index, so path timings don't reshuffle per render. */
const jitter = (i: number) => {
  const v = Math.sin(i + 1) * 10_000;
  return v - Math.floor(v);
};

function FlowingPaths({ position, color }: { position: number; color: string }) {
  const paths = Array.from({ length: 22 }, (_, k) => {
    const i = k * 1.6;
    return {
      id: k,
      d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${
        312 - i * 5 * position
      } ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
        684 - i * 5 * position
      } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
      width: 0.5 + i * 0.03,
      opacity: 0.14 + k * 0.035,
      duration: 22 + jitter(k) * 12,
    };
  });
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      fill="none"
      viewBox="0 0 696 316"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          pathLength={1}
          stroke={color}
          strokeOpacity={Math.min(p.opacity, 0.85)}
          strokeWidth={p.width}
          strokeDasharray="0.4 0.6"
          className="motion-safe:animate-[auth-path_linear_infinite]"
          style={{ animationDuration: `${p.duration}s` }}
        />
      ))}
    </svg>
  );
}

/**
 * Two-column auth page: a navy aside (brand, the role or page identity, and
 * flowing paths in `accent`) and a pane for the form. Collapses to the pane
 * alone on small screens, with the brand shown above the content.
 */
export default function AuthLayout({
  accent,
  icon: Icon,
  eyebrow,
  title,
  backLabel = 'Back',
  onBack,
  children,
}: {
  /** Hex color for the paths and the identity tile. */
  accent: string;
  icon: LucideIcon;
  /** Small label over the aside title, e.g. "Sign in". */
  eyebrow: string;
  /** The aside's large title, e.g. the role name. */
  title: string;
  backLabel?: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section className="relative min-h-svh overflow-x-clip bg-background lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden h-svh flex-col overflow-hidden bg-navy p-10 text-white dark:border-r dark:border-white/10 lg:sticky lg:top-0 lg:flex xl:p-14">
        <div className="absolute inset-0 opacity-90">
          <FlowingPaths position={1} color={accent} />
          <FlowingPaths position={-1} color={accent} />
        </div>
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgb(var(--navy) / 0) 30%, rgb(var(--navy) / 0.6) 72%, rgb(var(--navy)))' }}
        />

        <div className={cn(AUTH_ENTER, 'relative z-10')}>
          <BrandMark
            logoClassName="h-11 w-11"
            titleClassName="text-[17px] font-bold text-white"
            subtitleClassName="text-[12px] text-white/55"
            gap="gap-3"
          />
        </div>

        <div style={authStagger(3)} className={cn(AUTH_ENTER, 'relative z-10 my-auto pb-28')}>
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ background: accent }}
          >
            <Icon className="h-7 w-7" strokeWidth={1.9} />
          </span>
          <div className="mt-6 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-sky-300">
            {eyebrow}
          </div>
          <div className="mt-2 font-display text-5xl font-bold leading-[1.04] tracking-tight xl:text-6xl">
            {title}
          </div>
          <div className="mt-4 text-[13px] text-white/55">Emerald Summit 2027, Dublin, CA</div>
        </div>
      </aside>

      <div className="relative flex min-h-svh flex-col justify-center px-6 py-20 sm:px-10 lg:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -right-24 -top-40 h-[520px] w-[520px] rounded-full opacity-60"
            style={{ background: `radial-gradient(closest-side, ${accent}22, transparent)` }}
          />
          <div
            className="absolute -bottom-48 -left-24 h-[420px] w-[420px] rounded-full opacity-50"
            style={{ background: 'radial-gradient(closest-side, rgba(12,122,85,0.14), transparent)' }}
          />
        </div>

        <button
          type="button"
          onClick={onBack}
          className={cn(
            AUTH_ENTER,
            'absolute left-5 top-6 z-10 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:left-8 sm:top-8',
          )}
        >
          <ChevronLeft className="h-4 w-4" /> {backLabel}
        </button>
        <ThemeToggle className={cn(AUTH_ENTER, 'absolute right-5 top-6 z-10 sm:right-8 sm:top-8')} />

        <div className="relative z-10 mx-auto w-full max-w-[420px]">
          <div className={cn(AUTH_ENTER, 'mb-8 lg:hidden')}>
            <BrandMark
              logoClassName="h-10 w-10"
              titleClassName="text-[16px] font-bold"
              subtitleClassName="text-[12px] text-muted-foreground"
              gap="gap-3"
            />
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
