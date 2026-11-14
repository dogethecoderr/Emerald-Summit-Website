// Who's organizing a session (the app's session_volunteers_screen.dart).
// Organizers and editors see the list with numbers; only admins assign and
// remove, through RPCs that refuse anyone else and any schedule clash. When
// someone is busy at that time, the admin sees what assigning them would take
// off their day and can go ahead: managing replaces it.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, X } from '@/components/icons';
import PhoneActions from '../PhoneActions';
import ReplaceScheduleDialog, { type ReplaceRequest } from './ReplaceScheduleDialog';
import type { Session } from '../../models/sessions';
import { VOLUNTEER_SUBTYPE_LABELS } from '../../models/roles';
import {
  assignManagerReplacingConflicts,
  assignVolunteer,
  fetchSessionVolunteers,
  fetchVolunteers,
  previewManagerAssignment,
  unassignVolunteer,
  type VolunteerRef,
} from '../../services/organizer';

export default function SessionVolunteers({ session, canAssign }: { session: Session; canAssign: boolean }) {
  const [list, setList] = useState<VolunteerRef[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<VolunteerRef[] | null>(null);
  const [query, setQuery] = useState('');
  // A refused assignment, when the backend can't replace yet.
  const [blocked, setBlocked] = useState<string | null>(null);
  // A clash the admin can resolve by replacing what the person was doing.
  const [replacing, setReplacing] = useState<(ReplaceRequest & { volunteer: VolunteerRef }) | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetchSessionVolunteers(session.id)
      .then(setList)
      .catch(() => setError("Couldn't load this session's volunteers. Try again."));
  }, [session.id]);
  useEffect(load, [load]);

  const openPicker = async () => {
    try {
      const all = await fetchVolunteers();
      const assigned = new Set((list ?? []).map((v) => v.id));
      const free = all.filter((v) => !assigned.has(v.id));
      if (free.length === 0) {
        toast('Every volunteer is already assigned here.');
        return;
      }
      setQuery('');
      setPicking(free);
    } catch {
      toast.error('Could not load the volunteer list.');
    }
  };

  const assign = async (v: VolunteerRef) => {
    setPicking(null);
    setBusy(true);
    try {
      const result = await assignVolunteer(session.id, v.id);
      const name = v.name || v.email;
      if (result.outcome === 'conflict') {
        const items = await previewManagerAssignment(session.id, v.id);
        if (items && items.length > 0) {
          setReplacing({ volunteer: v, personName: name, sessionTitle: session.title, items });
        } else {
          // Backend without volunteer_conflict_override.sql: the old refusal.
          setBlocked(result.conflictKind === 'registered_this'
            ? `${name} is signed up for this session, so they can't manage it. They need to remove it from their day first.`
            : `${name} has a schedule conflict and can't be added to this session. It overlaps with "${result.conflictingTitle ?? 'another session'}".`);
        }
      } else {
        toast.success(`Assigned ${name} to this session`);
        load();
      }
    } catch {
      toast.error('Could not assign. Admins only.');
    } finally {
      setBusy(false);
    }
  };

  const confirmReplace = async () => {
    if (!replacing) return;
    const { volunteer: v, personName } = replacing;
    setBusy(true);
    try {
      const replaced = await assignManagerReplacingConflicts(session.id, v.id);
      setReplacing(null);
      toast.success(`Assigned ${personName}. ${replaced.length} ${replaced.length === 1 ? 'thing was' : 'things were'} taken off their day, and they've been told.`);
      load();
    } catch {
      toast.error('Could not assign. Admins only.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (v: VolunteerRef) => {
    setBusy(true);
    try {
      await unassignVolunteer(session.id, v.id);
      toast.success(`Removed ${v.name || v.email}`);
      load();
    } catch {
      toast.error('Could not remove.');
    } finally {
      setBusy(false);
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (picking ?? []).filter((v) => !q || `${v.name} ${v.email}`.toLowerCase().includes(q));
  }, [picking, query]);

  if (error) {
    return (
      <div className="space-y-3 py-6 text-sm">
        <p role="alert" className="text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>Try again</Button>
      </div>
    );
  }
  if (!list) return <div className="space-y-3 py-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>;

  return (
    <div className="space-y-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">The people organizing this session.</p>
        {canAssign && (
          <Button type="button" size="sm" disabled={busy} onClick={() => void openPicker()} className="bg-emerald text-white hover:bg-emerald-deep">
            <Plus className="h-4 w-4" /> Assign volunteer
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {canAssign
            ? "No volunteers assigned yet. Assign volunteers so they can see this session's roster and mark attendance."
            : 'No one has been assigned to organize this session yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border px-4">
          {list.map((v) => (
            <li key={v.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{v.name || v.email}</p>
                <p className="text-xs text-muted-foreground">
                  {[v.subtype ? VOLUNTEER_SUBTYPE_LABELS[v.subtype] : null, v.email].filter(Boolean).join(' · ')}
                </p>
                {v.phone && <PhoneActions phone={v.phone} compact className="mt-0.5" />}
              </div>
              {canAssign && (
                <Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={`Remove ${v.name || v.email}`} onClick={() => void remove(v)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={picking != null} onOpenChange={(o) => !o && setPicking(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign volunteer</DialogTitle>
            <DialogDescription>{session.title}</DialogDescription>
          </DialogHeader>
          <Input placeholder="Search volunteers" aria-label="Search volunteers" value={query} onChange={(e) => setQuery(e.target.value)} />
          <ul className="divide-y divide-border">
            {shown.map((v) => (
              <li key={v.id}>
                <button type="button" className="w-full py-2.5 text-left hover:bg-accent/50" onClick={() => void assign(v)}>
                  <p className="font-medium">{v.name || v.email}</p>
                  <p className="text-xs text-muted-foreground">{v.email}</p>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">No one matches.</li>}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={blocked != null} onOpenChange={(o) => !o && setBlocked(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule conflict</DialogTitle>
            <DialogDescription>{blocked}</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button onClick={() => setBlocked(null)}>Got it</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ReplaceScheduleDialog
        request={replacing}
        busy={busy}
        onConfirm={() => void confirmReplace()}
        onCancel={() => setReplacing(null)}
      />
    </div>
  );
}
