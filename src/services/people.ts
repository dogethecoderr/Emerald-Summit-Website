// The people behind the Directory and the Volunteer Hub roster: every account
// in public.users. Any signed-in person can read that table
// (users_select_directory); signed-out and demo sessions read nothing, so
// their lists are empty. The sample MOCK_PEOPLE only stand in when no backend
// is configured at all (tests, offline prototyping).
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_PROFILE_SETTINGS } from './auth';
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

/** Everyone, or only these roles, ordered by name. */
export async function fetchPeople(roles?: string[]): Promise<Person[]> {
  if (!supabase) {
    return MOCK_PEOPLE.filter((p) => !roles || roles.includes(p.role));
  }
  let query = supabase
    .from('users')
    .select('id, name, role, email, phone, bio, discipline, checked_in_at')
    .order('name');
  if (roles) query = query.in('role', roles);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as UserRow[]).map(personFromRow);
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

/**
 * Sets or clears someone's check-in. Only front-desk volunteers and admins
 * may (enforce_users_update_rules); a refused write changes no row, which is
 * reported as an error rather than a silent success.
 */
export async function setCheckedIn(id: string, checkedIn: boolean): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('users')
    .update({ checked_in_at: checkedIn ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("You don't have permission to change check-in.");
}
