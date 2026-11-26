// The Lineup page's sections, shared by the page itself (src/pages/LineupPage.tsx)
// and the landing page's "Who makes the Summit happen?" previews
// (LineupPreview.tsx), so a preview is always the real thing, never a stale picture.
import ExpertsDirectory, { EXPERTS_INTRO } from './ExpertsDirectory';
import TeamDirectory from './TeamDirectory';
import SponsorTiers from './SponsorTiers';

export type LineupId = 'keynote' | 'sponsors' | 'experts' | 'team';

/** The page's order: Keynote, Sponsors, Experts, Team. The landing previews follow it. */
export const LINEUP_SECTIONS: { id: LineupId; title: string; lead?: string }[] = [
  { id: 'keynote', title: 'Keynote' },
  { id: 'sponsors', title: 'Sponsors' },
  { id: 'experts', title: 'Experts', lead: EXPERTS_INTRO },
  { id: 'team', title: 'Team' },
];

export const LINEUP_PATH = '/lineup';

/**
 * A section's body, under its heading. `focus` drives the Sponsors pyramid's zoom (the pinned page section only);
 * `preview` is the landing page's picture of it (no sponsor buttons).
 */
export function LineupBody({ id, focus, preview = false }: { id: LineupId; focus?: number; preview?: boolean }) {
  switch (id) {
    case 'keynote':
      return (
        <div className="lp-soon">
          <p className="lp-soon__tag">Coming soon</p>
          <p>This year’s keynote speaker will be announced soon.</p>
        </div>
      );
    case 'sponsors':
      return <SponsorTiers focus={focus} preview={preview} />;
    case 'experts':
      return <ExpertsDirectory />;
    case 'team':
      return <TeamDirectory preview={preview} />;
  }
}
