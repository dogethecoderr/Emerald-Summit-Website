// Edit dialogs for tracks and sessions, shown on verse and track pages to
// admins and to ambassadors for their verses (services/summitContent.ts).
import { useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { TIME_SLOTS, type Session } from '../../models/sessions';
import { tracksForUniverse, type TrackFormat, type TrackInfo } from '../../models/tracks';
import { disciplineByName } from '../../models/disciplines';
import {
  deleteSession,
  deleteTrack,
  saveSession,
  saveTrack,
  type SaveResult,
  type SessionInput,
  usesSharedBackend,
} from '../../services/summitContent';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '../../context/AuthContext';

const FORMATS: TrackFormat[] = ['Workshop', 'Exhibit', 'Presentation'];
const NO_TRACK = '__none__';

function announce(result: SaveResult, what: string) {
  if (result === 'local') {
    toast(`${what} in this browser only: demo mode doesn't save to the Summit database.`);
  } else {
    toast.success(what);
  }
}

function Field({ id, label, children, className }: { id?: string; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 block text-[13px]">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Two clicks to delete: the first arms the button, the second deletes. */
function DeleteButton({
  label,
  disabled,
  busy,
  onConfirm,
}: {
  label: string;
  disabled?: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled || busy}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={cn(
        'mr-auto gap-1.5 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400',
        armed && 'bg-red-600 text-white hover:bg-red-700 hover:text-white dark:text-white',
      )}
    >
      <Trash2 className="h-4 w-4" />
      {armed ? 'Click again to delete' : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface SessionEditorTarget {
  verse: string;
  /** The session to edit; a new one when absent. */
  session?: Session;
  /** Preselected track for a new session. */
  trackName?: string;
}

const intOr = (value: string, fallback: number) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function SessionEditorDialog({
  target,
  onClose,
}: {
  target: SessionEditorTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={target != null} onOpenChange={(open) => !open && onClose()}>
      {target && <SessionForm key={target.session?.id ?? 'new'} target={target} onClose={onClose} />}
    </Dialog>
  );
}

function SessionForm({ target, onClose }: { target: SessionEditorTarget; onClose: () => void }) {
  const s = target.session;
  const shared = usesSharedBackend();
  const { profile } = useAuth();
  const [title, setTitle] = useState(s?.title ?? '');
  const [trackName, setTrackName] = useState(s?.trackName ?? target.trackName ?? '');
  const [time, setTime] = useState(s?.time ?? TIME_SLOTS[1]);
  const [duration, setDuration] = useState(s?.duration ?? '60 min');
  const [speaker, setSpeaker] = useState(s?.speaker ?? '');
  const [location, setLocation] = useState(s?.location ?? '');
  const [room, setRoom] = useState(s?.room ?? '');
  const [description, setDescription] = useState(s?.description ?? '');
  const [capacity, setCapacity] = useState(String(s?.capacity ?? 30));
  const [expertCapacity, setExpertCapacity] = useState(String(s?.expertCapacity ?? 2));
  const [spectatorCap, setSpectatorCap] = useState(String(s?.spectatorCap ?? 10));
  const [volunteerCapacity, setVolunteerCapacity] = useState(String(s?.volunteerCapacity ?? 2));
  const [busy, setBusy] = useState(false);

  const verseLabel = disciplineByName(target.verse)?.label ?? 'Keynote';
  const tracks = tracksForUniverse(target.verse);
  const canSave = title.trim().length > 0 && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const input: SessionInput = {
      track: target.verse,
      trackName: trackName || undefined,
      title,
      time,
      duration,
      speaker,
      location,
      room,
      description,
      capacity: intOr(capacity, 30),
      expertCapacity: intOr(expertCapacity, 0),
      spectatorCap: intOr(spectatorCap, 0),
      volunteerCapacity: intOr(volunteerCapacity, 0),
    };
    setBusy(true);
    try {
      announce(await saveSession(input, s?.id), s ? 'Session updated' : 'Session added');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!s) return;
    setBusy(true);
    try {
      announce(await deleteSession(s.id), 'Session deleted');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  };

  return (
    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle className="font-display">{s ? 'Edit session' : 'Add a session'}</DialogTitle>
          <DialogDescription>{verseLabel}</DialogDescription>
        </DialogHeader>

        <Field id="session-title" label="Title">
          <Input id="session-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {!shared && <Field id="session-track" label="Track">
            <Select value={trackName || NO_TRACK} onValueChange={(v) => setTrackName(v === NO_TRACK ? '' : v)}>
              <SelectTrigger id="session-track">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TRACK}>No track</SelectItem>
                {tracks.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>}
          <Field id="session-speaker" label="Led by">
            <Input id="session-speaker" value={speaker} onChange={(e) => setSpeaker(e.target.value)} />
          </Field>
          <Field id="session-time" label="Time">
            {shared ? <Input id="session-time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="10:00 AM" /> : <Select value={time} onValueChange={setTime}>
              <SelectTrigger id="session-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>}
          </Field>
          <Field id="session-duration" label="Length">
            <Input id="session-duration" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60 min" />
          </Field>
          {!shared && <Field id="session-location" label="Room name">
            <Input id="session-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Computer Lab" />
          </Field>}
          {!shared && <Field id="session-room" label="Room code (walking times)">
            <Input id="session-room" value={room} onChange={(e) => setRoom(e.target.value.toUpperCase())} maxLength={2} placeholder="C" />
          </Field>}
        </div>
        {shared && <p className="text-sm text-muted-foreground">Rooms are locked for now. Participants, spectators and experts all count toward capacity.</p>}

        <Field id="session-description" label="Description">
          <Textarea id="session-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field id="session-capacity" label="Seats">
            <Input id="session-capacity" type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </Field>
          {!shared && <><Field id="session-experts" label="Expert spots">
            <Input id="session-experts" type="number" min={0} value={expertCapacity} onChange={(e) => setExpertCapacity(e.target.value)} />
          </Field>
          <Field id="session-spectators" label="Spectator seats">
            <Input id="session-spectators" type="number" min={0} value={spectatorCap} onChange={(e) => setSpectatorCap(e.target.value)} />
          </Field>
          <Field id="session-volunteers" label="Volunteer spots">
            <Input id="session-volunteers" type="number" min={0} value={volunteerCapacity} onChange={(e) => setVolunteerCapacity(e.target.value)} />
          </Field></>}
        </div>

        <DialogFooter className="gap-2 sm:items-center">
          {s && (!shared || profile?.role === 'admin') && <DeleteButton label="Delete session" busy={busy} onConfirm={() => void remove()} />}
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave} className="bg-emerald-deep text-white hover:bg-emerald">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : s ? 'Save' : 'Add session'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Track
// ---------------------------------------------------------------------------

export interface TrackEditorTarget {
  verse: string;
  /** The track to edit; a new one when absent. */
  track?: TrackInfo;
  /** Sessions in the track; it can't be deleted while it has any. */
  sessionCount?: number;
}

export function TrackEditorDialog({
  target,
  onClose,
  onSaved,
}: {
  target: TrackEditorTarget | null;
  onClose: () => void;
  /** Called with the saved name (it may have been renamed), or null when deleted. */
  onSaved?: (name: string | null) => void;
}) {
  return (
    <Dialog open={target != null} onOpenChange={(open) => !open && onClose()}>
      {target && (
        <TrackForm key={target.track?.name ?? 'new'} target={target} onClose={onClose} onSaved={onSaved} />
      )}
    </Dialog>
  );
}

function TrackForm({
  target,
  onClose,
  onSaved,
}: {
  target: TrackEditorTarget;
  onClose: () => void;
  onSaved?: (name: string | null) => void;
}) {
  const t = target.track;
  const [name, setName] = useState(t?.name ?? '');
  const [about, setAbout] = useState(t?.about ?? '');
  const [ideas, setIdeas] = useState((t?.ideas ?? []).join('\n'));
  const [formats, setFormats] = useState<TrackFormat[]>(t?.formats ?? ['Workshop']);
  const [busy, setBusy] = useState(false);
  const verseLabel = disciplineByName(target.verse)?.label ?? target.verse;
  const canSave = name.trim().length > 0 && !busy;
  const hasSessions = (target.sessionCount ?? 0) > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    try {
      const result = await saveTrack(
        { verse: target.verse, name, about, ideas: ideas.split('\n'), formats },
        t?.name,
      );
      announce(result, t ? 'Track updated' : 'Track added');
      onSaved?.(name.trim());
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!t) return;
    setBusy(true);
    try {
      announce(await deleteTrack(target.verse, t.name), 'Track deleted');
      onSaved?.(null);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  };

  return (
    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle className="font-display">{t ? 'Edit track' : 'Add a track'}</DialogTitle>
          <DialogDescription>{verseLabel}</DialogDescription>
        </DialogHeader>

        <Field id="track-name" label="Name">
          <Input id="track-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
        </Field>
        <Field id="track-about" label="What it covers">
          <Textarea id="track-about" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} maxLength={600} />
        </Field>
        <Field id="track-ideas" label="What you can do (one per line)">
          <Textarea id="track-ideas" rows={4} value={ideas} onChange={(e) => setIdeas(e.target.value)} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">Formats</legend>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => {
              const on = formats.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setFormats((cur) => (on ? cur.filter((x) => x !== f) : [...cur, f]))}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                    on ? 'border-transparent bg-emerald-deep text-white' : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </fieldset>

        <DialogFooter className="gap-2 sm:items-center">
          {t && (
            <DeleteButton
              label={hasSessions ? 'Has sessions' : 'Delete track'}
              disabled={hasSessions}
              busy={busy}
              onConfirm={() => void remove()}
            />
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave} className="bg-emerald-deep text-white hover:bg-emerald">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t ? 'Save' : 'Add track'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
