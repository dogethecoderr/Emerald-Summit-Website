// The people behind the Directory and the Volunteer Hub roster: every account
// in public.users. Any signed-in person can read that table
// (users_select_directory); signed-out and demo sessions read nothing, so
// their lists are empty. The sample MOCK_PEOPLE only stand in when no backend
// is configured at all (tests, offline prototyping).
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_PROFILE_SETTINGS } from './auth';
import { MOCK_SESSIONS } from '../models/sessions';
import { MOCK_PEOPLE, type Person } from '../models/people';

interface UserRow {
  id: string;
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  discipline: string | null;
  checked_in_at: string | null;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function personFromRow(r: UserRow): Person {
  const name = r.name?.trim() || 'Summit member';
  return {
    id: r.id,
    name,
    role: r.role ?? 'participant',
    org: DEFAULT_PROFILE_SETTINGS.org,
    email: r.email ?? '',
    phone: r.phone ?? '',
    initials: initialsOf(name),
    bio: r.bio ?? '',
    // The database has no per-field visibility yet, so contact details and
    // bios stay private on everyone's card.
    emailVisible: 'private',
    phoneVisible: 'private',
    bioVisible: 'private',
    status: r.checked_in_at ? 'checkedIn' : 'validated',
    discipline: r.discipline ?? undefined,
  };
}

/** Read only the front-desk directory or the rosters of assigned sessions. */
export async function fetchPeople(roles?: string[], frontDesk = false): Promise<Person[]> {
  if (!supabase) return import.meta.env.DEV ? MOCK_PEOPLE.filter((p) => !roles || roles.includes(p.role)) : [];
  const people = new Map<string, Person>();
  if (frontDesk) {
    const { data, error } = await supabase.rpc('fetch_attendee_directory', { p_query: '' });
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const person = personFromRow({ ...r, name: r.full_name, role: r.role === 'parentSpectator' ? 'attendee' : r.role,
        checked_in_at: r.present ? 'checked-in' : null });
      people.set(person.id, person);
    }
  } else {
    const { data: auth, error: authError } = await supabase.auth.getSession();
    if (authError) throw authError;
    if (!auth.session) return [];
    const { data: assignments, error } = await supabase.from('session_volunteers').select('session_id').eq('user_id', auth.session.user.id);
    if (error) throw new Error(error.message);
    for (const assignment of assignments ?? []) {
      const { data: roster, error: rosterError } = await supabase.rpc('fetch_session_roster', { p_session_id: assignment.session_id });
      if (rosterError) throw new Error(rosterError.message);
      const session = MOCK_SESSIONS.find((s) => s.id === assignment.session_id);
      for (const r of roster ?? []) {
        const person = personFromRow({ ...r, id: r.user_id, name: r.full_name,
          role: r.role === 'parentSpectator' ? 'attendee' : r.role,
          phone: r.details?.phone, bio: r.details?.bio, discipline: session?.track ?? null,
          checked_in_at: null });
        people.set(person.id, person);
      }
    }
  }
  return [...people.values()].filter((p) => !roles || roles.includes(p.role)).sort((a, b) => a.name.localeCompare(b.name));
}

/** fetchPeople as state: `people` is null while loading. */
export function usePeople(roles?: string[], enabled = true) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = roles?.join(',') ?? '';
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetchPeople(roles)
      .then((list) => live && setPeople(list))
      .catch((e: Error) => {
        if (!live) return;
        setError(e.message);
        setPeople([]);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return { people, setPeople, error };
}

/** Summit check-in is permission-checked by the mobile backend's RPC. */
export async function setCheckedIn(id: string, checkedIn: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('mark_summit_checkin', { p_attendee_id: id, p_present: checkedIn });
  if (error) throw new Error(error.message);
}
