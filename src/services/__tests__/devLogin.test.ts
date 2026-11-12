import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

// Test accounts sign in through the shared dev-login function, the same way
// the app does: check first, then the password returns an OTP to verify.
const { db, backend } = vi.hoisted(() => {
  const db = {
    devLogin: true,
    profiles: [] as Record<string, any>[],
    allowlist: [] as { email: string; role: string }[],
    updates: [] as Record<string, any>[],
    invoke: null as null | ((body: any) => { data: any; error: any }),
  };
  const clone = (value: Record<string, any>) => JSON.parse(JSON.stringify(value));
  const from = (table: string) => {
    let payload: Record<string, any> | null = null;
    const filters: [string, unknown][] = [];
    const run = async () => {
      if (table === 'role_allowlist') {
        const row = db.allowlist.find((r) => filters.every(([k, v]) => (r as any)[k] === v));
        return { data: row ?? null, error: null };
      }
      if (table !== 'profiles') throw new Error(`Unexpected table: ${table}`);
      const row = db.profiles.find((p) => filters.every(([k, v]) => p[k] === v));
      if (payload) {
        db.updates.push(clone(payload));
        Object.assign(row!, payload);
        // The server trigger sets the subtype from the sheet.
        if (row!.role === 'volunteer') row!.volunteer_subtype = 'eaf_ambassador';
        return { data: clone(row!), error: null };
      }
      return { data: row ? clone(row) : null, error: null };
    };
    const builder: any = {
      select: () => builder,
      update: (input: Record<string, any>) => { payload = input; return builder; },
      eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
      single: run,
      maybeSingle: run,
    };
    return builder;
  };
  const backend = {
    from,
    rpc: vi.fn(async () => ({ data: [], error: null })),
    functions: {
      invoke: vi.fn(async (_name: string, options: { body: any }) => db.invoke!(options.body)),
    },
    auth: {
      verifyOtp: vi.fn(async (_input: unknown) => ({ error: null })),
      signInWithOtp: vi.fn(async (_input: unknown) => ({ error: null })),
    },
  };
  return { db, backend };
});
vi.mock('../../lib/supabase', () => ({ supabase: backend, isSupabaseConfigured: true }));
vi.mock('../../lib/devLogin', () => ({ get isDevLoginEnabled() { return db.devLogin; } }));

const auth = await import('../auth');

const httpError = (status: number) => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { status } } });
const userFor = (email: string) => ({ id: 'user-1', email } as unknown as User);
const freshProfile = (email: string) => ({
  id: 'user-1', email, full_name: '', role: 'participant', onboarded: false, details: {},
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  db.devLogin = true;
  db.allowlist = [];
  db.updates = [];
  db.invoke = () => ({ data: { test: false }, error: null });
  auth.takeTestAccountNotice();
});

describe('test account check', () => {
  test('never asks the function when the switch is off', async () => {
    db.devLogin = false;
    expect(await auth.isTestAccount('admin@test.example')).toBe(false);
    expect(backend.functions.invoke).not.toHaveBeenCalled();
  });

  test('asks with check: true and a lowercased email', async () => {
    db.invoke = () => ({ data: { test: true }, error: null });
    expect(await auth.isTestAccount(' Admin@Test.Example ')).toBe(true);
    expect(backend.functions.invoke).toHaveBeenCalledWith('dev-login', { body: { email: 'admin@test.example', check: true } });
  });

  test('a function error means a normal emailed code', async () => {
    db.invoke = () => httpError(500);
    expect(await auth.isTestAccount('someone@example.com')).toBe(false);
  });
});

