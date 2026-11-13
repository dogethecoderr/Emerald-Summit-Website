// Volunteer hours, ported from the app's volunteer_hours_screen.dart:
// sessions managed on summit day count automatically once they end, and
// everything else is logged by hand (volunteer_hour_logs, own rows only).
import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from '@/components/icons';
import { useRequireRole } from '../hooks/useRequireProfile';
import { useSchedule } from '../context/ScheduleContext';
import { MOCK_SESSIONS, type Session } from '../models/sessions';
import { localDay, useSummitStatus } from '../services/summitStatus';
import { toMinutes, useSummitContent } from '../services/summitContent';
import { TBD, useSiteSwitches } from '../services/siteSwitches';
import { deleteHourLog, fetchMyHourLogs, logMinutes, saveHourLog, type HourLog } from '../services/organizer';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDay(d: Date): string {
  const year = d.getFullYear() === new Date().getFullYear() ? '' : `, ${d.getFullYear()}`;
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}${year}`;
}
export function formatClock(d: Date): string {
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}
/** "2 hr 30 min", "45 min", "3 hr". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
/** Hours with at most two decimals: 150 → "2.5", 100 → "1.67". */
export function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(/\.?0+$/, '');
}

function sessionMinutes(s: Session): number {
  const start = toMinutes(s.start ?? s.time);
  const end = s.end ? toMinutes(s.end) : start + (parseInt(s.duration, 10) || 0);
  return Math.max(0, end - start);
}

/** True once the session has ended on summit day. */
function counted(s: Session, date: string | null, now: Date): boolean {
  if (!date) return false;
  const end = localDay(date);
  end.setMinutes(toMinutes(s.start ?? s.time) + sessionMinutes(s));
  return now.getTime() >= end.getTime();
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function VolunteerHoursPage() {
  useSummitContent();
  const { ready, redirect } = useRequireRole(['volunteer', 'ambassador', 'admin']);
  const { volunteerSchedule } = useSchedule();
  const status = useSummitStatus();
  const { showTimes } = useSiteSwitches();
  const [logs, setLogs] = useState<HourLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<HourLog | 'new' | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchMyHourLogs().then(setLogs).catch(() => setError("Couldn't load your hours."));
  }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) return <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;

  const now = new Date();
  const sessions = MOCK_SESSIONS.filter((s) => volunteerSchedule.includes(s.id))
    .sort((a, b) => toMinutes(a.start ?? a.time) - toMinutes(b.start ?? b.time));
  const summitMinutes = sessions.filter((s) => counted(s, status.date, now)).reduce((n, s) => n + sessionMinutes(s), 0);
  const loggedMinutes = (logs ?? []).reduce((n, l) => n + logMinutes(l), 0);
  const total = summitMinutes + loggedMinutes;

  return (
    <AppShell>
      <PageHeader label="Volunteering" title="Volunteer hours" />
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-border p-5">
          <p className="font-semibold">Total</p>
          <p className="mt-1">
            <span className="font-display text-4xl font-bold text-emerald tabular-nums">{formatHours(total)}</span>{' '}
            <span className="text-sm">{total === 60 ? 'hour' : 'hours'}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatHours(loggedMinutes)} logged by you · {formatHours(summitMinutes)} on summit day
          </p>
        </section>
        <Button onClick={() => setEditing('new')} className="bg-emerald text-white hover:bg-emerald-deep"><Plus className="h-4 w-4" /> Add hours</Button>

        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">Summit day</h2>
            <p className="text-sm text-muted-foreground">Tracked for you. No need to log it.</p>
          </div>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            {status.date
              ? `Each session you manage on ${formatDay(localDay(status.date))} is added to your total after it ends, counted from its start time to its end time.`
              : 'Each session you manage on summit day is added to your total after it ends, counted from its start time to its end time. They will start counting once the summit date is set.'}
          </p>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">You aren't managing any sessions yet. When an admin assigns you one, its hours show up here.</p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border px-4">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{[showTimes ? s.time : `Time ${TBD}`, s.disciplineName].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{showTimes ? formatMinutes(sessionMinutes(s)) : TBD}</p>
                    {!counted(s, status.date, now) && <p className="text-xs text-muted-foreground">Not counted yet</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">Your logs</h2>
            <p className="text-sm text-muted-foreground">Planning, setup, and anything else outside summit day.</p>
          </div>
          {error ? (
            <div className="space-y-2 text-sm"><p role="alert" className="text-destructive">{error}</p><Button variant="outline" size="sm" onClick={load}>Try again</Button></div>
          ) : logs == null ? (
            <Skeleton className="h-20 w-full" />
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing logged yet. Select Add hours to log your first one.</p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border px-4">
              {logs.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => setEditing(l)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-accent/30">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium">{l.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDay(l.startedAt)} · {formatClock(l.startedAt)} – {formatClock(l.endedAt)}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatMinutes(logMinutes(l))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {editing && <HourEditor log={editing === 'new' ? null : editing} onClose={(changed) => { setEditing(null); if (changed) load(); }} />}
    </AppShell>
  );
}

function HourEditor({ log, onClose }: { log: HourLog | null; onClose: (changed: boolean) => void }) {
  const [day, setDay] = useState(dateInput(log?.startedAt ?? new Date()));
  const [start, setStart] = useState(log ? timeInput(log.startedAt) : '');
  const [end, setEnd] = useState(log ? timeInput(log.endedAt) : '');
  const [description, setDescription] = useState(log?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const at = (t: string) => (t && day ? new Date(`${day}T${t}`) : null);
  const s = at(start);
  const e = at(end);
  const minutes = s && e && e > s ? Math.floor((e.getTime() - s.getTime()) / 60000) : null;

  const save = async () => {
    if (!s || !e) return setError('Pick a start and end time.');
    if (e <= s) return setError('The end time has to be after the start.');
    if (e > new Date()) return setError("You can't log hours that haven't happened yet.");
    if (!description.trim()) return setError('Add a short description of what you did.');
    setSaving(true);
    try {
      await saveHourLog({ startedAt: s, endedAt: e, description: description.trim() }, log?.id);
      onClose(true);
    } catch {
      setError("Couldn't save. Try again.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!log) return;
    setSaving(true);
    try {
      await deleteHourLog(log.id);
      onClose(true);
    } catch {
      toast.error("Couldn't delete. Try again.");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{log ? 'Edit hours' : 'Add hours'}</DialogTitle></DialogHeader>
        {confirmDelete ? (
          <>
            <p className="text-sm">Delete this log? Its {minutes != null ? formatMinutes(minutes) : 'time'} comes off your total.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="destructive" disabled={saving} onClick={() => void remove()}>Delete</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="hours-day">Date</Label><Input id="hours-day" type="date" max={dateInput(new Date())} value={day} onChange={(ev) => setDay(ev.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="hours-start">Start</Label><Input id="hours-start" type="time" value={start} onChange={(ev) => setStart(ev.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="hours-end">End</Label><Input id="hours-end" type="time" value={end} onChange={(ev) => setEnd(ev.target.value)} /></div>
              </div>
              {minutes != null && <p className="text-sm text-muted-foreground">Length: {formatMinutes(minutes)}</p>}
              <div className="space-y-1.5">
                <Label htmlFor="hours-what">What did you do?</Label>
                <Textarea id="hours-what" rows={3} placeholder="Planning meeting for the Techverse exhibits" value={description} onChange={(ev) => setDescription(ev.target.value)} />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter className="gap-2">
              {log && <Button variant="ghost" className="text-destructive sm:mr-auto" onClick={() => setConfirmDelete(true)}>Delete</Button>}
              <Button variant="outline" onClick={() => onClose(false)}>Cancel</Button>
              <Button disabled={saving} onClick={() => void save()} className="bg-emerald text-white hover:bg-emerald-deep">{saving ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
