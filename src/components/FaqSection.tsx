import { useState } from 'react';
import { ChevronDown } from '@/components/icons';
import { cn } from '@/lib/utils';

interface FaqItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Who can attend Emerald Summit?',
    a: 'Any Tri-Valley high schooler. Last year’s Summit drew 225+ signups from six schools. Bring a project or an idea to share, or come to look around as a spectator.',
  },
  {
    q: 'When and where is the next Summit?',
    a: 'Saturday, January 23, 2027, at Emerald High School, 3600 Central Pkwy, Dublin, CA.',
  },
  {
    q: 'What are the six universes?',
    a: 'TechVerse, BioSphere, NovaSphere, ImagineX, VentureVerse, and CivicVerse, with 20+ tracks and 30+ visiting experts across them.',
  },
  {
    q: 'Do I need a team?',
    a: 'No. Come on your own or with friends. A team is never required.',
  },
  {
    q: 'Is it free?',
    a: 'Yes. Emerald Summit is free.',
  },
  {
    q: 'Do I need to be technical to join?',
    a: 'Not at all. The six universes span arts, business, civics, and science, as well as tech.',
  },
  {
    q: 'What’s the difference between participating and spectating?',
    a: 'Participants book a seat in a session to share their work and get feedback. Spectators sit in and watch. Both book seats in the schedule builder.',
  },
  {
    q: 'Can I help out in other ways?',
    a: 'Yes. Sign in as a Volunteer to help run the day, or as an Expert to lead a session and give feedback. Check-in on the day is one tap at the front desk.',
  },
];

function FaqRow({
  item,
  index,
  open,
  onToggle,
}: {
  item: FaqItem;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `faq-answer-${index}`;
  return (
    <div className="lp-faq__row">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="lp-faq__q"
      >
        <span>{item.q}</span>
        <ChevronDown className="lp-faq__icon" aria-hidden />
      </button>
      <div id={panelId} className={cn('lp-faq__a', open && 'is-open')}>
        <div>
          <p>{item.a}</p>
        </div>
      </div>
    </div>
  );
}

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="lp-section" aria-labelledby="faq-title">
      <div className="container lp-grid">
        <div className="lp-faq__head">
          <h2 id="faq-title">Anything else before January?</h2>
        </div>

        <div className="lp-faq__list">
          {FAQ_ITEMS.map((item, i) => (
            <FaqRow
              key={item.q}
              item={item}
              index={i}
              open={openIndex === i}
              onToggle={() => setOpenIndex((current) => (current === i ? null : i))}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
