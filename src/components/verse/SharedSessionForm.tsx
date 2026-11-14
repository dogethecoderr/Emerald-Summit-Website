// The session editor against the shared database, matching the app's
// session_editor_screen.dart: start and end times, seats, team size, the
// participant deadline, the project question's wording, the session's own
// questions and page sections, and whether 8th graders may participate. Rooms stay locked and the old free-text
// expert line is gone, as in the app. A time change that clashes with
// people's schedules is confirmed first and they're told after saving.
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, X } from '@/components/icons';
import { useAuth } from '../../context/AuthContext';
import { disciplineByName } from '../../models/disciplines';
import type { Session } from '../../models/sessions';
import {
  DEFAULT_MAX_TEAM_SIZE,
  DEFAULT_QUESTIONS,
  formatDeadline,
  LARGEST_TEAM_SIZE_LIMIT,
  SOLO_ONLY_TEAM_SIZE,
  teamCodePrefix,
} from '../../models/registration';
import {
  deleteSession,
  hasEighthGradeColumn,
  notifyTimeConflicts,
  previewTimeConflicts,
  saveSessionColumns,
  toMinutes,
} from '../../services/summitContent';
import { fetchSessionRoster } from '../../services/organizer';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** A Date as the value of an <input type="datetime-local"> (local time). */
function localInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Confirm = { title: string; body: string; resolve: (ok: boolean) => void };

