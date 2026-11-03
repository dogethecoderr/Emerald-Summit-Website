import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

// The auth trigger owns account creation and role eligibility. This fake only
// permits the website to read/update its own shared mobile profile.
const { db, backend } = vi.hoisted(() => {
  const db = {
    profiles: [] as Record<string, any>[],
    tables: [] as string[],
    updates: [] as Record<string, any>[],
    reads: 0,
    demoEnabled: true,
    session: null as null | { user: { id: string } },
    forcedRole: null as string | null,
    readError: false,
    updateError: false,
  };
  const clone = (value: Record<string, any>) => JSON.parse(JSON.stringify(value));
  const from = (table: string) => {
    db.tables.push(table);
    let payload: Record<string, any> | null = null;
    const filters: [string, unknown][] = [];
    const run = async () => {
      if (table !== 'profiles') throw new Error(`Unexpected table: ${table}`);
      const row = db.profiles.find((p) => filters.every(([key, value]) => p[key] === value));
      if (payload) {
        db.updates.push(clone(payload));
        if (!row || db.updateError) return { data: null, error: { code: '42501', message: 'Update refused' } };
        Object.assign(row, payload);
        if (payload.role && db.forcedRole) row.role = db.forcedRole;
        return { data: clone(row), error: null };
      }
      db.reads++;
      return db.readError ? { data: null, error: { message: 'Read failed' } } : { data: row ? clone(row) : null, error: null };
    };
    const builder: any = {
      select: () => builder,
      update: (input: Record<string, any>) => { payload = input; return builder; },
      insert: () => { throw new Error('The client must never insert an account'); },
      upsert: () => { throw new Error('The client must never upsert an account'); },
      eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
      single: run,
      maybeSingle: run,
      then: (resolve: any, reject: any) => run().then(resolve, reject),
    };
    return builder;
  };
  const backend = {
    from,
    rpc: vi.fn(async () => ({ data: [], error: null })),
    auth: {
      getSession: async () => ({ data: { session: db.session } }),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithOAuth: vi.fn(async (_input: unknown) => ({ error: null })),
      signInWithOtp: vi.fn(async (_input: unknown) => ({ error: null })),
      verifyOtp: vi.fn(async (_input: unknown) => ({ error: null })),
    },
  };
  return { db, backend };
});
vi.mock('../../lib/supabase', () => ({ supabase: backend, isSupabaseConfigured: true }));
vi.mock('../../lib/demoMode', () => ({ get isDemoModeEnabled() { return db.demoEnabled; } }));

const auth = await import('../auth');
const user = { id: 'user-1', email: 'student@example.com', user_metadata: { full_name: 'Sam Student' } } as unknown as User;
const sharedProfile = () => ({
  id: 'user-1', email: user.email, full_name: 'Sam Mobile', role: 'participant', onboarded: false,
  details: { school: 'Mobile High School', grade: '10', phone: '5551112222', bio: 'Student researcher', custom_answer: 'keep me' },
  can_edit_sessions: false, can_post_announcements: false, can_check_in_front_desk: false,
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  db.profiles = [sharedProfile()];
  db.tables = [];
  db.updates = [];
  db.reads = 0;
  db.demoEnabled = true;
  db.session = null;
  db.forcedRole = null;
  db.readError = false;
  db.updateError = false;
});

