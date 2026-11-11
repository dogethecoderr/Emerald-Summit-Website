import { describe, test, expect, beforeEach, vi } from 'vitest';

// Read state and "Remove from my feed" use the app's tables, so they follow
// the account between the website and the phone.
const { calls, backend, rows } = vi.hoisted(() => {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const rows: Record<string, unknown[]> = { announcement_reads: [], announcement_dismissals: [] };
  const builder = (table: string) => {
    const b: any = {
      select: (...args: unknown[]) => { calls.push({ table, op: 'select', args }); return Promise.resolve({ data: rows[table], error: null }); },
      upsert: (...args: unknown[]) => { calls.push({ table, op: 'upsert', args }); return Promise.resolve({ error: null }); },
      delete: () => { calls.push({ table, op: 'delete', args: [] }); return b; },
      eq: (...args: unknown[]) => { calls.push({ table, op: 'eq', args }); return b; },
      then: (resolve: any) => resolve({ error: null }),
    };
    return b;
  };
  const backend = {
    session: { user: { id: 'me' } } as null | { user: { id: string } },
    from: (table: string) => builder(table),
    auth: { getSession: async () => ({ data: { session: backend.session } }) },
  };
  return { calls, backend, rows };
});
vi.mock('../../lib/supabase', () => ({ supabase: backend, isSupabaseConfigured: true }));

const svc = await import('../announcements');

beforeEach(() => {
  calls.length = 0;
  backend.session = { user: { id: 'me' } };
  rows.announcement_reads = [
    { announcement_id: 'a1', opened_at: '2026-11-10T00:00:00Z' },
    { announcement_id: 'a2', opened_at: null },
  ];
  rows.announcement_dismissals = [{ announcement_id: 'a3' }];
});

describe('shared read state', () => {
  test('only opened posts count as read, like the app\'s dots', async () => {
    expect(await svc.fetchOpenedIds()).toEqual(new Set(['a1']));
  });

  test('opening upserts opened_at for this account', async () => {
    await svc.markOpened(['a2', 'a4']);
    const upsert = calls.find((c) => c.op === 'upsert')!;
    expect(upsert.table).toBe('announcement_reads');
    const [payload, options] = upsert.args as [Record<string, unknown>[], unknown];
    expect(payload.map((r) => [r.user_id, r.announcement_id])).toEqual([['me', 'a2'], ['me', 'a4']]);
    expect(payload.every((r) => typeof r.opened_at === 'string')).toBe(true);
    expect(options).toEqual({ onConflict: 'user_id,announcement_id' });
  });

  test('signed out reads nothing and writes nothing', async () => {
    backend.session = null;
    expect(await svc.fetchOpenedIds()).toBeNull();
    expect(await svc.fetchDismissedIds()).toBeNull();
    await svc.markOpened(['a1']);
    expect(calls).toEqual([]);
  });
});

describe('remove from my feed', () => {
  test('hides and unhides through announcement_dismissals', async () => {
    expect(await svc.fetchDismissedIds()).toEqual(new Set(['a3']));
    await svc.hideForMe('a5');
    expect(calls.find((c) => c.op === 'upsert')).toEqual({
      table: 'announcement_dismissals', op: 'upsert',
      args: [{ user_id: 'me', announcement_id: 'a5' }, { onConflict: 'user_id,announcement_id', ignoreDuplicates: true }],
    });
    await svc.unhideForMe('a5');
    expect(calls.filter((c) => c.op === 'eq').map((c) => c.args)).toEqual([['user_id', 'me'], ['announcement_id', 'a5']]);
  });
});
