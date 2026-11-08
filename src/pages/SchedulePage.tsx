import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, Check, Clock, MapPin, Minus, ArrowRight } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import TrackPill from '../components/TrackPill';
import { TrackTag, VersePortalProvider, useOpenVerse } from '../components/verse/ExploreVerses';
import { useTheme } from '../context/ThemeContext';
import { rgba, vibeFor } from '../models/verseVibes';
import { useRequireRole } from '../hooks/useRequireProfile';
import { useAuth } from '../context/AuthContext';
import { ownScheduleKind, useSchedule } from '../context/ScheduleContext';
import { toMinutes, useSummitContent } from '../services/summitContent';
import { MOCK_SESSIONS, type Session } from '../models/sessions';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Router state from a track page's + button: the session to add. */
export interface ScheduleLocationState {
  add?: string;
}

function startMinutes(session: Session): number {
  return toMinutes(session.time);
}

function overlaps(a: Session, b: Session): boolean {
  const startA = startMinutes(a);
  const startB = startMinutes(b);
  return startA < startB + (parseFloat(b.duration) || 0)
    && startB < startA + (parseFloat(a.duration) || 0);
}

export default function SchedulePage() {
  const { profile } = useAuth();
  const { mySchedule, expertSchedule, volunteerSchedule, spectating } = useSchedule();
  const canAdd = profile?.role === 'participant' || profile?.role === 'expert' || profile?.role === 'attendee';
  return (
    <VersePortalProvider
      mine={new Set([...mySchedule, ...expertSchedule, ...volunteerSchedule, ...spectating])}
      canSchedule={false}
      canAdd={canAdd}
    >
      <ScheduleBody />
    </VersePortalProvider>
  );
}

function ScheduleBody() {
  useSummitContent();
  const { ready, redirect } = useRequireRole(['participant', 'expert', 'volunteer', 'ambassador', 'attendee']);
  const openVerse = useOpenVerse();
  const { profile } = useAuth();
  const roleName = profile?.role ?? 'participant';
  const isVolunteer = roleName === 'volunteer' || roleName === 'ambassador';
  const { mySchedule, expertSchedule, volunteerSchedule, spectating, sessionCounts, reserveSession, releaseSession, loading, scheduleError } = useSchedule();
  const ownKind = ownScheduleKind(roleName) ?? 'spectating';
  const committed = new Set([...mySchedule, ...expertSchedule, ...volunteerSchedule, ...spectating]);
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const handledAdd = useRef<string | null>(null);

  const requestedAdd = (location.state as ScheduleLocationState | null)?.add ?? null;
  useEffect(() => {
    if (!ready || loading || !requestedAdd || handledAdd.current === requestedAdd) return;
    handledAdd.current = requestedAdd;
    navigate(location.pathname, { replace: true, state: null });
    if (scheduleError) {
      toast.error('We could not load your saved schedule. Refresh the page before making changes.');
      return;
    }
    if (isVolunteer) {
      toast.error('Volunteer sessions are assigned by an admin.');
      return;
    }
    const session = MOCK_SESSIONS.find((s) => s.id === requestedAdd);
    if (!session) return;
    if (committed.has(session.id)) {
      setJustAdded(session.id);
      toast(`${session.title} is already on your schedule.`);
      return;
    }
    const counts = sessionCounts[session.id] ?? session;
    const full = ownKind === 'judging'
      ? counts.expertsEnrolled >= session.expertCapacity
      : ownKind === 'spectating'
        ? counts.spectators >= session.spectatorCap
        : counts.enrolled >= session.capacity;
    const conflict = MOCK_SESSIONS.find((s) => committed.has(s.id) && overlaps(s, session));
    if (full) {
      toast.error(`${session.title} is full.`);
      return;
    }
    if (conflict) {
      toast.error(`${session.title} conflicts with ${conflict.title} at ${session.time}.`);
      return;
    }
    void reserveSession(session.id, ownKind).then(() => {
      setJustAdded(session.id);
      toast.success(`Added ${session.title} to your schedule.`);
    }).catch((e: Error) => toast.error(e.message));
  }, [ready, requestedAdd, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!justAdded) return;
    requestAnimationFrame(() => document.getElementById(`my-schedule-${justAdded}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    const timer = window.setTimeout(() => setJustAdded(null), 4000);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready || loading) {
    return <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  }

  const added = MOCK_SESSIONS.filter((s) => committed.has(s.id)).sort((a, b) => startMinutes(a) - startMinutes(b));

  return (
    <AppShell>
      <PageHeader label="Emerald High School · Dublin, CA" title="My Schedule" />
      {scheduleError && <p role="alert" className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">We could not load your saved schedule. Refresh the page to retry.</p>}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{added.length} session{added.length !== 1 ? 's' : ''}{isVolunteer ? ' · Volunteer sessions are assigned by an admin.' : ''}</p>
        <Link to="/disciplines" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald hover:underline">Browse sessions <ArrowRight className="h-4 w-4" /></Link>
      </div>
      {added.length === 0 && !scheduleError ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
          <CalendarDays className="h-9 w-9 text-muted-foreground/60" />
          <h2 className="text-lg font-semibold">No sessions on your schedule yet.</h2>
          <p className="text-sm text-muted-foreground">{isVolunteer ? 'Your sessions will appear here when an admin assigns them.' : 'Explore the disciplines to find sessions and add them to your day.'}</p>
          <Link to="/disciplines" className="mt-2 rounded-xl bg-emerald px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-deep">Explore the disciplines</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {added.map((s) => {
            const managing = volunteerSchedule.includes(s.id);
            const isSpec = !managing && spectating.includes(s.id);
            const label = managing ? 'Managing' : isSpec ? 'Spectating' : expertSchedule.includes(s.id) ? 'Expert' : 'Participating';
            const keynote = s.track === 'keynote';
            const accent = vibeFor(keynote ? null : s.track, theme).accent;
            return (
              <article
                key={s.id}
                id={`my-schedule-${s.id}`}
                className={cn('glass rounded-2xl border p-4 sm:p-5', justAdded === s.id && 'ring-2 ring-emerald ring-offset-2 ring-offset-background')}
                style={{ background: `linear-gradient(120deg, ${rgba(accent, 0.22)}, ${rgba(accent, 0.06)} 65%), hsl(var(--card))`, borderColor: rgba(accent, 0.3), borderLeft: `4px solid ${accent}` }}
              >
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: accent }}>{s.time}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">{label}</span>
                      {justAdded === s.id && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald"><Check className="h-3 w-3" /> Added</span>}
                    </div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {keynote ? <TrackPill track={s.track} /> : <TrackTag verse={s.track} track={s.trackName} />}
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {s.duration}</span>
                    </div>
                    <h2 className="text-base font-semibold">{keynote ? s.title : <button type="button" className="text-left hover:underline" onClick={(e) => openVerse(s.track, { x: e.clientX, y: e.clientY }, s.trackName)}>{s.title}</button>}</h2>
                    {s.speaker && <p className="mt-1 text-xs text-muted-foreground">{s.speaker}</p>}
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium" style={{ color: accent }}><MapPin className="h-3 w-3" /> {s.location}</p>
                  </div>
                  {!managing && <button
                    type="button"
                    aria-label={`Remove ${s.title} from schedule`}
                    title="Remove from schedule"
                    className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent hover:text-red-400"
                    onClick={() => void releaseSession(s.id).catch((e: Error) => toast.error(e.message))}
                  ><Minus className="h-4 w-4" /></button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
