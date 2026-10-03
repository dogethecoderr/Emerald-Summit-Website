import { supabase } from '../lib/supabase';
import type { Person } from '../models/people';
import { getDemoPeople, subscribeOfflineDemo } from './offlineDemo';

type UserRow = {
  id: string;
  name: string | null;
  role: string;
  email: string | null;
  discipline: string | null;
  checked_in_at: string | null;
};

function toPerson(user: UserRow): Person {
  const name = user.name?.trim() || 'Participant';
  return {
    id: user.id,
    name,
    role: user.role,
    org: 'Emerald Summit',
    email: user.email ?? '',
    phone: '',
    initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
    bio: '',
    discipline: user.discipline,
    checked_in_at: user.checked_in_at,
    emailVisible: 'private',
    phoneVisible: 'private',
    status: user.checked_in_at ? 'checkedIn' : 'validated',
  };
}

export function mockVolunteerRoster(
  assignedTrack: string | null = 'novasphere',
  isFrontDesk = false,
): Person[] {
  const people = getDemoPeople()
    .filter((person) => person.role === 'participant' || person.role === 'attendee')
    .map((person) => ({
      ...person,
      checked_in_at: person.status === 'checkedIn' ? '2026-10-03T09:00:00.000Z' : null,
    }));
  if (isFrontDesk) return people;
  return people.filter((person) =>
    person.discipline === assignedTrack ||
    person.registeredDisciplines?.includes(assignedTrack ?? ''),
  );
}

export async function fetchVolunteerRoster(
  assignedTrack: string | null,
  isFrontDesk: boolean,
): Promise<Person[]> {
  if (!supabase) {
    return mockVolunteerRoster(assignedTrack, isFrontDesk);
  }

  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, role, email, discipline, checked_in_at')
    .in('role', ['participant', 'attendee'])
    .order('name');

  if (error) throw new Error(`Could not load participant roster: ${error.message}`);
  const rows = (users ?? []) as UserRow[];
  if (isFrontDesk || rows.length === 0) {
    return rows.map(toPerson);
  }
  if (!assignedTrack) return [];

  const { data: registrations, error: registrationsError } = await supabase
    .from('user_disciplines')
    .select('user_id, discipline');
  if (registrationsError) {
    throw new Error(`Could not load discipline registrations: ${registrationsError.message}`);
  }

  const registeredIds = new Set(
    (registrations ?? [])
      .filter((registration) => registration.discipline === assignedTrack)
      .map((registration) => registration.user_id),
  );

  return rows
    .filter((row) => row.discipline === assignedTrack || registeredIds.has(row.id))
    .map(toPerson);
}

export function subscribeToRosterChanges(onChange: () => void): () => void {
  if (!supabase) return subscribeOfflineDemo(onChange);
  if (typeof supabase.channel !== 'function') return () => undefined;

  const client = supabase;
  const channel = client
    .channel('volunteer-roster-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_disciplines' }, onChange)
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
