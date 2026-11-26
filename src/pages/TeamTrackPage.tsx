import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import LandingNav from '../components/LandingNav';
import LandingFooter from '../components/LandingFooter';
import '../landing/landing.css';
import { MOCK_SESSIONS } from '../models/sessions';
import type { TeamLinkKey } from '../models/team';
import { teamTarget, teamTrackMatches } from '../models/teamLinks';
import { contentSource, loadSummitContent, usesSharedBackend, useSummitContent } from '../services/summitContent';

/** Stable bio links resolve against the current catalog instead of embedding environment-specific IDs. */
export default function TeamTrackPage() {
  const { key = '' } = useParams();
  const { state } = useLocation();
  useSummitContent();
  const target = teamTarget(key);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const returnTo = (state as { teamReturnTo?: string } | null)?.teamReturnTo === '/summit-27/team'
    ? '/summit-27/team' : '/lineup';

  useEffect(() => {
    if (target?.kind !== 'track') return;
    if (attempt === 0 && contentSource() === 'database' && MOCK_SESSIONS.length > 0) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void loadSummitContent()
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [key, attempt, target]);

  if (target?.kind === 'discipline') {
    return <Navigate to={'/disciplines?verse=' + encodeURIComponent(target.discipline)} replace />;
  }
  const matches = target && !loading && usesSharedBackend() && contentSource() === 'database'
    ? teamTrackMatches(key as TeamLinkKey, MOCK_SESSIONS) : [];
  if (matches.length === 1) {
    return <Navigate to={'/sessions/' + encodeURIComponent(matches[0].id)} replace />;
  }

  const body = (
    <main id="main" className="mx-auto max-w-3xl space-y-5 px-6 py-12">
      <Link to={returnTo} state={{ scrollTo: 'team' }} className="text-sm font-semibold text-emerald underline underline-offset-2">
        Back to Team
      </Link>
      <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground sm:p-8">
        <h1 className="font-display text-2xl font-bold">{target?.label ?? 'Track not found'}</h1>
        {loading && target ? (
          <p role="status" className="mt-4 text-muted-foreground">Opening track details…</p>
        ) : matches.length > 1 ? (
          <>
            <p className="mt-3 text-muted-foreground">Choose the track you would like to explore.</p>
            <ul className="mt-5 space-y-3">
              {matches.map((session) => (
                <li key={session.id}>
                  <Link className="font-semibold text-emerald underline underline-offset-2" to={'/sessions/' + encodeURIComponent(session.id)}>
                    {session.title}{session.time ? ' · ' + session.time : ''}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="mt-3 text-muted-foreground">Track details are not available right now. Please try again or browse the published tracks.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {target && <Button onClick={() => setAttempt((value) => value + 1)}>Try again</Button>}
              <Button asChild variant="outline"><Link to="/disciplines">Explore tracks</Link></Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
  // Reached from the public Team section: keep the landing page's navbar and footer around it.
  return returnTo === '/lineup' ? (
    <div className="lp lp-page">
      <LandingNav />
      <div className="lp-lineup">{body}</div>
      <LandingFooter />
    </div>
  ) : body;
}
