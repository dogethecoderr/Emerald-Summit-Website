import { cn } from '@/lib/utils';

/**
 * Emerald Summit mark: the emerald dragon inside a ring of the disciplines
 * (DNA, books, atom, data, engineering, art). A white badge with a transparent
 * outside, so it sits on light and navy backgrounds alike. The source is
 * public/brand/summit-logo.png (512px); the favicons are made from the same art.
 */
export default function SummitLogo({
  size,
  className,
}: {
  /** Fixed pixel size; omit to fill the parent (parent controls sizing via CSS). */
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/brand/summit-logo.png"
      alt="Emerald Summit"
      width={size}
      height={size}
      draggable={false}
      className={cn('block object-contain', size ? undefined : 'h-full w-full', className)}
    />
  );
}