describe('test account sign-in', () => {
  test('wrong password and a turned-off server use the app messages', async () => {
    db.invoke = () => httpError(401);
    await expect(auth.signInWithTestAccount('a@test.example', 'nope')).rejects.toThrow('Wrong email or password.');
    db.invoke = () => httpError(403);
    await expect(auth.signInWithTestAccount('a@test.example', 'pw')).rejects.toThrow('Test accounts are turned off on this server.');
    expect(backend.auth.verifyOtp).not.toHaveBeenCalled();
  });

  test('finishes with the returned OTP and never stores the password', async () => {
    db.invoke = () => ({ data: { otp: '123456', type: 'magiclink' }, error: null });
    await auth.signInWithTestAccount('Admin@Test.Example', 'shared-secret');
    expect(backend.auth.verifyOtp).toHaveBeenCalledWith({ email: 'admin@test.example', token: '123456', type: 'magiclink' });
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain('shared-secret');
  });

  test('refuses when the switch is off', async () => {
    db.devLogin = false;
    await expect(auth.signInWithTestAccount('a@test.example', 'pw')).rejects.toThrow('Test accounts are off in this build.');
  });

  test('five wrong passwords lock this browser out for 15 minutes without asking the function', async () => {
    db.invoke = () => httpError(401);
    for (let i = 1; i < auth.TEST_SIGN_IN_MAX_FAILURES; i++) {
      await expect(auth.signInWithTestAccount('a@test.example', `guess${i}`)).rejects.toThrow('Wrong email or password.');
    }
    await expect(auth.signInWithTestAccount('a@test.example', 'guess5')).rejects.toThrow('Too many wrong passwords. Try again in 15 minutes.');
    expect(auth.testSignInLockedUntil()).not.toBeNull();

    const calls = backend.functions.invoke.mock.calls.length;
    db.invoke = () => ({ data: { otp: '123456', type: 'magiclink' }, error: null });
    await expect(auth.signInWithTestAccount('a@test.example', 'right-one')).rejects.toThrow('Too many wrong passwords.');
    expect(backend.functions.invoke.mock.calls.length).toBe(calls);
    expect(backend.auth.verifyOtp).not.toHaveBeenCalled();
  });

  test('the lock lifts after 15 minutes, and a right password resets the count', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      db.invoke = () => httpError(401);
      for (let i = 0; i < auth.TEST_SIGN_IN_MAX_FAILURES; i++) {
        await auth.signInWithTestAccount('a@test.example', 'x').catch(() => {});
      }
      expect(auth.testSignInLockedUntil()).not.toBeNull();
      vi.setSystemTime(Date.now() + auth.TEST_SIGN_IN_LOCK_MS + 1000);
      expect(auth.testSignInLockedUntil()).toBeNull();

      await auth.signInWithTestAccount('a@test.example', 'x').catch(() => {});
      db.invoke = () => ({ data: { otp: '123456', type: 'magiclink' }, error: null });
      await auth.signInWithTestAccount('a@test.example', 'right-one');
      // The earlier miss no longer counts: four more misses still don't lock.
      db.invoke = () => httpError(401);
      for (let i = 1; i < auth.TEST_SIGN_IN_MAX_FAILURES; i++) {
        await expect(auth.signInWithTestAccount('a@test.example', 'x')).rejects.toThrow('Wrong email or password.');
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('test account onboarding', () => {
  const signIn = async (email: string) => {
    db.invoke = () => ({ data: { otp: '123456', type: 'email' }, error: null });
    await auth.signInWithTestAccount(email, 'pw');
    return auth.getCurrentProfile(userFor(email));
  };

  test('an allowlisted volunteer skips the picker and the page role is ignored', async () => {
    db.profiles = [freshProfile('vol@test.example')];
    db.allowlist = [{ email: 'vol@test.example', role: 'volunteer' }];
    auth.savePendingRole('participant');
    const profile = await signIn('vol@test.example');
    expect(db.updates[0]).toMatchObject({ role: 'volunteer', onboarded: true, full_name: 'vol' });
    expect(profile.role).toBe('volunteer');
    expect(profile.profile_setup_complete).toBe(true);
    expect(auth.takeTestAccountNotice()).toBe(
      'Testing account: you were given the Volunteer · EAF Ambassador role automatically, so there is no role picker.',
    );
    expect(localStorage.getItem('pending_user_role')).toBeNull();
  });

  test('admin wins over volunteer; open roles come from the email', async () => {
    db.profiles = [freshProfile('lead@test.example')];
    db.allowlist = [{ email: 'lead@test.example', role: 'volunteer' }, { email: 'lead@test.example', role: 'admin' }];
    expect((await signIn('lead@test.example')).role).toBe('admin');

    db.updates = [];
    db.allowlist = [];
    db.profiles = [freshProfile('parent-1@test.example')];
    expect((await signIn('parent-1@test.example')).role).toBe('attendee');
    expect(db.updates[0].role).toBe('parentSpectator');

    db.profiles = [freshProfile('expert@test.example')];
    expect((await signIn('expert@test.example')).role).toBe('expert');
  });

  test('an already onboarded test account keeps its profile', async () => {
    db.profiles = [{ ...freshProfile('student@test.example'), full_name: 'Kept', onboarded: true, role: 'expert' }];
    const profile = await signIn('student@test.example');
    expect(db.updates).toHaveLength(0);
    expect(profile.role).toBe('expert');
    expect(auth.takeTestAccountNotice()).toBeNull();
  });

  test('a normal sign-in never auto-onboards', async () => {
    db.profiles = [freshProfile('plain@example.com')];
    await auth.getCurrentProfile(userFor('plain@example.com'));
    expect(db.updates).toHaveLength(0);
  });
});
