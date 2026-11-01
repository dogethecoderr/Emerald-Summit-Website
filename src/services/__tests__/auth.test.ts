import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

// A small stand-in for the Supabase project: public.users with the
// role_allowlist insert trigger (gated roles not on the sheet become
// participant) and enforce_users_update_rules (refuses a gated switch with
// 42501), plus the caller's own role_allowlist rows.
const db = vi.hoisted(() => ({
  users: [] as Record<string, any>[],
  allowlist: [] as { role: string; subtype: string | null }[],
  writes: 0,
  demoEnabled: true,
  session: null as null | { user: { id: string } },
  registrations: [] as Record<string, any>[],
  // False until the student_registrations migration runs.
  registrationsTable: true,
}));

vi.hoisted(() => {
  const gated = ['volunteer', 'ambassador', 'admin'];
  const allowed = (role: string) =>
    !gated.includes(role) ||
    db.allowlist.some((r) =>
      role === 'admin'
        ? r.role === 'admin'
        : r.role === 'volunteer' && (role !== 'ambassador' || r.subtype === 'eaf_ambassador'),
    );

  function query(table: string) {
    let op: 'select' | 'insert' | 'update' | 'upsert' = 'select';
    let payload: Record<string, any> | null = null;
    const filters: [string, unknown][] = [];

    const run = async () => {
      if (table === 'role_allowlist') {
        const rows = db.allowlist.filter((r) =>
          filters.every(([k, v]) => (r as any)[k] === v),
        );
        return { data: rows, error: null };
      }
      if (table === 'student_registrations') {
        if (!db.registrationsTable) {
          return { data: null, error: { code: 'PGRST205', message: 'table not found' } };
        }
        if (op === 'upsert') {
          db.writes++;
          db.registrations = db.registrations.filter((r) => r.user_id !== payload!.user_id);
          db.registrations.push({ ...payload! });
          return { data: null, error: null };
        }
        const row = db.registrations.find((r) => filters.every(([k, v]) => r[k] === v));
        return { data: row ? { ...row } : null, error: null };
      }
      if (op === 'insert') {
        db.writes++;
        const row = { ...payload! };
        if (!allowed(row.role)) row.role = 'participant';
        db.users.push(row);
        return { data: { ...row }, error: null };
      }
      const row = db.users.find((u) => filters.every(([k, v]) => u[k] === v));
      if (op === 'update') {
        db.writes++;
        if (!row) return { data: null, error: { code: 'PGRST116' } };
        if (payload!.role && payload!.role !== row.role && !allowed(payload!.role)) {
          return {
            data: null,
            error: { code: '42501', message: "You aren't eligible to sign up as that role." },
          };
        }
        Object.assign(row, payload);
        return { data: { ...row }, error: null };
      }
      return { data: row ? { ...row } : null, error: null };
    };

    const builder: any = {
      select: () => builder,
      insert: (p: Record<string, any>) => ((op = 'insert'), (payload = p), builder),
      upsert: (p: Record<string, any>) => ((op = 'upsert'), (payload = p), builder),
      update: (p: Record<string, any>) => ((op = 'update'), (payload = p), builder),
      eq: (k: string, v: unknown) => (filters.push([k, v]), builder),
      single: run,
      maybeSingle: run,
      then: (resolve: any, reject: any) => run().then(resolve, reject),
    };
    return builder;
  }

  (globalThis as any).__fakeSupabase = {
    from: query,
    auth: {
      getSession: async () => ({ data: { session: db.session } }),
      signOut: async () => ({ error: null }),
    },
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: (globalThis as any).__fakeSupabase,
  isSupabaseConfigured: true,
}));
vi.mock('../../lib/demoMode', () => ({
  get isDemoModeEnabled() {
    return db.demoEnabled;
  },
}));

const auth = await import('../auth');

const user = {
  id: 'user-1',
  email: 'student@example.com',
  user_metadata: { full_name: 'Sam Student' },
} as unknown as User;

beforeEach(() => {
  localStorage.clear();
  db.users = [];
  db.allowlist = [];
  db.writes = 0;
  db.demoEnabled = true;
  db.session = null;
  db.registrations = [];
  db.registrationsTable = true;
});

