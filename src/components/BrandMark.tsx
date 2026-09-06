import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import SummitLogo from './SummitLogo';
import { cn } from '@/lib/utils';

/**
 * Clickable "webby" wordmark + logo, always routing back to "/".
 * Shared across the landing nav, in-app sidebar, and every auth screen so
 * the logo behaves consistently as a "home" control everywhere it appears.
 */
export default function BrandMark({
  logoClassName = 'h-9 w-9',
  titleClassName = 'text-[15px] font-semibold tracking-tight',
  subtitleClassName = 'text-[11px] text-muted-foreground',
  textWrapperClassName = 'leading-tight',
  gap = 'gap-2.5',
  subtitle = 'EHS Academic Foundation',
  showSubtitle = true,
  className,
}: {
  logoClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  textWrapperClassName?: string;
  gap?: string;
  subtitle?: ReactNode;
  showSubtitle?: boolean;
  className?: string;
}) {
  return (
    <Link
      to="/"
      aria-label="webby — back to home"
      className={cn('group flex items-center', gap, className)}
    >
      <div
        className={cn(
          'shrink-0 transition-transform duration-200 group-hover:scale-105',
          logoClassName,
        )}
      >
        <SummitLogo />
      </div>
      <div className={textWrapperClassName}>
        <div className={cn('font-display', titleClassName)}>webby</div>
        {showSubtitle && <div className={subtitleClassName}>{subtitle}</div>}
      </div>
    </Link>
  );
}
