// Home's quote card, the app's _QuoteCard: one of the same seven quotes,
// picked by the day of the year so it changes daily but not on every visit.
import { Quotes } from '@/components/icons';
import { cn } from '@/lib/utils';

export const QUOTES: { quote: string; author: string }[] = [
  { quote: 'The science of today is the technology of tomorrow.', author: 'Edward Teller' },
  { quote: 'Creativity is intelligence having fun.', author: 'Albert Einstein' },
  { quote: 'Somewhere, something incredible is waiting to be known.', author: 'Carl Sagan' },
  { quote: 'The best way to predict the future is to invent it.', author: 'Alan Kay' },
  { quote: 'Design is not just what it looks like. Design is how it works.', author: 'Steve Jobs' },
  { quote: 'Pure mathematics is, in its way, the poetry of logical ideas.', author: 'Albert Einstein' },
  { quote: "What we know is a drop, what we don't know is an ocean.", author: 'Isaac Newton' },
];

/** Days since Jan 1 (0-based), like the app's dayOfYear. */
export function quoteForDay(date: Date): { quote: string; author: string } {
  const start = new Date(date.getFullYear(), 0, 1);
  const day = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - start.getTime()) / 86_400_000);
  return QUOTES[day % QUOTES.length];
}

export default function QuoteCard({ className }: { className?: string }) {
  const q = quoteForDay(new Date());
  return (
    <figure className={cn('flex flex-col justify-center rounded-3xl border border-emerald/20 bg-gradient-to-br from-emerald/10 to-emerald/[0.03] p-6', className)}>
      <Quotes className="h-7 w-7 text-emerald/70" aria-hidden />
      <blockquote className="mt-2 text-[17px] font-semibold leading-snug text-foreground">{q.quote}</blockquote>
      <figcaption className="mt-3 text-sm italic text-muted-foreground">{q.author}</figcaption>
    </figure>
  );
}
