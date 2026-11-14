// Who's organizing a session (the app's session_volunteers_screen.dart).
// Organizers and editors see the list with numbers; only admins assign and
// remove, through RPCs that refuse anyone else and any schedule clash. An
// admin can assign anyway over a clash with another session; the row is then
// marked conflict_override and shows "Overlap approved" here.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Phone, Plus, X } from '@/components/icons';
import type { Session } from '../../models/sessions';
import { VOLUNTEER_SUBTYPE_LABELS } from '../../models/roles';
import {
  assignVolunteer,
  assignVolunteerOverridingConflict,
  fetchConflictOverrides,
  fetchSessionVolunteers,
  fetchVolunteers,
  unassignVolunteer,
  type VolunteerRef,
} from '../../services/organizer';

export default function SessionVolunteers({ session, canAssign }: { session: Session; canAssign: boolean }) {
  const [list, setList] = useState<VolunteerRef[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<VolunteerRef[] | null>(null);
  const [query, setQuery] = useState('');
  // A refused assignment. `overridable` is set for a clash with another
  // session, which an admin can approve; a sign-up for this session can't be.
  const [blocked, setBlocked] = useState<{ message: string; overridable: VolunteerRef | null } | null>(null);
  // Null until known, or when the override isn't on the backend yet.
  const [overrides, setOverrides] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetchSessionVolunteers(session.id)
      .then(setList)
      .catch(() => setError("Couldn't load this session's volunteers. Try again."));
    if (canAssign) void fetchConflictOverrides(session.id).then(setOverrides);
  }, [session.id, canAssign]);
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

  const assign = async (v: VolunteerRef, override = false) => {
    setPicking(null);
    setBlocked(null);
    setBusy(true);
    try {
      const result = override
        ? await assignVolunteerOverridingConflict(session.id, v.id)
        : await assignVolunteer(session.id, v.id);
      const name = v.name || v.email;
      if (result.outcome === 'conflict') {
        setBlocked(result.conflictKind === 'registered_this'
          ? { message: `${name} is signed up for this session, so they can't manage it. They need to remove it from their day first.`, overridable: null }
          : overrides
            ? {
                message: `${name} is already on "${result.conflictingTitle ?? 'another session'}" at the same time. You can assign them anyway if they'll cover both.`,
                overridable: v,
              }
            : {
                message: `${name} has a schedule conflict and can't be added to this session. It overlaps with "${result.conflictingTitle ?? 'another session'}".`,
                overridable: null,
              });
      } else {
        toast.success(override ? `Assigned ${name} despite the overlap` : `Assigned ${name} to this session`);
        load();
      }
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
                <p className="font-medium">
                  {v.name || v.email}
                  {overrides?.has(v.id) && (
                    <span className="ml-2 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 align-middle text-[11px] font-medium text-amber-700 dark:text-amber-300">
                      Overlap approved
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[v.subtype ? VOLUNTEER_SUBTYPE_LABELS[v.subtype] : null, v.email].filter(Boolean).join(' · ')}
                </p>
                {v.phone && (
                  <a href={`tel:${v.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 text-xs text-emerald hover:underline">
                    <Phone className="h-3 w-3" /> {v.phone}
                  </a>
                )}
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
            <DialogDescription>{blocked?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {blocked?.overridable ? (
              <>
                <Button variant="outline" onClick={() => setBlocked(null)}>Cancel</Button>
                <Button disabled={busy} onClick={() => void assign(blocked.overridable!, true)} className="bg-emerald text-white hover:bg-emerald-deep">
                  Assign anyway
                </Button>
              </>
            ) : (
              <Button onClick={() => setBlocked(null)}>Got it</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
