import { beforeEach, describe, expect, test, vi } from 'vitest';

const backend = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, { message: string; code?: string }>,
  queries: [] as { table: string; operation: string; payload?: unknown; orders: unknown[] }[],
  rpcResult: { outcome: 'added' } as { outcome: string; conflicting_title?: string },
  rpc: vi.fn(),
  upload: vi.fn(),
  channels: 0,
  removals: 0,
  unsubscribe: vi.fn(),
  authListener: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  session: { user: { id: 'shared-user' } } as { user: { id: string } } | null,
}));

vi.mock('../auth', () => ({ getBypassSession: () => null }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: backend.session } }),
      onAuthStateChange: (listener: typeof backend.authListener) => {
        backend.authListener = listener;
        return { data: { subscription: { unsubscribe: backend.unsubscribe } } };
      },
    },
    channel: () => {
      backend.channels++;
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: async () => { backend.removals++; },
    from: (table: string) => {
      const query = { table, operation: 'select', orders: [] as unknown[], payload: undefined as unknown };
      backend.queries.push(query);
      const result = () => ({ data: backend.rows[table] ?? [], error: backend.errors[table] ?? null });
      const builder = {
        select: () => builder,
        order: (column: string, options: unknown) => { query.orders.push([column, options]); return builder; },
        eq: () => builder,
        insert: (payload: unknown) => { query.operation = 'insert'; query.payload = payload; return builder; },
        update: (payload: unknown) => { query.operation = 'update'; query.payload = payload; return builder; },
        delete: () => { query.operation = 'delete'; return builder; },
        single: async () => ({
          data: { id: 'saved', created_at: '2026-11-01T12:00:00Z', ...query.payload as object },
          error: backend.errors[table] ?? null,
        }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return builder;
    },
    rpc: (name: string, params: unknown) => {
      backend.rpc(name, params);
      return Promise.resolve({ data: backend.rpcResult, error: null });
    },
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: File, options: unknown) => {
          backend.upload(bucket, path, file, options);
          return Promise.resolve({ error: null });
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.test/${path}` } }),
      }),
    },
  },
}));

const content = await import('../summitContent');
const announcements = await import('../announcements');
const reservations = await import('../reservations');
const { MOCK_SESSIONS } = await import('../../models/sessions');
const { TRACKS } = await import('../../models/tracks');

const session = {
  id: 'mobile-session', discipline_id: 'techverse', title: 'Robotics workshop', track: '',
  expert_name: 'Alex', start_time: '09:45', end_time: '11:15', room: 'Lab',
  description: 'Build a robot.', capacity: 24, enrolled: 7,
};
const input = {
  track: 'techverse', title: 'Updated workshop', speaker: 'Alex', time: '9:45 AM', duration: '90 min',
  location: 'New room', room: 'A', description: 'Updated description', capacity: 30,
  expertCapacity: 2, spectatorCap: 5, volunteerCapacity: 2,
};

beforeEach(() => {
  backend.rows = { disciplines: [{ id: 'techverse', name: 'TechVerse', tagline: 'Technology' }], sessions_with_counts: [session] };
  backend.errors = {};
  backend.queries = [];
  backend.rpcResult = { outcome: 'added' };
  backend.rpc.mockClear();
  backend.upload.mockClear();
  backend.channels = 0;
  backend.removals = 0;
  backend.unsubscribe.mockClear();
  backend.authListener = null;
  backend.session = { user: { id: 'shared-user' } };
  localStorage.clear();
});

describe('shared mobile catalog contract', () => {
  test('reads live sessions, shared capacity, and two-digit times without a separate tracks table', async () => {
    await content.loadSummitContent();
    expect(MOCK_SESSIONS).toHaveLength(1);
    expect(MOCK_SESSIONS[0]).toMatchObject({
      id: 'mobile-session', track: 'techverse', trackName: 'Robotics workshop',
      time: '9:45 AM', duration: '90 min', capacity: 24, enrolled: 7,
      expertCapacity: 24, expertsEnrolled: 7, spectatorCap: 24, spectators: 7,
    });
    expect(TRACKS[0]).toMatchObject({ name: 'Robotics workshop', about: 'Build a robot.' });
    expect(backend.queries.map((q) => q.table)).toEqual(['disciplines', 'sessions_with_counts']);
    expect(backend.queries[1].orders).toEqual([['start_time', { ascending: true }]]);
  });

  test('writes session columns used by mobile, preserving locked rooms and unsupported quotas', async () => {
    await content.saveSession(input, 'mobile-session');
    const write = backend.queries.find((q) => q.operation === 'update');
    expect(write).toMatchObject({ table: 'sessions', payload: {
      discipline_id: 'techverse', title: 'Updated workshop', expert_name: 'Alex',
      start_time: '09:45', end_time: '11:15', capacity: 30, description: 'Updated description',
    } });
    expect(Object.keys(write!.payload as object)).not.toContain('room');
    expect(Object.keys(write!.payload as object)).not.toContain('expert_capacity');
  });

  test('refuses invalid time edits and RLS-denied edits', async () => {
    await expect(content.saveSession({ ...input, time: '25:00' }, 'mobile-session')).rejects.toThrow(/valid start time/);
    backend.errors.sessions = { code: 'PGRST116', message: 'No row' };
    await expect(content.saveSession(input, 'mobile-session')).rejects.toThrow(/permission/);
  });

  test('a failed real catalog read never substitutes sample sessions', async () => {
    backend.errors.sessions_with_counts = { message: 'Offline' };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await content.loadSummitContent();
    expect(MOCK_SESSIONS).toEqual([]);
    expect(TRACKS).toEqual([]);
    warn.mockRestore();
  });
});

describe('shared announcement contract', () => {
  test('loads mobile authors and attachment metadata', async () => {
    backend.rows.announcements = [{
      id: 'news', title: 'Schedule update', body: 'Read this.', author: 'Summit', created_by: 'admin',
      audience: 'Everyone', pinned: true, created_at: '2026-11-01T12:00:00Z',
      attachments: [{ url: 'https://example.test/map.pdf', path: 'admin/map.pdf', name: 'Map.pdf', type: 'application/pdf', size: 42 }],
    }];
    const feed = await announcements.fetchAnnouncements();
    expect(feed.source).toBe('remote');
    expect(feed.announcements[0]).toMatchObject({ author: 'Summit', authorId: 'admin', category: 'General',
      attachments: [{ title: 'Map.pdf', type: 'PDF', mimeType: 'application/pdf', bytes: 42 }],
    });
  });

  test('publishes the same columns and attachment JSON as mobile', async () => {
    await announcements.createAnnouncement({ title: 'New', body: 'Body', category: 'Logistics', audience: 'Everyone', pinned: false,
      attachments: [{ id: 'file', title: 'Map.pdf', type: 'PDF', url: 'https://example.test/map.pdf', path: 'admin/map.pdf', mimeType: 'application/pdf', bytes: 42 }],
    }, { id: 'shared-user', name: 'Summit' });
    expect(backend.queries[0].payload).toEqual({ title: 'New', body: 'Body', audience: 'Everyone', discipline_id: null, pinned: false,
      author: 'Summit', created_by: 'shared-user',
      attachments: [{ url: 'https://example.test/map.pdf', path: 'admin/map.pdf', name: 'Map.pdf', type: 'application/pdf', size: 42 }],
    });
  });

  test('uploads into the shared bucket under the signed-in user and honors its 10 MB limit', async () => {
    const file = new File(['pdf'], 'Map.pdf', { type: 'application/pdf' });
    const attachment = await announcements.uploadAttachment(file);
    expect(backend.upload).toHaveBeenCalledWith('announcement_attachments', expect.stringMatching(/^shared-user\//), file,
      expect.objectContaining({ cacheControl: '31536000', upsert: false }));
    expect(attachment.path).toMatch(/^shared-user\//);
    expect(announcements.MAX_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe('shared registrations and volunteer assignments', () => {
  test('reads registrations and admin-assigned volunteer sessions from shared tables', async () => {
    backend.rows.registrations = [{ session_id: 'a', participation_type: 'participant' }, { session_id: 'b', participation_type: 'expert' }];
    backend.rows.session_volunteers = [{ session_id: 'c' }];
    expect(await reservations.fetchMyReservations()).toEqual([{ sessionId: 'a', kind: 'competing' }, { sessionId: 'b', kind: 'judging' }]);
    expect(await reservations.fetchMyVolunteerAssignments()).toEqual(['c']);
  });

  test('uses idempotent add/remove RPCs and rejects server refusals', async () => {
    await reservations.reserve('a', 'spectating');
    expect(backend.rpc).toHaveBeenLastCalledWith('register_for_session', {
      p_session_id: 'a', p_participation_type: 'spectator', p_answers: {}, p_intent: 'add',
    });
    backend.rpcResult = { outcome: 'removed' };
    await reservations.release('a');
    expect(backend.rpc).toHaveBeenLastCalledWith('register_for_session', { p_session_id: 'a', p_intent: 'remove' });
    backend.rpcResult = { outcome: 'full' };
    await expect(reservations.reserve('b', 'competing')).rejects.toThrow('This session is full.');
    await expect(reservations.reserve('b', 'volunteering')).rejects.toThrow(/assigned by an admin/);
    expect(backend.queries.some((q) => q.operation === 'insert')).toBe(false);
  });
});

describe('shared announcement audience rules', () => {
  const base = { id: 'a', title: 'Notice', body: '', category: 'General' as const, date: '', pinned: false, author: 'Summit', audience: 'Everyone' };
  const feed = [
    { ...base, id: 'broadcast' },
    { ...base, id: 'tech', disciplineId: 'techverse' },
    { ...base, id: 'bio', disciplineId: 'biosphere' },
    { ...base, id: 'mine', targetUserId: 'me', disciplineId: 'biosphere' },
    { ...base, id: 'theirs', targetUserId: 'someone-else' },
  ];

  test('a registration grants its discipline notices; personal notices stay recipient-only', () => {
    const visible = announcements.announcementsForUser(feed, {
      userId: 'me', registeredDisciplines: new Set(['techverse']), canManageDiscipline: () => false,
    });
    expect(visible.map((a) => a.id)).toEqual(['broadcast', 'tech', 'mine']);
  });

  test('scoped editors and admins see their disciplines without receiving other personal notices', () => {
    expect(announcements.announcementsForUser(feed, {
      userId: 'editor', registeredDisciplines: new Set(), canManageDiscipline: (id) => id === 'biosphere',
    }).map((a) => a.id)).toEqual(['broadcast', 'bio']);
    expect(announcements.announcementsForUser(feed, {
      userId: 'admin', registeredDisciplines: new Set(), canManageDiscipline: () => true,
    }).map((a) => a.id)).toEqual(['broadcast', 'tech', 'bio']);
  });
});


describe('shared announcement realtime lifecycle', () => {
  test('uses one authenticated channel and cleans up on sign-out without stale re-subscription', async () => {
    const stop = announcements.subscribeToAnnouncements(vi.fn());
    backend.authListener?.('SIGNED_IN', backend.session);
    backend.authListener?.('TOKEN_REFRESHED', backend.session);
    backend.authListener?.('SIGNED_OUT', null);
    await Promise.resolve();
    expect(backend.channels).toBe(1);
    expect(backend.removals).toBe(1);
    stop();
    expect(backend.unsubscribe).toHaveBeenCalledOnce();
    expect(backend.removals).toBe(1);
  });

  test('unmounting before session restoration does not leave a channel open', async () => {
    const stop = announcements.subscribeToAnnouncements(vi.fn());
    stop();
    await Promise.resolve();
    expect(backend.channels).toBe(0);
    expect(backend.unsubscribe).toHaveBeenCalledOnce();
  });
});
