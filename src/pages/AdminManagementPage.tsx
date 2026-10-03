import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CalendarDays, Pencil, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { useRequireRole } from '../hooks/useRequireProfile';
import { TIME_SLOTS, type Session } from '../models/sessions';
import { supabase } from '../lib/supabase';
import {
  deleteManagedSession,
  fetchManagedSessions,
  fetchManagedUsers,
  saveManagedSession,
  updateManagedUser,
  usesOfflineAdminData,
  type ManagedUser,
  type SessionDraft,
} from '../services/adminManagement';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteTrackOption, fetchTrackOptions, saveTrackOption, type TrackOption } from '../services/tracks';
import { subscribeOfflineDemo } from '../services/offlineDemo';

const EMPTY_SESSION: SessionDraft = {
  title: '',
  speaker: '',
  time: TIME_SLOTS[0],
  location: '',
  track: 'techverse',
  duration: '60 min',
  description: '',
  capacity: 30,
  expertCapacity: 3,
  spectatorCap: 0,
  room: '',
};

export default function AdminManagementPage() {
  const { ready, redirect } = useRequireRole(['admin']);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [newTrackLabel, setNewTrackLabel] = useState('');
  const [newTrackColor, setNewTrackColor] = useState('#0C7A55');
  const [editingTrackName, setEditingTrackName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(EMPTY_SESSION);
  const [editingSessionId, setEditingSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextUsers, nextSessions, nextTracks] = await Promise.all([
        fetchManagedUsers(),
        fetchManagedSessions(),
        fetchTrackOptions(),
      ]);
      setUsers(nextUsers);
      setSessions(nextSessions);
      setTracks(nextTracks);
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load admin data';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!supabase || typeof supabase.channel !== 'function') {
      return subscribeOfflineDemo(() => void refresh());
    }
    const client = supabase;
    const channel = client
      .channel('admin-management-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'summit_tracks' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_registrations' }, () => void refresh());
    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh]);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready || loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const changeUser = async (
    user: ManagedUser,
    updates: Partial<Pick<ManagedUser, 'is_volunteer' | 'is_front_desk' | 'discipline'>>,
  ) => {
    try {
      await updateManagedUser(user.id, updates);
      setUsers((current) => current.map((row) => row.id === user.id ? { ...row, ...updates } : row));
      toast.success('User permissions updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update user permissions');
    }
  };

  const editSession = (session: Session) => {
    setEditingSessionId(session.id);
    setSessionDraft({
      title: session.title,
      speaker: session.speaker,
      time: session.time,
      location: session.location,
      track: session.track,
      duration: session.duration,
      description: session.description,
      capacity: session.capacity,
      expertCapacity: session.expertCapacity,
      spectatorCap: session.spectatorCap,
      room: session.room,
    });
  };

  const resetSessionForm = () => {
    setEditingSessionId(undefined);
    setSessionDraft(EMPTY_SESSION);
  };

  const submitSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionDraft.title.trim() || !sessionDraft.location.trim()) return;
    setSaving(true);
    try {
      await saveManagedSession(sessionDraft, editingSessionId);
      await refresh();
      resetSessionForm();
      toast.success(editingSessionId ? 'Session updated.' : 'Session added.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save session');
    } finally {
      setSaving(false);
    }
  };

  const removeSession = async (session: Session) => {
    try {
      await deleteManagedSession(session.id);
      await refresh();
      if (editingSessionId === session.id) resetSessionForm();
      toast.success('Session removed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete session');
    }
  };

  const saveNewTrack = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = newTrackLabel.trim();
    const name = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!name) return;
    try {
      await saveTrackOption(editingTrackName ?? name, label, newTrackColor);
      await refresh();
      const wasEditing = editingTrackName !== null;
      setNewTrackLabel('');
      setEditingTrackName(null);
      toast.success(wasEditing ? 'Track updated.' : 'Track added.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add track');
    }
  };

  const removeTrack = async (track: TrackOption) => {
    try {
      await deleteTrackOption(track.name);
      await refresh();
      toast.success(`${track.label} removed. Affected registrants were notified.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete track');
    }
  };

  const filteredUsers = users.filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  const volunteerCount = users.filter((user) => user.role === 'volunteer' || user.is_volunteer).length;

  return (
    <AppShell>
      <PageHeader
        label="Admin"
        title="User & Schedule Management"
        sub="Manage volunteer permissions and control the summit schedule."
      />

      {usesOfflineAdminData && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Preview mode — sample users, volunteer switches, tracks, and sessions are in-memory only and reset when the page reloads.
        </div>
      )}

      {loadError && (
        <div role="alert" className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="space-y-8">
        <section className="glass space-y-5 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-mint" />
              <h2 className="font-display text-lg font-semibold">Registered Users</h2>
              <span className="rounded-full bg-emerald/15 px-2.5 py-0.5 text-xs font-bold text-emerald-mint">{users.length}</span>
              <span className="text-xs text-muted-foreground">{volunteerCount} volunteers</span>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users..."
              aria-label="Search users"
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Name / Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Assigned Track</th>
                  <th className="px-3 py-2">Front Desk Access</th>
                  <th className="px-3 py-2">Volunteer Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredUsers.map((user) => {
                  const isVolunteer = user.role === 'volunteer' || user.is_volunteer;
                  return (
                    <tr key={user.id}>
                      <td className="px-3 py-3">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="px-3 py-3 capitalize">{user.role}</td>
                      <td className="px-3 py-3">
                        {isVolunteer ? (
                          <select
                            aria-label={`Track for ${user.name}`}
                            value={user.discipline ?? ''}
                            onChange={(event) => void changeUser(user, { discipline: event.target.value || null })}
                            disabled={user.is_front_desk}
                            className="h-9 rounded-lg border border-border bg-background px-2 text-xs disabled:opacity-50"
                          >
                            <option value="">Unassigned</option>
                            {tracks.filter((option) => option.is_discipline).map((discipline) => (
                              <option key={discipline.name} value={discipline.name}>{discipline.label}</option>
                            ))}
                          </select>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        {isVolunteer ? (
                          <Switch
                            checked={user.is_front_desk}
                            onCheckedChange={(checked) => void changeUser(user, { is_front_desk: checked })}
                            aria-label={`Front desk access for ${user.name}`}
                          />
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        {user.role === 'volunteer' ? (
                          <span className="text-xs font-semibold text-emerald-mint">Volunteer</span>
                        ) : (
                          <Switch
                            checked={user.is_volunteer}
                            onCheckedChange={(checked) => void changeUser(user, {
                              is_volunteer: checked,
                              ...(!checked ? { is_front_desk: false } : {}),
                            })}
                            aria-label={`Volunteer access for ${user.name}`}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">No matching users.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass space-y-5 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold">Track Options</h2>
            <span className="rounded-full bg-emerald/15 px-2.5 py-0.5 text-xs font-bold text-emerald-mint">{tracks.filter((track) => track.is_discipline).length}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.filter((track) => track.is_discipline).map((track) => (
              <div key={track.name} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: track.color }} />
                  <span className="truncate">{track.label}</span>
                  <span className="truncate text-xs text-muted-foreground">({track.name})</span>
                </span>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTrackName(track.name);
                      setNewTrackLabel(track.label);
                      setNewTrackColor(track.color);
                    }}
                    aria-label={`Edit ${track.label}`}
                    className="rounded-md p-2 hover:bg-accent"
                  ><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => void removeTrack(track)} aria-label={`Delete ${track.label}`} className="rounded-md p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={(event) => void saveNewTrack(event)} className="flex flex-wrap items-end gap-3">
            <label className="min-w-[200px] flex-1 space-y-1 text-xs">{editingTrackName ? 'Edit discipline track' : 'New discipline track'}<input required value={newTrackLabel} onChange={(event) => setNewTrackLabel(event.target.value)} placeholder="e.g. Robotics" className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
            <label className="space-y-1 text-xs">Color<input type="color" value={newTrackColor} onChange={(event) => setNewTrackColor(event.target.value)} className="block h-9 w-14 rounded border border-border bg-background p-1" /></label>
            <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald px-4 text-sm font-semibold text-white">{editingTrackName ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingTrackName ? 'Save track' : 'Add track'}</button>
            {editingTrackName && <button type="button" onClick={() => { setEditingTrackName(null); setNewTrackLabel(''); setNewTrackColor('#0C7A55'); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-4 text-sm"><X className="h-4 w-4" />Cancel</button>}
          </form>
          <p className="text-xs text-muted-foreground">New disciplines become available for participant signup and track-volunteer assignment. Removing a track cancels its session reservations, clears profile assignments, and notifies everyone affected by the removal.</p>
        </section>

        <section className="glass space-y-5 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-emerald-mint" />
            <h2 className="font-display text-lg font-semibold">Schedule & Capacity</h2>
            <span className="rounded-full bg-emerald/15 px-2.5 py-0.5 text-xs font-bold text-emerald-mint">{sessions.length} sessions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Session</th><th className="px-3 py-2">Track / Time</th>
                  <th className="px-3 py-2">Participant Capacity</th><th className="px-3 py-2">Expert Capacity</th><th className="px-3 py-2">Spectator Capacity</th>
                  <th className="px-3 py-2">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="px-3 py-3"><div className="font-medium">{session.title}</div><div className="text-xs text-muted-foreground">{session.location}</div></td>
                    <td className="px-3 py-3"><div className="capitalize">{session.track}</div><div className="text-xs text-muted-foreground">{session.time}</div></td>
                    <td className="px-3 py-3">{session.enrolled} / {session.capacity}</td>
                    <td className="px-3 py-3">{session.expertsEnrolled} / {session.expertCapacity}</td>
                    <td className="px-3 py-3">{session.spectators} / {session.spectatorCap}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button type="button" onClick={() => editSession(session)} aria-label={`Edit ${session.title}`} className="rounded-md p-2 hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                        <button type="button" onClick={() => void removeSession(session)} aria-label={`Delete ${session.title}`} className="rounded-md p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">No sessions have been configured.</td></tr>}
              </tbody>
            </table>
          </div>

          <form onSubmit={(event) => void submitSession(event)} className="space-y-4 rounded-xl border border-border/70 bg-background/40 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editingSessionId ? 'Edit session' : 'Add session or track session'}</h3>
              {editingSessionId && <button type="button" onClick={resetSessionForm} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><X className="h-3.5 w-3.5" /> Cancel edit</button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1 text-xs">Title<input required value={sessionDraft.title} onChange={(e) => setSessionDraft({ ...sessionDraft, title: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <label className="space-y-1 text-xs">Track<select value={sessionDraft.track} onChange={(e) => setSessionDraft({ ...sessionDraft, track: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">{tracks.map((track) => <option key={track.name} value={track.name}>{track.label}</option>)}</select></label>
              <label className="space-y-1 text-xs">Time<input list="time-options" value={sessionDraft.time} onChange={(e) => setSessionDraft({ ...sessionDraft, time: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" /><datalist id="time-options">{TIME_SLOTS.map((time) => <option key={time} value={time} />)}</datalist></label>
              <label className="space-y-1 text-xs">Location<input required value={sessionDraft.location} onChange={(e) => setSessionDraft({ ...sessionDraft, location: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <label className="space-y-1 text-xs">Room<input value={sessionDraft.room} onChange={(e) => setSessionDraft({ ...sessionDraft, room: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <label className="space-y-1 text-xs">Speaker<input value={sessionDraft.speaker} onChange={(e) => setSessionDraft({ ...sessionDraft, speaker: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <label className="space-y-1 text-xs">Duration<input value={sessionDraft.duration} onChange={(e) => setSessionDraft({ ...sessionDraft, duration: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <label className="space-y-1 text-xs">Participant capacity<input type="number" min={0} value={sessionDraft.capacity} onChange={(e) => setSessionDraft({ ...sessionDraft, capacity: Number(e.target.value) })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <label className="space-y-1 text-xs">Expert capacity<input type="number" min={0} value={sessionDraft.expertCapacity} onChange={(e) => setSessionDraft({ ...sessionDraft, expertCapacity: Number(e.target.value) })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <label className="space-y-1 text-xs">Spectator capacity<input type="number" min={0} value={sessionDraft.spectatorCap} onChange={(e) => setSessionDraft({ ...sessionDraft, spectatorCap: Number(e.target.value) })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <label className="space-y-1 text-xs sm:col-span-2 lg:col-span-3">Description<textarea rows={2} value={sessionDraft.description} onChange={(e) => setSessionDraft({ ...sessionDraft, description: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
            </div>
            <button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald px-4 text-sm font-semibold text-white disabled:opacity-60">
              {editingSessionId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? 'Saving…' : editingSessionId ? 'Save session' : 'Add session'}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
