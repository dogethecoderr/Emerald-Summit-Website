import { describe, test, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

// No backend: the schedule lives in this tab and counts move locally.
vi.mock('../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock('../AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'bypass_user_id' } }, profile: null }),
}));

const { ScheduleProvider, useSchedule, ownScheduleKind } = await import('../ScheduleContext');
const { MOCK_SESSIONS } = await import('../../models/sessions');

const wrapper = ({ children }: { children: ReactNode }) => <ScheduleProvider>{children}</ScheduleProvider>;

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

  test('volunteers sign up for volunteer spots', async () => {
    const s = MOCK_SESSIONS[1];
    const { result } = renderHook(() => useSchedule(), { wrapper });
    expect(ownScheduleKind('volunteer')).toBe('volunteering');
    expect(ownScheduleKind('ambassador')).toBe('volunteering');
    expect(ownScheduleKind('attendee')).toBeNull();

    await act(() => result.current.reserveSession(s.id, 'volunteering'));
    expect(result.current.listFor('volunteering')).toEqual([s.id]);
    expect(result.current.sessionCounts[s.id].volunteersEnrolled).toBe(s.volunteersEnrolled + 1);
  });
});
