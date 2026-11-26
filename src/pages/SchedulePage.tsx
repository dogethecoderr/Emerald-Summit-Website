import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, Check, Clock, MapPin, Minus, MoreHorizontal, ArrowRight, Plus } from '@/components/icons';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import TrackPill from '../components/TrackPill';
import { useTheme } from '../context/ThemeContext';
import { rgba, vibeFor } from '../models/verseVibes';
import { useRequireRole } from '../hooks/useRequireProfile';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { projectProblemMessage } from '../models/registration';
import { toMinutes, useSummitContent } from '../services/summitContent';
import { TBD, useSiteSwitches } from '../services/siteSwitches';
import { MOCK_SESSIONS, sessionPlace, type Session } from '../models/sessions';
import { bookedMinutes, formatMinutes } from '../models/suggested';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function startMinutes(session: Session): number {
  return toMinutes(session.time);
}

export default function SchedulePage() {
  useSummitContent();
  const { ready, redirect } = useRequireRole(['participant', 'expert', 'volunteer', 'ambassador', 'attendee', 'admin']);
  const { profile } = useAuth();
  const roleName = profile?.role ?? 'participant';
  const isVolunteer = roleName === 'volunteer' || roleName === 'ambassador';
  const { mySchedule, expertSchedule, volunteerSchedule, spectating, releaseSession, loading, scheduleError } = useSchedule();
  const committed = new Set([...mySchedule, ...expertSchedule, ...volunteerSchedule, ...spectating]);
  const { theme } = useTheme();
  const { showTimes, maxParticipating } = useSiteSwitches();
  const navigate = useNavigate();
  const [justAdded, setJustAdded] = useState<string | null>(null);
  // The track the ⋯ menu asked to remove, waiting for a yes.
  const [confirmRemove, setConfirmRemove] = useState<Session | null>(null);
  const [removing, setRemoving] = useState(false);

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
  // Time booked in sessions they registered for (not ones they manage), and
  // how many more they can participate in (participation_cap.sql).
  const booked = bookedMinutes(added.filter((s) => !volunteerSchedule.includes(s.id)));
  const participating = mySchedule.length;

  const remove = async (s: Session) => {
    setRemoving(true);
    try {
      await releaseSession(s.id);
      toast.success(`Removed "${s.title}" from your day`);
    } catch (e) {
      // A team owner with teammates picks a new owner first, which the
      // session page does, like the app.
      const message = (e as Error).message;
      if (message === projectProblemMessage('choose_new_owner')) {
        toast(message);
        navigate(`/sessions/${s.id}`);
      } else toast.error(message);
    } finally {
      setRemoving(false);
      setConfirmRemove(null);
    }
  };

  return (
    <AppShell>
      <PageHeader label="Emerald High School, Dublin, CA" title="My Day" />
      {scheduleError && <p role="alert" className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">We could not load your saved schedule. Refresh the page to retry.</p>}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px]">
            <span className="font-bold">{added.length} session{added.length !== 1 ? 's' : ''}</span>
            {showTimes && booked > 0 && <span className="text-muted-foreground">{'  ·  '}{formatMinutes(booked)} booked</span>}
          </p>
          {isVolunteer && <p className="text-sm text-muted-foreground">Volunteer tracks are assigned by an organizer.</p>}
          {!isVolunteer && maxParticipating != null && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Participating in {participating} of {maxParticipating} tracks. You can spectate as many as you like.
            </p>
          )}
        </div>
      </div>
      {added.length === 0 && !scheduleError ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
          <CalendarDays className="h-9 w-9 text-muted-foreground/60" />
          <h2 className="text-lg font-semibold">No tracks on your schedule yet.</h2>
          <p className="text-sm text-muted-foreground">{isVolunteer ? 'Your tracks will appear here when an organizer assigns them.' : 'Explore the disciplines to find tracks and add them to your day.'}</p>
          <Link to="/disciplines" className="mt-2 rounded-xl bg-emerald px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-deep">Explore</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {added.map((s) => {
            const managing = volunteerSchedule.includes(s.id);
            const isSpec = !managing && spectating.includes(s.id);
            const label = managing ? 'Managing' : isSpec ? 'Spectating' : expertSchedule.includes(s.id) ? 'Expert' : 'Participating';
            const keynote = s.track === 'keynote';
            // Each card wears its verse's own colors, the same as the verse page.
            const vibe = vibeFor(keynote ? null : s.track, theme);
            const accent = vibe.accent;
            return (
              <article
                key={s.id}
                id={`my-schedule-${s.id}`}
                className={cn('rounded-2xl p-4 sm:p-5', justAdded === s.id && 'ring-2 ring-emerald ring-offset-2 ring-offset-background')}
                style={{
                  // The verse's own canvas colour, as on its Explore card and verse page.
                  background: `radial-gradient(120% 140% at 0% 0%, ${rgba(vibe.flowColors[0], 0.22)}, transparent 60%), ${vibe.background}`,
                  color: vibe.text,
                  border: `1px solid ${rgba(accent, 0.4)}`,
                  borderLeft: `4px solid ${accent}`,
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: accent }}>{showTimes ? s.time : `Time ${TBD}`}</span>
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: rgba(accent, 0.18), color: accent }}>{label}</span>
                      {justAdded === s.id && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald"><Check className="h-3 w-3" /> Added</span>}
                    </div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {keynote && <TrackPill track={s.track} />}
                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: vibe.textDim }}><Clock className="h-3 w-3" /> {showTimes ? s.duration : TBD}</span>
                    </div>
                    <h2 className="text-base font-semibold"><Link to={`/sessions/${s.id}`} className="text-left hover:underline">{s.title}</Link></h2>
                    {s.speaker && <p className="mt-1 text-xs" style={{ color: vibe.textDim }}>{s.speaker}</p>}
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: vibe.textDim }}>{s.description}</p>
                    {sessionPlace(s) && <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium" style={{ color: accent }}><MapPin className="h-3 w-3" /> {sessionPlace(s)}</p>}
                  </div>
                  {/* Remove sits behind ⋯, like the announcement menu, so it is
                      not one stray tap away. Tracks an organizer assigned
                      (Managing) only get Open track. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`More options for ${s.title}`}
                      className="-mr-1 -mt-1 shrink-0 rounded-full p-2 transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald"
                      style={{ color: accent, background: rgba(accent, 0.14), border: `1px solid ${rgba(accent, 0.35)}` }}
                    >
                      <MoreHorizontal className="h-5 w-5" weight="bold" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => navigate(`/sessions/${s.id}`)}>
                        <ArrowRight className="h-4 w-4" /> Open track
                      </DropdownMenuItem>
                      {!managing && (
                        <DropdownMenuItem onSelect={() => setConfirmRemove(s)} className="text-destructive focus:text-destructive">
                          <Minus className="h-4 w-4" /> Remove from my day
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </article>
            );
          })}
          <Link
            to="/disciplines"
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald/40 px-4 py-4 text-[15px] font-semibold text-emerald transition-colors hover:border-emerald hover:bg-emerald/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald"
          >
            <Plus className="h-5 w-5" /> Add a track
          </Link>
        </div>
      )}
      <Dialog open={confirmRemove != null} onOpenChange={(o) => !o && !removing && setConfirmRemove(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove from your day?</DialogTitle>
            <DialogDescription>
              "{confirmRemove?.title}" will come off your schedule. You can add it again later if seats are left.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={removing} onClick={() => setConfirmRemove(null)}>Keep it</Button>
            <Button variant="destructive" disabled={removing} onClick={() => confirmRemove && void remove(confirmRemove)}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
