import { describe, test, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// No backend: the schedule lives in this tab and counts move locally.
vi.mock('../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock('../AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'bypass_user_id' } }, profile: null }),
}));

const { ScheduleProvider, useSchedule, ownScheduleKind } = await import('../ScheduleContext');
const { MOCK_SESSIONS } = await import('../../models/sessions');
const reservations = await import('../../services/reservations');

const wrapper = ({ children }: { children: ReactNode }) => <ScheduleProvider>{children}</ScheduleProvider>;
afterEach(() => vi.restoreAllMocks());

describe('ScheduleProvider (local)', () => {
  test('reserving, switching kinds, and releasing move the right seat counts', async () => {
    const s = MOCK_SESSIONS.find((x) => x.spectatorCap > 0)!;
    const { result } = renderHook(() => useSchedule(), { wrapper });
    expect(result.current.saved).toBe(false);

    await act(() => result.current.reserveSession(s.id, 'competing'));
    expect(result.current.mySchedule).toContain(s.id);
    expect(result.current.sessionCounts[s.id].enrolled).toBe(s.enrolled + 1);

    await act(() => result.current.reserveSession(s.id, 'spectating'));
    expect(result.current.mySchedule).not.toContain(s.id);
    expect(result.current.spectating).toContain(s.id);
    expect(result.current.sessionCounts[s.id]).toMatchObject({
      enrolled: s.enrolled,
      spectators: s.spectators + 1,
    });

    await act(() => result.current.releaseSession(s.id));
    expect(result.current.spectating).not.toContain(s.id);
    expect(result.current.sessionCounts[s.id].spectators).toBe(s.spectators);
  });

  test('volunteer spots cannot be self-assigned, including in local mode', async () => {
    const s = MOCK_SESSIONS[1];
    const { result } = renderHook(() => useSchedule(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(ownScheduleKind('volunteer')).toBe('volunteering');
    expect(ownScheduleKind('ambassador')).toBe('volunteering');
    expect(ownScheduleKind('attendee')).toBeNull();

    await expect(result.current.reserveSession(s.id, 'volunteering')).rejects.toThrow('assigned by an admin');
    expect(result.current.listFor('volunteering')).toEqual([]);
    expect(result.current.sessionCounts[s.id].volunteersEnrolled).toBe(s.volunteersEnrolled);
  });

  test('admin assignments load separately and cannot be removed or converted by the volunteer', async () => {
    const s = MOCK_SESSIONS[1];
    vi.spyOn(reservations, 'fetchMyVolunteerAssignments').mockResolvedValue([s.id]);
    const { result } = renderHook(() => useSchedule(), { wrapper });
    await waitFor(() => expect(result.current.volunteerSchedule).toEqual([s.id]));

    await expect(result.current.releaseSession(s.id)).rejects.toThrow('Only an admin');
    await expect(result.current.reserveSession(s.id, 'competing')).rejects.toThrow('assigned by an admin');
    expect(result.current.volunteerSchedule).toEqual([s.id]);
  });

  test('a failed backend load never falls back to making unsaved local reservations', async () => {
    vi.spyOn(reservations, 'fetchMyReservations').mockRejectedValue(new Error('Backend unavailable'));
    const { result } = renderHook(() => useSchedule(), { wrapper });
    await waitFor(() => expect(result.current.scheduleError).toBe('Backend unavailable'));
    await expect(result.current.reserveSession(MOCK_SESSIONS[0].id, 'competing')).rejects.toThrow('Refresh the page');
    expect(result.current.mySchedule).toEqual([]);
  });
});