describe('shared mobile profiles', () => {
  test('maps full_name, onboarded and details without losing server-owned fields', () => {
    const profile = auth.profileFromRow({ ...sharedProfile(), role: 'parentSpectator', onboarded: true, can_edit_sessions: true });
    expect(profile).toMatchObject({ id: 'user-1', email: user.email, name: 'Sam Mobile', role: 'attendee', profile_setup_complete: true, phone: '5551112222', bio: 'Student researcher', org: 'Mobile High School', can_edit_sessions: true });
    expect(profile.details?.custom_answer).toBe('keep me');
  });

  test('reads the trigger-created account without inserting a separate website account', async () => {
    auth.savePendingRole('participant');
    const profile = await auth.getCurrentProfile(user);
    expect(profile.name).toBe('Sam Mobile');
    expect(auth.needsProfileSetup(profile)).toBe(true);
    expect(db.tables).toEqual(['profiles']);
    expect(db.updates).toEqual([]);
    expect(db.profiles).toHaveLength(1);
  });

  test('missing or failed profile reads fail closed instead of creating a fake account', async () => {
    db.profiles = [];
    await expect(auth.getCurrentProfile(user)).rejects.toMatchObject({ name: 'SignInRefusedError', message: expect.stringContaining("couldn't load") });
    db.profiles = [sharedProfile()];
    db.readError = true;
    await expect(auth.getCurrentProfile(user)).rejects.toMatchObject({ name: 'SignInRefusedError' });
    expect(db.updates).toEqual([]);
  });

  test('concurrent profile loads share the selected role and one server update', async () => {
    auth.savePendingRole('volunteer');
    const [first, second] = await Promise.all([auth.getCurrentProfile(user), auth.getCurrentProfile(user)]);
    expect(first.role).toBe('volunteer');
    expect(second.role).toBe('volunteer');
    expect(db.updates).toEqual([{ role: 'volunteer' }]);
    expect(db.reads).toBe(1);
  });

  test('keeps a completed mobile account in its registered role when another sign-in role was selected', async () => {
    db.profiles[0] = { ...sharedProfile(), onboarded: true, role: 'volunteer', volunteer_subtype: 'parent_volunteer' };
    auth.savePendingRole('admin');
    const profile = await auth.getCurrentProfile(user);
    expect(profile.role).toBe('volunteer');
    expect(profile.volunteer_subtype).toBe('parent_volunteer');
    expect(db.updates).toEqual([]);
  });

  test('refuses a new role when the server keeps a different role', async () => {
    db.forcedRole = 'participant';
    auth.savePendingRole('admin');
    await expect(auth.getCurrentProfile(user)).rejects.toMatchObject({ name: 'SignInRefusedError', role: 'admin', message: "You aren't eligible to sign up as an admin." });
    expect(db.profiles[0].role).toBe('participant');
    expect(db.profiles).toHaveLength(1);
  });

  test('refuses server update errors and unknown roles without inventing another profile', async () => {
    db.updateError = true;
    auth.savePendingRole('volunteer');
    await expect(auth.getCurrentProfile(user)).rejects.toMatchObject({ name: 'SignInRefusedError' });
    db.tables = [];
    auth.savePendingRole('unknown');
    await expect(auth.getCurrentProfile(user)).rejects.toMatchObject({ role: 'unknown' });
    expect(db.tables).toEqual([]);
  });

  test('stores the attendee role with the mobile parentSpectator value', async () => {
    auth.savePendingRole('attendee');
    expect((await auth.getCurrentProfile(user)).role).toBe('attendee');
    expect(db.updates).toEqual([{ role: 'parentSpectator' }]);
  });

  test('loads expert approval state from the shared profile', async () => {
    db.profiles[0] = { ...sharedProfile(), role: 'expert', onboarded: true, expert_status: 'pending' };
    auth.savePendingRole('expert');
    expect(await auth.getCurrentProfile(user)).toMatchObject({ role: 'expert', expert_status: 'pending' });
    expect(db.updates).toEqual([]);
  });
});

describe('shared profile writes', () => {
  beforeEach(() => { db.session = { user: { id: 'user-1' } }; });

  test('finishes onboarding through full_name/onboarded and merges answers into details', async () => {
    await auth.saveProfile({ name: 'Sam Updated', phone: '5553334444', discipline: 'techverse', registration: { grade: 11, school: 'Website High', teamName: 'Summiteers', teammates: ['Ada ', ' ', 'Alan'], track: 'Engineering', projectTitle: 'Solar still', projectOverview: 'Water purification' } });
    expect(db.profiles[0]).toMatchObject({ full_name: 'Sam Updated', onboarded: true, role: 'participant', details: { school: 'Website High', grade: '11', phone: '5553334444', bio: 'Student researcher', custom_answer: 'keep me', discipline: 'techverse', team_name: 'Summiteers', teammates: ['Ada', 'Alan'], track: 'Engineering', project_title: 'Solar still', project_overview: 'Water purification' } });
    expect(db.tables.every((table) => table === 'profiles')).toBe(true);
    expect(Object.keys(db.updates[0]).sort()).toEqual(['details', 'full_name', 'onboarded', 'updated_at']);
    const restored = await auth.getRegistration();
    expect(restored).toMatchObject({ grade: 11, school: 'Website High', teamName: 'Summiteers', teammates: ['Ada', 'Alan'], track: 'Engineering' });
    expect(typeof restored?.grade).toBe('number');
  });

  test('editing preserves onboarding, other mobile answers and all server-owned capability flags', async () => {
    db.profiles[0] = { ...sharedProfile(), onboarded: true, role: 'volunteer', can_edit_sessions: true, can_post_announcements: true, volunteer_subtype: 'eaf_ambassador', managed_disciplines: ['techverse'] };
    await auth.updateProfileSettings({ name: 'Sam Volunteer', phone: '', bio: 'New bio' });
    expect(db.profiles[0]).toMatchObject({ full_name: 'Sam Volunteer', onboarded: true, role: 'volunteer', can_edit_sessions: true, can_post_announcements: true, volunteer_subtype: 'eaf_ambassador', managed_disciplines: ['techverse'], details: { phone: '', bio: 'New bio', grade: '10', school: 'Mobile High School', custom_answer: 'keep me' } });
    expect(Object.keys(db.updates[0]).sort()).toEqual(['details', 'full_name', 'updated_at']);
  });

  test('requires a real session and a successful read before saving', async () => {
    db.session = null;
    await expect(auth.saveProfile({ name: 'No session' })).rejects.toThrow('Not signed in');
    db.session = { user: { id: 'user-1' } };
    db.readError = true;
    await expect(auth.updateProfileSettings({ name: 'Read failed' })).rejects.toThrow("couldn't load");
    expect(db.updates).toEqual([]);
  });
});

