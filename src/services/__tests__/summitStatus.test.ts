import { describe, test, expect, beforeEach, vi } from 'vitest';

const backend = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: backend, isSupabaseConfigured: true }));

const status = await import('../summitStatus');

beforeEach(() => {
  backend.rpc.mockReset();
  status.resetSummitStatusCache();
});

describe('fetch_summit_status', () => {
  test('reads the shared date and feedback flag', async () => {
    backend.rpc.mockResolvedValue({ data: { summit_date: '2027-01-23', feedback_open: true }, error: null });
    expect(await status.fetchSummitStatus()).toEqual({ date: '2027-01-23', feedbackOpen: true });
    expect(backend.rpc).toHaveBeenCalledWith('fetch_summit_status');
  });

  test('an unset date or a failed read means no date, never a guessed one', async () => {
    backend.rpc.mockResolvedValue({ data: { summit_date: null, feedback_open: false }, error: null });
    expect(await status.fetchSummitStatus()).toEqual(status.UNKNOWN_STATUS);
    backend.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await status.fetchSummitStatus()).toEqual(status.UNKNOWN_STATUS);
    backend.rpc.mockRejectedValue(new Error('offline'));
    expect(await status.fetchSummitStatus()).toEqual(status.UNKNOWN_STATUS);
  });
});

describe('date helpers (ports of the app)', () => {
  test('formatDay matches the app, adding the year only when it differs', () => {
    expect(status.formatDay('2027-01-23', new Date(2027, 0, 1))).toBe('Sat, Jan 23');
    expect(status.formatDay('2027-01-23', new Date(2026, 10, 10))).toBe('Sat, Jan 23, 2027');
  });

  test('the countdown targets the earliest session from 6 AM on, else 8 AM', () => {
    expect(status.summitStart('2027-01-23', [14 * 60, 9 * 60 + 45, 2 * 60])).toEqual(new Date(2027, 0, 23, 9, 45));
    expect(status.summitStart('2027-01-23', [])).toEqual(new Date(2027, 0, 23, 8, 0));
  });

  test('countdown parts, and nothing once the summit has started', () => {
    const start = new Date(2027, 0, 23, 9, 0);
    expect(status.countdownParts(start, new Date(2027, 0, 21, 7, 58, 30)))
      .toEqual({ days: 2, hours: 1, minutes: 1, seconds: 30 });
    expect(status.countdownParts(start, start)).toBeNull();
  });
});