describe('getCurrentProfile', () => {
  test('a new student account is created as a participant awaiting profile setup', async () => {
    auth.savePendingRole('participant');
    const profile = await auth.getCurrentProfile(user);
    expect(profile.role).toBe('participant');
    expect(profile.profile_setup_complete).toBe(false);
    expect(auth.needsProfileSetup(profile)).toBe(true);
    expect(db.users).toHaveLength(1);
  });

  test('two loads at once share one request, so the role is not lost', async () => {
    db.allowlist = [{ role: 'volunteer', subtype: 'student_volunteer' }];
    auth.savePendingRole('volunteer');
    const [a, b] = await Promise.all([
      auth.getCurrentProfile(user),
      auth.getCurrentProfile(user),
    ]);
    expect(a.role).toBe('volunteer');
    expect(b.role).toBe('volunteer');
    expect(db.users).toHaveLength(1);
  });

  test('a new account refused a gated role is not created as a participant', async () => {
    auth.savePendingRole('volunteer');
    await expect(auth.getCurrentProfile(user)).rejects.toMatchObject({
      name: 'SignInRefusedError',
      role: 'volunteer',
      message: "You aren't eligible to sign up as a volunteer.",
    });
    expect(db.users).toHaveLength(0);
  });

  test('an existing account refused a switch is not kept in its old role', async () => {
    db.users = [{ id: 'user-1', email: user.email, role: 'participant', profile_setup_complete: true }];
    auth.savePendingRole('admin');
    await expect(auth.getCurrentProfile(user)).rejects.toMatchObject({
      role: 'admin',
      message: "You aren't eligible to sign up as an admin.",
    });
    expect(db.users[0].role).toBe('participant');
  });

  test('a role that never signs in with Google is refused without touching the database', async () => {
    auth.savePendingRole('expert');
    await expect(auth.getCurrentProfile(user)).rejects.toMatchObject({ role: 'expert' });
    expect(db.users).toHaveLength(0);
    expect(db.writes).toBe(0);
  });

  test('an existing account can switch to an open role', async () => {
    db.users = [{ id: 'user-1', email: user.email, role: 'volunteer', profile_setup_complete: true }];
    auth.savePendingRole('participant');
    const profile = await auth.getCurrentProfile(user);
    expect(profile.role).toBe('participant');
  });
});

describe('saveProfile', () => {
  const registration = {
    grade: 10,
    school: 'Emerald High School',
    teamName: 'The Summiteers',
    teammates: ['Ada Lovelace', '  ', 'Alan Turing '],
    track: 'Engineering',
    projectTitle: 'Water purifier',
    projectOverview: 'A solar still.',
  };

  beforeEach(() => {
    db.session = { user: { id: 'user-1' } };
    db.users = [{ id: 'user-1', email: user.email, role: 'participant', profile_setup_complete: false }];
  });

  test('stores the team, track, and project in student_registrations, not users', async () => {
    await auth.saveProfile({ name: 'Sam Student', discipline: 'techverse', registration });
    expect(db.users[0]).toMatchObject({
      name: 'Sam Student',
      discipline: 'techverse',
      profile_setup_complete: true,
    });
    expect(db.users[0].team_name).toBeUndefined();
    expect(db.registrations).toEqual([
      {
        user_id: 'user-1',
        grade: 10,
        school: 'Emerald High School',
        team_name: 'The Summiteers',
        teammates: ['Ada Lovelace', 'Alan Turing'],
        track: 'Engineering',
        project_title: 'Water purifier',
        project_overview: 'A solar still.',
      },
    ]);
    expect(await auth.getRegistration()).toMatchObject({
      teamName: 'The Summiteers',
      teammates: ['Ada Lovelace', 'Alan Turing'],
      track: 'Engineering',
    });
  });

  test('still finishes registration before the table exists', async () => {
    db.registrationsTable = false;
    await auth.saveProfile({ name: 'Sam Student', registration });
    expect(db.users[0].profile_setup_complete).toBe(true);
    expect(await auth.getRegistration()).toBeNull();
  });
});

describe('demo (bypass) mode', () => {
  test('starts at profile setup and writes nothing to the database', async () => {
    auth.signInWithBypass('participant');
    expect(auth.isDemoSession()).toBe(true);
    expect(auth.needsProfileSetup(auth.getBypassProfile())).toBe(true);

    await expect(auth.saveProfile({ name: 'Demo' })).rejects.toThrow(/nothing is saved/);
    await expect(auth.updateProfileSettings({ name: 'Demo' })).rejects.toThrow(/nothing is saved/);
    expect(db.writes).toBe(0);
    expect(db.users).toHaveLength(0);
  });

  test('Skip finishes setup in this browser only', () => {
    auth.signInWithBypass('participant');
    auth.completeDemoProfile();
    expect(auth.getBypassProfile()?.profile_setup_complete).toBe(true);
    expect(db.writes).toBe(0);
  });

  test('Continue keeps the registration details in this browser only', async () => {
    auth.signInWithBypass('participant');
    auth.completeDemoProfile({
      name: 'Demo Student',
      registration: { teamName: 'Demo Team', teammates: ['Kai'], track: 'Engineering' },
    });
    expect(auth.getBypassProfile()).toMatchObject({
      name: 'Demo Student',
      profile_setup_complete: true,
    });
    expect(await auth.getRegistration()).toMatchObject({
      teamName: 'Demo Team',
      teammates: ['Kai'],
      track: 'Engineering',
    });
    expect(db.registrations).toHaveLength(0);
    expect(db.writes).toBe(0);
  });

  test('is unavailable when demo mode is off', () => {
    db.demoEnabled = false;
    expect(() => auth.signInWithBypass('participant')).toThrow(/off/);
    expect(auth.getBypassSession()).toBeNull();
  });

  test('a demo session left over from a dev build is dropped when demo mode is off', () => {
    auth.signInWithBypass('volunteer');
    db.demoEnabled = false;
    expect(auth.getBypassSession()).toBeNull();
    expect(auth.getBypassProfile()).toBeNull();
    expect(localStorage.getItem('bypass_profile')).toBeNull();
  });

  test('the expert email sign-in is not a demo session and keeps working', () => {
    db.demoEnabled = false;
    auth.signInWithApprovedEmail('expert', 'judge@example.com', 'Jo Judge');
    expect(auth.isDemoSession()).toBe(false);
    expect(auth.getBypassProfile()?.role).toBe('expert');
  });
});