describe('verified email sign-in', () => {
  test('sends and verifies Supabase OTP without creating a local approved session', async () => {
    await auth.sendSignInCode('expert@example.com', 'expert');
    expect(backend.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'expert@example.com', options: { shouldCreateUser: true } });
    expect(localStorage.getItem('pending_user_role')).toBe('expert');
    expect(auth.getBypassSession()).toBeNull();
    await auth.verifySignInCode('expert@example.com', '12345678');
    expect(backend.auth.verifyOtp).toHaveBeenCalledWith({ email: 'expert@example.com', token: '12345678', type: 'email' });
    expect(auth.getBypassSession()).toBeNull();
  });
});

describe('development demo sessions', () => {
  test('starts at profile setup and cannot write shared data', async () => {
    auth.signInWithBypass('participant');
    expect(auth.isDemoSession()).toBe(true);
    expect(auth.needsProfileSetup(auth.getBypassProfile())).toBe(true);
    await expect(auth.saveProfile({ name: 'Demo' })).rejects.toThrow(/nothing is saved/);
    await expect(auth.updateProfileSettings({ name: 'Demo' })).rejects.toThrow(/nothing is saved/);
    expect(db.updates).toEqual([]);
    expect(db.tables).toEqual([]);
  });

  test('completes registration in this browser only', async () => {
    auth.signInWithBypass('participant');
    auth.completeDemoProfile({ name: 'Demo Student', registration: { teamName: 'Demo Team', teammates: ['Kai'], track: 'Engineering' } });
    expect(auth.getBypassProfile()).toMatchObject({ name: 'Demo Student', profile_setup_complete: true });
    expect(await auth.getRegistration()).toMatchObject({ teamName: 'Demo Team', teammates: ['Kai'], track: 'Engineering' });
    expect(db.updates).toEqual([]);
  });

  test('sign-out ends the local session immediately and notifies the app', async () => {
    auth.signInWithBypass('participant');
    const heard = vi.fn();
    window.addEventListener('storage', heard);
    await auth.signOut();
    window.removeEventListener('storage', heard);
    expect(auth.getBypassSession()).toBeNull();
    expect(heard).toHaveBeenCalled();
  });

  test('production rejects new local approvals and removes both demo and legacy expert sessions', () => {
    db.demoEnabled = false;
    expect(() => auth.signInWithBypass('participant')).toThrow(/off/);
    expect(() => auth.signInWithApprovedEmail('expert', 'judge@example.com', 'Jo Judge')).toThrow(/Google or an email code/);
    for (const demo of [true, false]) {
      localStorage.setItem('bypass_session', JSON.stringify({ demo, user: { id: 'bypass_user_id' } }));
      localStorage.setItem('bypass_profile', JSON.stringify({ role: 'expert' }));
      expect(auth.getBypassSession()).toBeNull();
      expect(auth.getBypassProfile()).toBeNull();
      expect(localStorage.getItem('bypass_profile')).toBeNull();
    }
  });
});
