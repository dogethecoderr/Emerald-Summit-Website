import { supabase } from '../lib/supabase';
import { MOCK_PEOPLE } from '../models/people';
import {
  checkInDemoPerson,
  getActiveDemoUserId,
  undoDemoCheckIn,
} from './offlineDemo';

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
  if (trimmed === 'bypass_user_id') return true;
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
    checked_in_at: person.checked_in_at
      ?? (person.status === 'checkedIn' ? new Date().toISOString() : null),
    discipline: person.discipline ?? null,
  };
}

export async function fetchParticipantById(
  id: string,
): Promise<{ data: ParticipantData | null; error: string | null }> {
  if (!validateParticipantId(id)) {
    return { data: null, error: 'Invalid participant ID format' };
  }

  const trimmedId = id.trim();

  // Without a configured client there is nothing to query; mock data is the
  // only source available.
  if (!supabase) {
    const mockPerson = mockParticipant(trimmedId);
    return mockPerson
      ? { data: mockPerson, error: null }
      : { data: null, error: 'Participant not found' };
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, role, email, checked_in_at, discipline')
      .eq('id', trimmedId)
      .maybeSingle();

    if (!error && data) {
      return {
        data: {
          id: data.id,
          name: data.name ?? 'Participant',
          role: data.role ?? 'participant',
          email: data.email ?? '',
          checked_in_at: data.checked_in_at ?? null,
          discipline: data.discipline ?? null,
        },
        error: null,
      };
    }

    // Fallback to MOCK_PEOPLE if not found in database or if database query returned an error
    const mockPerson = mockParticipant(trimmedId);
    if (mockPerson) {
      return { data: mockPerson, error: null };
    }

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: null, error: 'Participant not found' };
  } catch (err: any) {
    // If Supabase throws (e.g. network/unreachable), check mock data
    const mockPerson = mockParticipant(trimmedId);
    if (mockPerson) {
      return { data: mockPerson, error: null };
    }
    return { data: null, error: err?.message ?? 'Failed to fetch participant' };
  }
}

export async function checkInParticipant(id: string): Promise<CheckInResult> {
  if (!validateParticipantId(id)) {
    return { success: false, error: 'Invalid participant ID format' };
  }

  if (!supabase) {
    try {
      const { person, alreadyCheckedIn } = checkInDemoPerson(
        id.trim(),
        getActiveDemoUserId(),
      );
      const user: ParticipantData = {
        id: person.id,
        name: person.name,
        role: person.role,
        email: person.email,
        checked_in_at: person.checked_in_at ?? null,
        discipline: person.discipline ?? null,
      };
      return alreadyCheckedIn
        ? {
            success: false,
            user,
            alreadyCheckedIn: true,
            error: `${user.name} is already checked in.`,
          }
        : { success: true, user };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Check-in failed',
      };
    }
  }

  if (supabase && typeof supabase.rpc === 'function') {
    try {
      const { data, error } = await supabase.rpc('check_in_participant', {
        p_user_id: id.trim(),
      });
      if (error) return { success: false, error: error.message };

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return { success: false, error: 'Participant not found' };

      const user: ParticipantData = {
        id: row.id,
        name: row.name ?? 'Participant',
        role: row.role ?? 'participant',
        email: row.email ?? '',
        checked_in_at: row.checked_in_at ?? null,
        discipline: row.discipline ?? null,
      };
      if (row.already_checked_in) {
        return {
          success: false,
          user,
          alreadyCheckedIn: true,
          error: `${user.name} is already checked in.`,
        };
      }
      return { success: true, user };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to check in participant',
      };
    }
  }

  const { data: user, error } = await fetchParticipantById(id);

  if (error && !user) {
    return {
      success: false,
      error,
    };
  }

  if (error || !user) {
    return { success: false, error: error ?? 'Participant not found' };
  }

  if (user.checked_in_at) {
    return {
      success: false,
      user,
      alreadyCheckedIn: true,
      error: `${user.name} is already checked in.`,
    };
  }

  const checkInTimestamp = new Date().toISOString();

  // Execute database update
  try {
    const { error: updateError } = await supabase
      .from('users')
      .update({ checked_in_at: checkInTimestamp })
      .eq('id', user.id);

    if (updateError) {
      // If error occurred and it is NOT a mock ID that simply doesn't exist in live table
      const isMock = MOCK_ID_REGEX.test(user.id);
      if (!isMock) {
        return {
          success: false,
          user,
          error: updateError.message,
        };
      }
    }

    // Update in-memory mock person if present
    const mockIndex = MOCK_PEOPLE.findIndex((p) => p.id === user.id);
    if (mockIndex !== -1) {
      MOCK_PEOPLE[mockIndex].status = 'checkedIn';
    }

    return {
      success: true,
      user: {
        ...user,
        checked_in_at: checkInTimestamp,
      },
    };
  } catch (err: any) {
    const isMock = MOCK_ID_REGEX.test(user.id);
    if (isMock) {
      const mockIndex = MOCK_PEOPLE.findIndex((p) => p.id === user.id);
      if (mockIndex !== -1) {
        MOCK_PEOPLE[mockIndex].status = 'checkedIn';
      }
      return {
        success: true,
        user: {
          ...user,
          checked_in_at: checkInTimestamp,
        },
      };
    }
    return {
      success: false,
      user,
      error: err?.message ?? 'Failed to update check-in status',
    };
  }
}

export async function undoParticipantCheckIn(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!validateParticipantId(id)) {
    return { success: false, error: 'Invalid participant ID format' };
  }

  if (!supabase) {
    try {
      undoDemoCheckIn(id.trim(), getActiveDemoUserId());
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not undo check-in',
      };
    }
  }

  if (typeof supabase.rpc === 'function') {
    try {
      const { error } = await supabase.rpc('undo_participant_check_in', {
        p_user_id: id.trim(),
      });
      return error
        ? { success: false, error: error.message }
        : { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to undo check-in',
      };
    }
  }

  try {
    const { error } = await supabase
      .from('users')
      .update({ checked_in_at: null })
      .eq('id', id.trim());
    return error ? { success: false, error: error.message } : { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to undo check-in',
    };
  }
}
