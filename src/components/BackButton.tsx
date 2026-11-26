import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { ChevronLeft } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * The dashboard's one Back button: a bordered card button with a caret.
 * Inside a discipline's world, pass `style` with that world's colors.
 */
const BackButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function BackButton(
  { children = 'Back', className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-emerald/50 hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald',
        className,
      )}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" /> {children}
    </button>
  );
});

export default BackButton;
