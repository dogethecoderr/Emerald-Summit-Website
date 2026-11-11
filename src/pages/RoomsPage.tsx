// The rooms catalog for admins, ported from the app's rooms_manager_screen.dart.
// Everyone can read rooms; only admins can change them (RLS).
import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pencil, Plus, Trash2 } from '@/components/icons';
import { useRequireRole } from '../hooks/useRequireProfile';
import { createRoom, deleteRoom, fetchRooms, renameRoom, type Room } from '../services/organizer';

export default function RoomsPage() {
  const { ready, redirect } = useRequireRole(['admin']);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ room: Room | null; name: string } | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchRooms().then(setRooms).catch(() => setError("Couldn't load the rooms."));
  }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) return <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    try {
      if (editing.room) await renameRoom(editing.room.id, name);
      else await createRoom(name);
      setEditing(null);
      load();
    } catch {
      toast.error('Could not save. A room with that name may exist.');
    }
  };

  const remove = async (room: Room) => {
    setDeleting(null);
    try {
      await deleteRoom(room.id);
      load();
    } catch {
      toast.error('Could not delete the room.');
    }
  };

  return (
    <AppShell>
      <PageHeader label="Admin" title="Manage rooms" actions={
        <Button onClick={() => setEditing({ room: null, name: '' })} className="bg-emerald text-white hover:bg-emerald-deep"><Plus className="h-4 w-4" /> Add room</Button>
      } />
      <div className="mx-auto max-w-3xl">
        {error ? (
          <div className="space-y-2 text-sm"><p role="alert" className="text-destructive">{error}</p><Button variant="outline" size="sm" onClick={load}>Try again</Button></div>
        ) : rooms == null ? (
          <Skeleton className="h-32 w-full" />
        ) : rooms.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No rooms yet. Add the rooms your sessions will use, then pick one when creating a session.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border px-4">
            {rooms.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1 font-medium">{r.name}</span>
                <Button variant="ghost" size="icon" aria-label={`Rename ${r.name}`} onClick={() => setEditing({ room: r, name: r.name })}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${r.name}`} onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing?.room ? 'Rename room' : 'Add room'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-2">
            <Label htmlFor="room-name">Room name</Label>
            <Input id="room-name" autoFocus value={editing?.name ?? ''} onChange={(e) => setEditing((x) => x && { ...x, name: e.target.value })} />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => void save()}>{editing?.room ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleting != null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete room?</DialogTitle>
            <DialogDescription>"{deleting?.name}" will be removed. Sessions in it become "Unassigned". They are not deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleting && void remove(deleting)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
