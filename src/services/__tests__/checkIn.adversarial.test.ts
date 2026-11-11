import { createCheckInRpcHandler } from '../../test/mocks/supabaseMock';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  validateParticipantId,
  fetchParticipantById,
  checkInParticipant,
} from '../checkIn';

const { mockSupabaseClient, usersTable } = vi.hoisted(() => {
  const users: any[] = [];

  const client = {
    rpc: vi.fn(),
    from: vi.fn(() => { throw new Error('Check-in must use the shared RPCs.'); }),
  };

  return { mockSupabaseClient: client, usersTable: users };
});

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('Adversarial Test: checkIn Service Edge Cases & Attack Injections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.rpc.mockImplementation(createCheckInRpcHandler(usersTable));
    usersTable.length = 0;
  });

  describe('1. validateParticipantId Stress-Testing', () => {
    test('rejects SQL injection vectors', () => {
      const sqlInjections = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "admin'--",
        "' UNION SELECT * FROM users --",
        "1; EXEC xp_cmdshell('dir');",
      ];
      for (const injection of sqlInjections) {
        expect(validateParticipantId(injection)).toBe(false);
      }
    });

    test('rejects script tags and XSS vectors', () => {
      const xssVectors = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '"><svg onload=alert(1)>',
      ];
      for (const vector of xssVectors) {
        expect(validateParticipantId(vector)).toBe(false);
      }
    });

    test('rejects malformed UUIDs and arbitrary URLs', () => {
      const malformed = [
        '',
        '   ',
        'https://summit.emerald.org/checkin',
        '550e8400-e29b-41d4-a716-44665544000', // 35 chars
        '550e8400-e29b-41d4-a716-4466554400000', // 37 chars
        '550e8400-e29b-41d4-a716-44665544000g', // non-hex
        '550e8400_e29b_41d4_a716_446655440000', // underscores
        'p', // incomplete mock ID
        'pabc', // non-numeric mock ID
        'P-10', // hyphenated mock ID
      ];
      for (const input of malformed) {
        expect(validateParticipantId(input as any)).toBe(false);
      }
    });

    test('handles non-string types safely without throwing', () => {
      expect(validateParticipantId(null as any)).toBe(false);
      expect(validateParticipantId(undefined as any)).toBe(false);
      expect(validateParticipantId(12345 as any)).toBe(false);
      expect(validateParticipantId({} as any)).toBe(false);
      expect(validateParticipantId([] as any)).toBe(false);
    });

    test('accepts valid UUID v4, generic UUID and mock IDs, and no longer the old demo id', () => {
      expect(validateParticipantId('c8d9e234-5b6a-4f11-9a2c-7b8901234567')).toBe(true);
      expect(validateParticipantId('00000000-0000-0000-0000-000000000000')).toBe(true);
      expect(validateParticipantId('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF')).toBe(true);
      expect(validateParticipantId('p1')).toBe(true);
      expect(validateParticipantId('P10')).toBe(true);
      expect(validateParticipantId('p999')).toBe(true);
      expect(validateParticipantId('bypass_user_id')).toBe(false);
      // Handles leading/trailing whitespace
      expect(validateParticipantId('  c8d9e234-5b6a-4f11-9a2c-7b8901234567  ')).toBe(true);
    });
  });

  describe('2. fetchParticipantById Adversarial Scenarios', () => {
    test('returns invalid participant format error for injection attempts without hitting database', async () => {
      const result = await fetchParticipantById("'; DROP TABLE users; --");
      expect(result.data).toBeNull();
      expect(result.error).toBe('Invalid participant ID format');
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    test('gracefully handles user with non-ASCII unicode characters and null fields', async () => {
      const unicodeId = '12345678-1234-1234-1234-123456789abc';
      usersTable.push({
        id: unicodeId,
        name: 'José 🌟 李小龙',
        role: null, // should fallback to 'participant'
        email: null, // should fallback to ''
        checked_in_at: null,
        discipline: null,
      });

      const result = await fetchParticipantById(unicodeId);
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('José 🌟 李小龙');
      expect(result.data?.role).toBe('participant');
      expect(result.data?.email).toBe('');
      expect(result.data?.checked_in_at).toBeNull();
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('fetch_attendee_directory', { p_query: '' });
    });

    test('with a backend, a sample person who is not in the database is not found', async () => {
      // MOCK_PEOPLE only stand in when no backend is configured; real check-in
      // never falls back to them.
      const result = await fetchParticipantById('p8');
      expect(result.data).toBeNull();
      expect(result.error).toBe('Participant not found');
    });

    test('returns participant not found when ID does not exist in DB or mock data', async () => {
      const nonExistentUuid = '99999999-9999-9999-9999-999999999999';
      const result = await fetchParticipantById(nonExistentUuid);
      expect(result.data).toBeNull();
      expect(result.error).toBe('Participant not found');
    });

    test('preserves permission errors without falling back to sample people', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Front-desk permission required' } });
      const result = await fetchParticipantById('p8');
      expect(result).toEqual({ data: null, error: 'Front-desk permission required' });
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  describe('3. checkInParticipant Double Check-In and Mutation Stress', () => {
    test('detects already checked-in status and prevents duplicate timestamp mutation', async () => {
      const checkedInUuid = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
      const initialTimestamp = '2026-09-06T10:00:00.000Z';

      usersTable.push({
        id: checkedInUuid,
        name: 'Dana Scully',
        role: 'participant',
        email: 'scully@fbi.gov',
        checked_in_at: initialTimestamp,
      });

      const result = await checkInParticipant(checkedInUuid);

      expect(result.success).toBe(false);
      expect(result.alreadyCheckedIn).toBe(true);
      expect(result.user?.checked_in_at).toBe(initialTimestamp);
      expect(result.error).toContain('Dana Scully is already checked in.');

      // Ensure no update was executed on the table
      const stored = usersTable.find((u) => u.id === checkedInUuid);
      expect(stored.checked_in_at).toBe(initialTimestamp);
    });

    test('successful first check-in updates checked_in_at timestamp to now', async () => {
      const validUuid = 'b2c3d4e5-f6a1-4b2c-8d3e-4f5a6b7c8d9e';

      usersTable.push({
        id: validUuid,
        name: 'Fox Mulder',
        role: 'participant',
        email: 'mulder@fbi.gov',
        checked_in_at: null,
      });

      const result = await checkInParticipant(validUuid);

      expect(result.success).toBe(true);
      expect(result.user?.checked_in_at).toBeTruthy();

      const stored = usersTable.find((u) => u.id === validUuid);
      expect(stored.checked_in_at).toBe(result.user?.checked_in_at);

      // Immediate second check-in attempt MUST fail with alreadyCheckedIn: true
      const secondResult = await checkInParticipant(validUuid);
      expect(secondResult.success).toBe(false);
      expect(secondResult.alreadyCheckedIn).toBe(true);
      expect(secondResult.user?.checked_in_at).toBe(result.user?.checked_in_at);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('scan_summit_checkin', { p_attendee_id: validUuid });
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    test('concurrent scans produce one check-in and preserve its server timestamp', async () => {
      const id = 'b2c3d4e5-f6a1-4b2c-8d3e-4f5a6b7c8d9e';
      usersTable.push({ id, name: 'Attendee', checked_in_at: null });
      const results = await Promise.all([checkInParticipant(id), checkInParticipant(id), checkInParticipant(id)]);
      expect(results.filter((result) => result.success)).toHaveLength(1);
      expect(results.filter((result) => result.alreadyCheckedIn)).toHaveLength(2);
      expect(new Set(results.map((result) => result.user?.checked_in_at)).size).toBe(1);
    });

    test('denied check-in leaves the attendee unchanged and reports the RPC error', async () => {
      const id = 'b2c3d4e5-f6a1-4b2c-8d3e-4f5a6b7c8d9e';
      usersTable.push({ id, name: 'Attendee', checked_in_at: null });
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Check-in permission denied' } });
      const result = await checkInParticipant(id);
      expect(result).toEqual({ success: false, error: 'Check-in permission denied' });
      expect(usersTable[0].checked_in_at).toBeNull();
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });
});
