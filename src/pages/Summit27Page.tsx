// The Summit '27 page (/summit-27/:tab), inside the signed-in portal: one
// sidebar tab, with Keynote, Team, Experts and Sponsors as tabs across the top of the
// page. Opening it from the sidebar plays the intro (Summit27Intro.tsx, run
// from above the routes), whose logo lands in Support EAF (Donate and
// Volunteer with EAF), under every tab. The sponsor pyramid
// (src/components/SponsorTiers.tsx) is also on the landing page.
import { Navigate, NavLink, useParams } from 'react-router-dom';
import { Award, Handshake, Keynote, Team, type AppIcon } from '@/components/icons';
import AppShell from '../components/AppShell';
import { ROLL_ATTR } from '../components/Summit27Intro';
import { SupportEafCard } from '../components/home/AboutSections';
import SponsorTiers from '../components/SponsorTiers';
import ExpertsDirectory, { EXPERTS_INTRO } from '../components/ExpertsDirectory';
import TeamDirectory from '../components/TeamDirectory';
import { useRequireProfile } from '../hooks/useRequireProfile';
import { SUMMIT_DATE_LABEL, SUMMIT_HOURS, VENUE } from '../models/summitFacts';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const SUMMIT27_TABS: { id: string; label: string; icon: AppIcon }[] = [
  // The public Lineup page's order (src/components/LineupSections.tsx).
  { id: 'keynote', label: 'Keynote', icon: Keynote },
  { id: 'sponsors', label: 'Sponsors', icon: Handshake },
  { id: 'experts', label: 'Experts', icon: Award },
  { id: 'team', label: 'Team', icon: Team },
];

const HEADING = "Summit '27";

/**
 * The page's one heading, "Summit '27" (no per-tab title: the tabs under it
 * say where you are). Each letter is its own box so the intro can roll them
 * in (`ROLL_ATTR`, Summit27Intro.tsx); otherwise it's plain text.
 */
function Summit27Heading() {
  return (
    <header className="mb-6">
      <h1 aria-label={HEADING} className="font-display text-4xl font-bold text-foreground md:text-5xl">
        <span aria-hidden {...{ [ROLL_ATTR]: '' }} className="inline-block [perspective:700px]">
          {[...HEADING].map((c, i) => (
            <span key={i} className="inline-block origin-bottom whitespace-pre">
              {c}
            </span>
          ))}
        </span>
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
        {SUMMIT_DATE_LABEL} · {SUMMIT_HOURS} · {VENUE}
      </p>
    </header>
  );
}

function ComingSoon({ children }: { children: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <p className="inline-block rounded-full bg-emerald/10 px-3 py-1 text-[12.5px] font-semibold text-emerald">
        Coming soon
      </p>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed">{children}</p>
    </div>
  );
}

export default function Summit27Page() {
  const { tab } = useParams();
  const { ready, redirect } = useRequireProfile();
  const current = SUMMIT27_TABS.find((t) => t.id === tab);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!current) return <Navigate to="/summit-27/keynote" replace />;
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <AppShell>
      <Summit27Heading />

      <nav aria-label="Summit '27" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {SUMMIT27_TABS.map(({ id, label, icon: Icon }) => (
          <NavLink
            key={id}
            to={`/summit-27/${id}`}
            className={({ isActive }) =>
              cn(
                '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[14px] font-semibold transition-colors',
                isActive
                  ? 'border-emerald text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      {current.id === 'keynote' && <ComingSoon>This year's keynote speaker will be announced soon.</ComingSoon>}
      {current.id === 'team' && <TeamDirectory />}
      {current.id === 'experts' && (
        <div className="space-y-4">
          <p className="max-w-2xl text-[15px] leading-relaxed">{EXPERTS_INTRO}</p>
          <ExpertsDirectory />
        </div>
      )}
      {current.id === 'sponsors' && <SponsorTiers />}

      <hr className="my-8 border-t border-border/80" aria-hidden />

      <SupportEafCard introTarget />
    </AppShell>
  );
}