export default function SharedSessionForm({
  verse,
  session: s,
  onClose,
}: {
  verse: string;
  session?: Session;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const startMin = s ? toMinutes(s.start ?? s.time) : 10 * 60;
  const endMin = s?.end ? toMinutes(s.end) : startMin + (parseInt(s?.duration ?? '60', 10) || 60);
  const [title, setTitle] = useState(s?.title ?? '');
  const [start, setStart] = useState(hhmm(startMin));
  const [end, setEnd] = useState(hhmm(endMin));
  const [capacity, setCapacity] = useState(String(s?.capacity ?? 30));
  const [maxTeamSize, setMaxTeamSize] = useState(s?.maxTeamSize ?? DEFAULT_MAX_TEAM_SIZE);
  const [allowEighth, setAllowEighth] = useState(s?.allowEighthGraders === true);
  const eighthGradeReady = hasEighthGradeColumn();
  const [deadline, setDeadline] = useState(s?.participantDeadline ? localInput(new Date(s.participantDeadline)) : '');
  const [projectPrompt, setProjectPrompt] = useState(s?.customProjectPrompt ?? DEFAULT_QUESTIONS.projectName);
  const [description, setDescription] = useState(s?.description ?? '');
  const [blocks, setBlocks] = useState((s?.pageBlocks ?? []).map((b) => ({ ...b, key: crypto.randomUUID() })));
  const [questions, setQuestions] = useState(s?.questions ?? []);
  const [teamSizes, setTeamSizes] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const verseLabel = s?.disciplineName || disciplineByName(verse)?.label || verse;
  const soloOnly = maxTeamSize < 2;

  // Team sizes, to warn when turning teams off or lowering the limit.
  useEffect(() => {
    if (!s) return;
    fetchSessionRoster(s.id).then((roster) => {
      const sizes = new Map<string, number>();
      for (const e of roster) if (e.isTeam && e.teamId) sizes.set(e.teamId, (sizes.get(e.teamId) ?? 0) + 1);
      setTeamSizes([...sizes.values()]);
    }).catch(() => {});
  }, [s]);

  const ask = (title: string, body: string) => new Promise<boolean>((resolve) => setConfirm({ title, body, resolve }));

  const teamsNotice = (() => {
    const original = s?.maxTeamSize;
    if (original == null || maxTeamSize === original) return null;
    const n = maxTeamSize < 2
      ? (original >= 2 ? teamSizes.length : 0)
      : maxTeamSize > original ? 0 : teamSizes.filter((size) => size > maxTeamSize).length;
    if (n === 0) return null;
    const teams = n === 1 ? '1 team' : `${n} teams`;
    return maxTeamSize < 2
      ? `${teams} already registered for this session will keep their team. Nobody is removed, and members can still leave to go solo. No new teams can be created or joined.`
      : `${teams} already ${n === 1 ? 'has' : 'have'} more than ${maxTeamSize} members. Nobody is removed, but ${n === 1 ? 'it' : 'they'} can't take new members.`;
  })();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const cap = Number.parseInt(capacity, 10);
    if (!title.trim()) return setError('Title is required.');
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return setError('Pick a start and end time.');
    if (end <= start) return setError('End time must be after the start time.');
    if (!Number.isInteger(cap) || cap <= 0) return setError('Capacity must be a positive number.');
    const prompt = projectPrompt.trim();
    const columns = {
      discipline_id: verse,
      title: title.trim(),
      start_time: start,
      end_time: end,
      capacity: cap,
      max_team_size: maxTeamSize,
      participant_deadline: deadline ? new Date(deadline).toISOString() : null,
      ...(eighthGradeReady ? { allow_eighth_graders: allowEighth } : {}),
      project_prompt: !prompt || prompt === DEFAULT_QUESTIONS.projectName ? null : prompt,
      description: description.trim(),
      page_blocks: blocks.filter((b) => b.title.trim() || b.body.trim()).map((b) => ({ title: b.title.trim(), body: b.body.trim() })),
      participant_questions: questions.filter((q) => q.prompt.trim()).map((q) => ({ id: q.id, prompt: q.prompt.trim() })),
    };
    setBusy(true);
    if (teamsNotice && !(await ask(maxTeamSize < 2 ? 'This session has teams' : 'Some teams are bigger', `${teamsNotice} Save anyway?`))) {
      setBusy(false);
      return;
    }
    const timeChanged = s != null && (start !== hhmm(startMin) || end !== hhmm(endMin));
    if (timeChanged) {
      const affected = await previewTimeConflicts(s.id, start, end);
      if (affected > 0) {
        const who = affected === 1 ? '1 person' : `${affected} people`;
        const ok = await ask('Schedule clash', `This new time overlaps another session that ${who} registered for it already have. If you save, they'll be notified to adjust their schedule. Save anyway?`);
        if (!ok) {
          setBusy(false);
          return;
        }
      }
    }
    try {
      await saveSessionColumns(columns, s?.id);
      if (timeChanged) await notifyTimeConflicts(s.id).catch(() => {});
      toast.success(s ? 'Session updated' : 'Session created');
      onClose();
    } catch {
      setError('Could not save. You may not manage this discipline.');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!s) return;
    setBusy(true);
    try {
      await deleteSession(s.id);
      toast.success('Session deleted');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const deadlineDate = deadline ? new Date(deadline) : null;

  return (
    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
      {confirm ? (
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle>{confirm.title}</DialogTitle>
            <DialogDescription>{confirm.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { confirm.resolve(false); setConfirm(null); }}>Cancel</Button>
            <Button onClick={() => { confirm.resolve(true); setConfirm(null); }}>Save anyway</Button>
          </DialogFooter>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-display">{s ? 'Edit session' : 'Add a session'}</DialogTitle>
            <DialogDescription>{verseLabel}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="ss-title">Title</Label>
            <Input id="ss-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="ss-start">Start</Label><Input id="ss-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ss-end">End</Label><Input id="ss-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ss-capacity">Capacity</Label><Input id="ss-capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Rooms are locked for now. Participants, spectators and experts all count toward capacity.</p>

          <div className="space-y-1.5">
            <Label htmlFor="ss-deadline">Participant deadline (optional)</Label>
            <div className="flex gap-2">
              <Input id="ss-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              {deadline && <Button type="button" variant="ghost" onClick={() => setDeadline('')}>Clear</Button>}
            </div>
            <p className="text-xs text-muted-foreground">
              {deadlineDate ? `Participating closes ${formatDeadline(deadlineDate)}. After that, people can still spectate.` : 'With no deadline, people can register to participate until the session is full.'}
            </p>
          </div>

          <div className="rounded-xl border border-border p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="ss-eighth"
                className="mt-0.5"
                checked={allowEighth}
                disabled={!eighthGradeReady}
                onCheckedChange={(v) => setAllowEighth(v === true)}
                aria-describedby="ss-eighth-help"
              />
              <div>
                <Label htmlFor="ss-eighth" className="cursor-pointer">Let 8th graders participate</Label>
                <p id="ss-eighth-help" className="mt-1 text-xs text-muted-foreground">
                  {!eighthGradeReady
                    ? 'Available once the Summit database is updated. Until then, 8th graders can only spectate.'
                    : allowEighth
                      ? '8th graders can register to participate, the same as high schoolers.'
                      : 'Only high schoolers can participate. Anyone can spectate, 8th graders included.'}
                  {eighthGradeReady && s?.allowEighthGraders && !allowEighth && " 8th graders who already registered stay registered."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ss-description">Description</Label>
            <Textarea id="ss-description" rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <section className="space-y-3 rounded-xl border border-border p-3">
            <p className="text-sm font-semibold">Participant questions</p>
            <p className="text-xs font-medium text-muted-foreground">Default questions (set by the app)</p>
            <p className="text-sm">{DEFAULT_QUESTIONS.soloOrTeam}</p>
            <div className="space-y-1.5">
              <Label htmlFor="ss-teams">Teams</Label>
              <select id="ss-teams" value={maxTeamSize} onChange={(e) => setMaxTeamSize(Number(e.target.value))} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value={SOLO_ONLY_TEAM_SIZE}>Solo only (no teams)</option>
                {Array.from({ length: LARGEST_TEAM_SIZE_LIMIT - 1 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>Up to {n} per team</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {soloOnly
                  ? 'No new teams can be created or joined. Anyone already on a team keeps it.'
                  : "Most people allowed on one team. Lowering it doesn't remove anyone; full teams just stop taking new members."}
              </p>
            </div>
            {!soloOnly && (
              <p className="text-xs text-muted-foreground">
                {DEFAULT_QUESTIONS.teamCode} Asked when joining a team. Codes for this discipline look like {teamCodePrefix(verse, verseLabel)}1234; the joiner confirms the team's project name.
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ss-prompt">Project question (you can reword this)</Label>
              <Input id="ss-prompt" maxLength={200} value={projectPrompt} onChange={(e) => setProjectPrompt(e.target.value)} />
              <p className="text-xs text-muted-foreground">This is still a default question: you can change its wording but not remove it.</p>
              {projectPrompt.trim() !== DEFAULT_QUESTIONS.projectName && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setProjectPrompt(DEFAULT_QUESTIONS.projectName)}>Reset to default wording</Button>
              )}
            </div>
            <p className="pt-1 text-xs font-medium text-muted-foreground">Your additional questions</p>
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-2">
                <Input aria-label={`Question ${i + 1}`} placeholder={`Question ${i + 1}`} value={q.prompt} onChange={(e) => setQuestions((list) => list.map((x) => (x.id === q.id ? { ...x, prompt: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions((list) => list.filter((x) => x.id !== q.id))}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setQuestions((list) => [...list, { id: crypto.randomUUID(), prompt: '' }])}><Plus className="h-4 w-4" /> Add question</Button>
          </section>

          <section className="space-y-3 rounded-xl border border-border p-3">
            <p className="text-sm font-semibold">Content sections</p>
            {blocks.map((b, i) => (
              <div key={b.key} className="space-y-2 rounded-lg bg-muted/40 p-2">
                <div className="flex items-center gap-2">
                  <Input aria-label={`Heading ${i + 1}`} placeholder="Heading" value={b.title} onChange={(e) => setBlocks((list) => list.map((x) => (x.key === b.key ? { ...x, title: e.target.value } : x)))} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove section ${i + 1}`} onClick={() => setBlocks((list) => list.filter((x) => x.key !== b.key))}><X className="h-4 w-4" /></Button>
                </div>
                <Textarea aria-label={`Text ${i + 1}`} placeholder="Text" rows={3} value={b.body} onChange={(e) => setBlocks((list) => list.map((x) => (x.key === b.key ? { ...x, body: e.target.value } : x)))} />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setBlocks((list) => [...list, { title: '', body: '', key: crypto.randomUUID() }])}><Plus className="h-4 w-4" /> Add section</Button>
            <p className="text-xs text-muted-foreground">Photos are added in the app for now.</p>
          </section>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          {confirmDelete ? (
            <div className="space-y-2 rounded-xl border border-destructive/40 p-3 text-sm">
              <p>Delete "{s?.title}"? Everyone registered loses it from their day.</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void remove()}>Delete</Button>
              </div>
            </div>
          ) : (
            <DialogFooter className="gap-2 sm:items-center">
              {s && profile?.role === 'admin' && (
                <Button type="button" variant="ghost" className="text-destructive sm:mr-auto" onClick={() => setConfirmDelete(true)}>Delete session</Button>
              )}
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy} className="bg-emerald-deep text-white hover:bg-emerald">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : s ? 'Save' : 'Add session'}
              </Button>
            </DialogFooter>
          )}
        </form>
      )}
    </DialogContent>
  );
}
