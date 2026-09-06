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
  if (trimmed === 'bypass_user_id') return true;
  if (UUID_REGEX.test(trimmed) || GENERIC_UUID_REGEX.test(trimmed)) return true;
  if (MOCK_ID_REGEX.test(trimmed)) return true;
  return false;
}

export async function fetchParticipantById(
  id: string,
): Promise<{ data: ParticipantData | null; error: string | null }> {
  if (!validateParticipantId(id)) {
    return { data: null, error: 'Invalid participant ID format' };
  }

  const trimmedId = id.trim();

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
    const mockPerson = MOCK_PEOPLE.find((p) => p.id === trimmedId);
    if (mockPerson) {
      return {
        data: {
          id: mockPerson.id,
          name: mockPerson.name,
          role: mockPerson.role,
          email: mockPerson.email,
          checked_in_at: mockPerson.status === 'checkedIn' ? new Date().toISOString() : null,
          discipline: null,
        },
        error: null,
      };
    }

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: null, error: 'Participant not found' };
  } catch (err: any) {
    // If Supabase throws (e.g. network/unreachable), check mock data
    const mockPerson = MOCK_PEOPLE.find((p) => p.id === trimmedId);
    if (mockPerson) {
      return {
        data: {
          id: mockPerson.id,
          name: mockPerson.name,
          role: mockPerson.role,
          email: mockPerson.email,
          checked_in_at: mockPerson.status === 'checkedIn' ? new Date().toISOString() : null,
          discipline: null,
        },
        error: null,
      };
    }
    return { data: null, error: err?.message ?? 'Failed to fetch participant' };
  }
}

export async function checkInParticipant(id: string): Promise<CheckInResult> {
  const { data: user, error } = await fetchParticipantById(id);

  if (error || !user) {
    return {
      success: false,
      error: error ?? 'Participant not found',
    };
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
