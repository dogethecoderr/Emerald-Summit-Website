import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FaqItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Who can attend Emerald Summit?',
    a: 'Any Tri-Valley high schooler — last year’s Summit drew 225+ signups from six schools. Come as a competitor, or just stop by to explore as a spectator.',
  },
  {
    q: 'When and where is the next Summit?',
    a: 'January 2027 at Emerald High School, 3600 Central Pkwy, Dublin, CA.',
  },
  {
    q: 'What are the six universes?',
    a: 'TechVerse, BioSphere, NovaSphere, ImagineX, VentureVerse, and CivicVerse — 20+ tracks and 30+ visiting experts across them.',
  },
  {
    q: 'Do I need a team?',
    a: 'No — every track is open to solo competitors. Team up if you want, but it’s never required.',
  },
  {
    q: 'Is it free?',
    a: 'Yes, Emerald Summit is 100% free to attend and compete in.',
  },
  {
    q: 'Do I need to be technical to join?',
    a: 'Not at all. The six universes span arts, business, civics, and science — not just tech.',
  },
  {
    q: 'What’s the difference between competing and spectating?',
    a: 'Competitors reserve a seat in a track and are judged; spectators can sit in and watch without competing. Both are booked in the schedule builder.',
  },
  {
    q: 'Can I get involved beyond competing?',
    a: 'Yes — sign in as a Volunteer to help run the day, or as an Expert to judge a track. Check-in on the day is one tap at the front desk.',
  },
];

function FaqRow({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border/70 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[15px] font-semibold text-foreground lg:text-base">
          {item.q}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300',
            open && 'rotate-180 text-emerald-mint',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-all duration-300 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-sm leading-relaxed text-muted-foreground lg:text-[15px]">
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 py-20 lg:scroll-mt-24 lg:py-28">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-emerald-mint">
        Questions
      </p>
      <h2 className="mt-3 font-hero text-3xl font-bold leading-tight tracking-tight text-navy-bright sm:text-4xl lg:text-5xl">
        Frequently asked <span className="text-gradient-emerald">questions</span>
      </h2>

      <div className="glass mt-10 rounded-2xl px-5 lg:px-7">
        {FAQ_ITEMS.map((item, i) => (
          <FaqRow
            key={item.q}
            item={item}
            open={openIndex === i}
            onToggle={() => setOpenIndex((current) => (current === i ? null : i))}
          />
        ))}
      </div>
    </section>
  );
}
