import type { VerseVibe } from '../../models/verseVibes';
import { cn } from '@/lib/utils';

/** A recognizable discipline symbol in place of abstract background shapes. */
export default function VerseMotif({ vibe, compact = false, className }: {
  vibe: VerseVibe;
  compact?: boolean;
  className?: string;
}) {
  const Symbol = vibe.icon;
  return (
    <div aria-hidden className={cn('pointer-events-none relative block h-full w-full overflow-hidden', className)}>
      <Symbol
        strokeWidth={0.8}
        className={cn('absolute right-[7%] top-[7%]', compact ? 'h-[42%] max-h-40 w-auto' : 'h-[45%] max-h-96 w-auto')}
        style={{ color: vibe.accent, opacity: 0.13 }}
      />
    </div>
  );
}
