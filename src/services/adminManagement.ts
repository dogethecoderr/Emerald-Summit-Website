import { supabase } from '../lib/supabase';
import { MOCK_SESSIONS, type Session } from '../models/sessions';
import {
  addDemoSession,
  getDemoPeople,
  getDemoSessions,
  removeDemoSession,
  updateDemoUser,
} from './offlineDemo';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_volunteer: boolean;
  is_front_desk: boolean;
  discipline: string | null;
}

export type SessionDraft = Pick<
  Session,
  | 'title'
  | 'speaker'
  | 'time'
  | 'location'
  | 'track'
  | 'duration'
  | 'description'
  | 'capacity'
  | 'expertCapacity'
  | 'spectatorCap'
  | 'room'
>;

export const usesOfflineAdminData = !supabase;

function requireSupabase() {
  if (!supabase) throw new Error('Admin management requires a configured Supabase connection.');
  return supabase;
}

export async function fetchManagedUsers(): Promise<ManagedUser[]> {
  if (!supabase) {
    return getDemoPeople()
      .map((person) => ({
        id: person.id,
        name: person.name,
        email: person.email,
        role: person.role,
        is_volunteer: person.role === 'volunteer' || person.is_volunteer === true,
        is_front_desk: person.is_front_desk === true,
        discipline: person.discipline ?? null,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  const { data, error } = await requireSupabase()
    .from('users')
    .select('id, name, email, role, is_volunteer, is_front_desk, discipline')
    .order('name');
  if (error) throw new Error(`Could not load users: ${error.message}`);
  return (data ?? []) as ManagedUser[];
}

export async function updateManagedUser(
  userId: string,
  updates: Partial<Pick<ManagedUser, 'is_volunteer' | 'is_front_desk' | 'discipline'>>,
): Promise<void> {
  if (!supabase) {
    updateDemoUser(userId, updates);
    return;
  }

  const { error } = await requireSupabase()
    .from('users')
    .update(updates)
    .eq('id', userId);
  if (error) throw new Error(`Could not update user permissions: ${error.message}`);
}

export async function fetchManagedSessions(): Promise<Session[]> {
  if (!supabase) return getDemoSessions().map((session) => ({ ...session }));

  const { data, error } = await requireSupabase()
    .from('sessions_with_counts')
    .select('id, title, speaker, time, location, track, duration, description, capacity, enrolled, expert_capacity, experts_enrolled, spectator_cap, spectators, room')
    .order('time');
  if (error) throw new Error(`Could not load schedule: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    speaker: row.speaker,
    time: row.time,
    location: row.location,
    track: row.track,
    duration: row.duration,
    description: row.description,
    capacity: row.capacity,
    enrolled: row.enrolled,
    expertCapacity: row.expert_capacity,
    expertsEnrolled: row.experts_enrolled,
    spectatorCap: row.spectator_cap,
    spectators: row.spectators,
    room: row.room,
  })) as Session[];
}

export async function fetchScheduleSessions(): Promise<Session[]> {
  if (!supabase) return getDemoSessions().map((session) => ({ ...session }));
  const sessions = await fetchManagedSessions();
  return sessions.length > 0 ? sessions : MOCK_SESSIONS;
}

export async function saveManagedSession(
  draft: SessionDraft,
  sessionId?: string,
): Promise<void> {
  if (!supabase) {
    const next: Session = {
      ...draft,
      title: draft.title.trim(),
      speaker: draft.speaker.trim(),
      duration: draft.duration.trim(),
      description: draft.description.trim(),
      id: sessionId ?? `mock-session-${Date.now()}`,
      enrolled: 0,
      expertsEnrolled: 0,
      spectators: 0,
    };
    addDemoSession(next, sessionId);
    return;
  }

  const client = requireSupabase();
  const row = {
    title: draft.title.trim(),
    speaker: draft.speaker.trim(),
    time: draft.time,
    location: draft.location.trim(),
    track: draft.track,
    duration: draft.duration.trim(),
    description: draft.description.trim(),
    capacity: draft.capacity,
    expert_capacity: draft.expertCapacity,
    spectator_cap: draft.spectatorCap,
    room: draft.room.trim(),
  };
  const { error } = sessionId
    ? await client.from('sessions').update(row).eq('id', sessionId)
    : await client.from('sessions').insert(row);
  if (error) throw new Error(`Could not save session: ${error.message}`);
}

export async function deleteManagedSession(sessionId: string): Promise<void> {
  if (!supabase) {
    removeDemoSession(sessionId);
    return;
  }

  const { error } = await requireSupabase()
    .from('sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw new Error(`Could not delete session: ${error.message}`);
}
