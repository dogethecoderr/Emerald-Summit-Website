// The public Lineup page (/lineup; /keynote-and-team until Nov 25, 2026):
// Keynote, Sponsors, Experts and Team, reached from the landing nav's Summit '27
// menu and the landing page's previews, each of which scrolls to its own
// section here. Team shares its profiles with the portal, while Experts fills
// in by itself (ExpertsDirectory). /experts lands on Experts.
//
// Sponsors is pinned on wider screens: as the reader scrolls, the pyramid
// zooms in on one tier at a time (SponsorTiers' focus mode), like the landing
// page's "What happens on Summit day?" terraces.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import LandingNav from '../components/LandingNav';
import LandingFooter from '../components/LandingFooter';
import { LINEUP_SECTIONS, LineupBody } from '../components/LineupSections';
import { SPONSOR_TIERS } from '../models/sponsors';
import { useIsPhoneScreen } from '../lib/device';
import { cn } from '@/lib/utils';
import '../landing/landing.css';
import { usePageMeta, useJsonLd } from '../lib/pageMeta';

export default function LineupPage() {
  const location = useLocation();

  usePageMeta({
    title: "Lineup — Emerald Summit 2027: Keynote, Sponsors, Experts & Team",
    description: "Who makes Emerald Summit happen: the keynote speaker, sponsors, visiting industry experts, and the student team running the Jan 23, 2027 event at Emerald High School, Dublin, CA.",
    path: '/lineup',
  });
  useJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Emerald Summit', item: 'https://emerald-summit.vercel.app/' },
        { '@type': 'ListItem', position: 2, name: 'Lineup', item: 'https://emerald-summit.vercel.app/lineup' },
      ],
    },
  ]);

  // The nav and the landing previews send { scrollTo: 'sponsors' } (or another section) when they bring you here.
  useEffect(() => {
    // Jump, not glide: the page opens at the landing page's scroll position, and a
    // long smooth scroll outruns painting, flashing empty bands on the way.
    const id = (location.state as { scrollTo?: string } | null)?.scrollTo;
    const frame = requestAnimationFrame(() => {
      const el = id ? document.getElementById(id) : null;
      if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.state]);

  return (
    <div className="lp lp-page">
      <LandingNav />
      <main id="main" className="lp-lineup">
        {LINEUP_SECTIONS.map((s) =>
          s.id === 'sponsors' ? (
            <SponsorsSection key={s.id} title={s.title} lead={s.lead} />
          ) : (
            <section key={s.id} id={s.id} className="lp-section" aria-labelledby={`${s.id}-title`}>
              <div className="container">
                <div className="lp-head">
                  <h2 id={`${s.id}-title`}>{s.title}</h2>
                  {s.lead && <p className="lead">{s.lead}</p>}
                </div>
                <LineupBody id={s.id} />
              </div>
            </section>
          ),
        )}
      </main>
      <LandingFooter />
    </div>
  );
}

/**
 * Sponsors, pinned: a tall track whose stage stays put while the scroll
 * through it is split evenly between the tiers, Capstone first. Phones and
 * reduced motion get the plain pyramid.
 */
function SponsorsSection({ title, lead }: { title: string; lead?: string }) {
  const phone = useIsPhoneScreen();
  const reduce = useReducedMotion();
  const pinned = !phone && !reduce;
  const ref = useRef<HTMLElement>(null);
  const [tier, setTier] = useState(0);

  useEffect(() => {
    const section = ref.current;
    if (!pinned || !section) return;
    const count = SPONSOR_TIERS.length;
    // One rect read per scroll event (browsers fire it at most once a frame); state changes only on a new tier.
    const onScroll = () => {
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom < 0 || r.top > vh) return;
      const p = -r.top / Math.max(1, r.height - vh);
      setTier(Math.min(count - 1, Math.max(0, Math.floor(p * count))));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [pinned]);

  return (
    <section ref={ref} id="sponsors" className={cn('lp-section', pinned && 'lp-tierpin')} aria-labelledby="sponsors-title">
      <div className={cn('container', pinned && 'lp-tierpin__stage')}>
        <div className="lp-head lp-head--row">
          <h2 id="sponsors-title">{title}</h2>
          {pinned && (
            <p className="lp-tierpin__step num" aria-hidden>
              {String(tier + 1).padStart(2, '0')} / {String(SPONSOR_TIERS.length).padStart(2, '0')} · {SPONSOR_TIERS[tier].name}
            </p>
          )}
        </div>
        {lead && !pinned && <p className="lead">{lead}</p>}
        <LineupBody id="sponsors" focus={pinned ? tier : undefined} />
      </div>
    </section>
  );
}
