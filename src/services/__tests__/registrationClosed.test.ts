import { beforeEach, describe, expect, test, vi } from 'vitest';

const backend = vi.hoisted(() => ({ error: null as { message: string } | null, data: null as unknown }));

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: async () => ({ data: backend.data, error: backend.error }) },
  isSupabaseConfigured: true,
}));

import { toggleRegistration } from '../sessionRegistration';
import { REGISTRATION_CLOSED_MESSAGE } from '../siteSwitches';

beforeEach(() => {
  backend.error = null;
  backend.data = null;
});

describe('register_for_session while registration is closed', () => {
  test("the server's registration_closed refusal reads as the November 21st message", async () => {
    backend.error = { message: 'registration_closed' };
    await expect(toggleRegistration('s1', { add: true, type: 'spectator' }))
      .resolves.toEqual({ outcome: 'invalid_project', message: `${REGISTRATION_CLOSED_MESSAGE}.` });
  });

  test('other errors still throw', async () => {
    backend.error = { message: 'Session not found' };
    await expect(toggleRegistration('s1', { add: true })).rejects.toThrow('Session not found');
  });
});
