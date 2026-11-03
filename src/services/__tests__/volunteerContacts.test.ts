import { beforeEach, expect, test, vi } from 'vitest';
import { fetchVolunteerContacts } from '../volunteerContacts';
const backend = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: backend }));
beforeEach(() => vi.clearAllMocks());

test('uses the restricted mobile volunteer hub RPC without querying public profiles', async () => {
  backend.rpc.mockResolvedValue({ data: [{ id: 'one', full_name: ' Team Admin ', role: 'admin', subtype: null, phone: ' 5551230000 ' }], error: null });
  await expect(fetchVolunteerContacts()).resolves.toEqual([{ id: 'one', name: 'Team Admin', role: 'admin', subtype: null, phone: '5551230000' }]);
  expect(backend.rpc).toHaveBeenCalledWith('fetch_volunteer_hub');
});

test('surfaces access failures without falling back to sample contacts', async () => {
  backend.rpc.mockResolvedValue({ data: null, error: { message: 'Only volunteers and admins may open the volunteer hub' } });
  await expect(fetchVolunteerContacts()).rejects.toThrow('Only volunteers and admins');
});
