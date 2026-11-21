// Shared sign-in layout: a flat branded aside and a focused form pane.
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

/**
 * Two-column auth page: a navy aside (brand, the role or page identity, and
 * a simple role marker in `accent`) and a pane for the form. Collapses to the pane
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
  wide = false,
}: {
  /** A narrower aside and a wider form column, for long forms like profile setup. */
  wide?: boolean;
  /** Hex color for the role marker. */
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
    <section className={cn('relative min-h-svh overflow-x-clip bg-background lg:grid', wide ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)]' : 'lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]')}>
      <aside className="relative hidden h-svh flex-col overflow-hidden bg-navy p-10 text-white dark:border-r dark:border-white/10 lg:sticky lg:top-0 lg:flex xl:p-14">
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
            className="flex h-14 w-14 items-center justify-center rounded-md text-white"
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

      <div className={cn('relative flex min-h-svh flex-col justify-center px-6 py-20 sm:px-10', wide ? 'pt-28 lg:pb-20 lg:pt-36' : 'lg:py-16')}>
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

        <div className={cn('relative z-10 mx-auto w-full', wide ? 'max-w-[960px]' : 'max-w-[420px]')}>
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
