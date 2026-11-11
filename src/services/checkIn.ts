import { supabase } from '../lib/supabase';
import { MOCK_PEOPLE } from '../models/people';

export interface ParticipantData {
  id: string;
  name: string;
  role: string;
  email: string;
  checked_in_at?: string | null;
  discipline?: string | null;
}

export interface CheckInResult {
  success: boolean;
  user?: ParticipantData;
  alreadyCheckedIn?: boolean;
  error?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENERIC_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOCK_ID_REGEX = /^p\d+$/i;

export function validateParticipantId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (UUID_REGEX.test(trimmed) || GENERIC_UUID_REGEX.test(trimmed)) return true;
  if (MOCK_ID_REGEX.test(trimmed)) return true;
  return false;
}

/** Mock roster stand-in used whenever the database has no row for an id. */
function mockParticipant(id: string): ParticipantData | null {
  const person = MOCK_PEOPLE.find((p) => p.id === id);
  if (!person) return null;
  return {
    id: person.id,
    name: person.name,
    role: person.role,
    email: person.email,
    checked_in_at: person.status === 'checkedIn' ? new Date().toISOString() : null,
    discipline: null,
  };
}

function participantFromRow(row: Record<string, any>): ParticipantData {
  return {
    id: row.id,
    name: row.full_name ?? 'Participant',
    role: row.role === 'parentSpectator' ? 'attendee' : row.role ?? 'participant',
    email: row.email ?? '',
    checked_in_at: row.checked_in_at ?? (row.present ? 'checked-in' : null),
    discipline: null,
  };
}

export async function fetchParticipantById(id: string): Promise<{ data: ParticipantData | null; error: string | null }> {
  if (!validateParticipantId(id)) return { data: null, error: 'Invalid participant ID format' };
  const normalized = id.trim().toLowerCase();
  if (!supabase) {
    const person = import.meta.env.DEV ? mockParticipant(normalized) : null;
    return { data: person, error: person ? null : 'Participant not found' };
  }
  try {
    const { data, error } = await supabase.rpc('fetch_attendee_directory', { p_query: '' });
    if (error) return { data: null, error: error.message };
    const row = data?.find((person: { id: string }) => person.id === normalized);
    return { data: row ? participantFromRow(row) : null, error: row ? null : 'Participant not found' };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Failed to fetch participant' };
  }
}

/** The shared scan RPC checks identity, permission and double scans atomically. */
export async function checkInParticipant(id: string): Promise<CheckInResult> {
  if (!validateParticipantId(id)) return { success: false, error: 'Invalid participant ID format' };
  const normalized = id.trim().toLowerCase();
  if (!supabase) {
    const { data: user, error } = await fetchParticipantById(normalized);
    if (!user) return { success: false, error: error ?? 'Participant not found' };
    if (user.checked_in_at) return { success: false, user, alreadyCheckedIn: true, error: `${user.name} is already checked in.` };
    const person = MOCK_PEOPLE.find((p) => p.id === user.id);
    if (person) person.status = 'checkedIn';
    return { success: true, user: { ...user, checked_in_at: new Date().toISOString() } };
  }
  try {
    const { data, error } = await supabase.rpc('scan_summit_checkin', { p_attendee_id: normalized });
    if (error) return { success: false, error: error.message };
    const row = data?.[0];
    if (!row?.attendee_found) return { success: false, error: 'Participant not found' };
    const user = participantFromRow({ ...row, id: normalized });
    if (row.already_checked_in) return { success: false, user, alreadyCheckedIn: true, error: `${user.name} is already checked in.` };
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update check-in status' };
  }
}
