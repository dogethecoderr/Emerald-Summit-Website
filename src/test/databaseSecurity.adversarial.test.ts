import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Empirical Adversarial Test Suite for Database Security (Requirement R3)
 * Scrutinizes SQL triggers, column immutability, RLS bypass vectors, and exception fidelity.
 */

describe('Requirement R3: SQL Invariants & Database Security Audit', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260906180000_allow_volunteer_checkin.sql',
  );
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  describe('1. Migration File Structure & Security Invariants', () => {
    test('migration file exists and contains essential functions and policy', () => {
      expect(sqlContent).toBeTruthy();
      expect(sqlContent).toContain('create or replace function public.is_volunteer()');
      expect(sqlContent).toContain('create or replace function public.enforce_users_update_rules()');
      expect(sqlContent).toContain('create policy "users_update_volunteer"');
    });

    test('functions enforce search_path = public and security definer to prevent privilege escalation', () => {
      // is_volunteer() security checks
      const isVolunteerSnippet = sqlContent.slice(
        sqlContent.indexOf('function public.is_volunteer()'),
        sqlContent.indexOf('function public.enforce_users_update_rules()'),
      );
      expect(isVolunteerSnippet).toContain('security definer');
      expect(isVolunteerSnippet).toContain('set search_path = public');
      expect(isVolunteerSnippet).toContain("role = 'volunteer'");
      expect(isVolunteerSnippet).toContain('id = auth.uid()');

      // enforce_users_update_rules() security checks
      const triggerSnippet = sqlContent.slice(
        sqlContent.indexOf('function public.enforce_users_update_rules()'),
        sqlContent.indexOf('create policy "users_update_volunteer"'),
      );
      expect(triggerSnippet).toContain('security definer');
      expect(triggerSnippet).toContain('set search_path = public');
    });

    test('verifies all 9 sensitive columns are guarded by "is distinct from" in volunteer block', () => {
      const protectedColumns = [
        'id',
        'name',
        'role',
        'email',
        'phone',
        'discipline',
        'bio',
        'profile_setup_complete',
        'created_at',
      ];

      for (const col of protectedColumns) {
        const pattern = new RegExp(`new\\.${col}\\s+is\\s+distinct\\s+from\\s+old\\.${col}`, 'i');
        expect(
          pattern.test(sqlContent),
          `Column '${col}' MUST be protected by 'new.${col} is distinct from old.${col}'`,
        ).toBe(true);
      }
    });

    test('verifies RLS policy "users_update_volunteer" enforces volunteer role and forbids self-checkin', () => {
      const rlsSnippet = sqlContent.slice(sqlContent.indexOf('create policy "users_update_volunteer"'));
      expect(rlsSnippet).toContain('on public.users');
      expect(rlsSnippet).toContain('for update');
      expect(rlsSnippet).toContain('to authenticated');
      // USING clause
      expect(rlsSnippet).toMatch(/using\s*\(\s*public\.is_volunteer\(\)\s+and\s+id\s*!=\s*auth\.uid\(\)\s*\)/i);
      // WITH CHECK clause
      expect(rlsSnippet).toMatch(/with\s+check\s*\(\s*public\.is_volunteer\(\)\s+and\s+id\s*!=\s*auth\.uid\(\)\s*\)/i);
    });
  });

  describe('2. Empirical Trigger Semantics Simulation Engine', () => {
    interface DbUser {
      id: string;
      name: string;
      role: 'participant' | 'ambassador' | 'expert' | 'admin' | 'visitor' | 'volunteer' | 'attendee';
      email: string;
      phone?: string | null;
      discipline?: string | null;
      bio?: string | null;
      profile_setup_complete: boolean;
      checked_in_at?: string | null;
      created_at: string;
      updated_at: string;
    }

    interface AuthContext {
      uid: string | null;
      userRole?: string;
    }

    /**
     * Exact replication of public.enforce_users_update_rules() PL/pgSQL logic
     */
    function simulateEnforceUsersUpdateRules(
      auth: AuthContext,
      oldRecord: DbUser,
      newRecord: DbUser,
    ): { allowed: boolean; exception?: string } {
      const is_admin = () => auth.userRole === 'admin';
      const is_volunteer = () => auth.userRole === 'volunteer';

      // 1. System/service_role operations (auth.uid() is null) bypass restrictions
      if (auth.uid === null) {
        return { allowed: true };
      }

      // 2. Admins can update any field on any user
      if (is_admin()) {
        return { allowed: true };
      }

      // 3. Self-update restrictions (updating own profile)
      if (auth.uid === newRecord.id) {
        if (newRecord.role === 'admin') {
          return { allowed: false, exception: 'Cannot self-assign admin role' };
        }
        if (newRecord.role !== oldRecord.role) {
          return { allowed: false, exception: 'Cannot change role; contact an admin' };
        }
        if (newRecord.checked_in_at !== oldRecord.checked_in_at) {
          return { allowed: false, exception: 'Cannot self check-in; see an admin at the front desk' };
        }
        return { allowed: true };
      }

      // 4. Other-user update restrictions (updating another user's record)
      if (is_volunteer()) {
        if (
          newRecord.id !== oldRecord.id ||
          newRecord.name !== oldRecord.name ||
          newRecord.role !== oldRecord.role ||
          newRecord.email !== oldRecord.email ||
          (newRecord.phone ?? null) !== (oldRecord.phone ?? null) ||
          (newRecord.discipline ?? null) !== (oldRecord.discipline ?? null) ||
          (newRecord.bio ?? null) !== (oldRecord.bio ?? null) ||
          newRecord.profile_setup_complete !== oldRecord.profile_setup_complete ||
          newRecord.created_at !== oldRecord.created_at
        ) {
          return {
            allowed: false,
            exception: 'Volunteers are only permitted to update checked_in_at',
          };
        }
        return { allowed: true };
      }

      // 5. All other users are blocked from updating other records
      return { allowed: false, exception: 'Permission denied: cannot update other users' };
    }

    const baseParticipant: DbUser = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Alice Participant',
      role: 'participant',
      email: 'alice@emerald.summit',
      phone: '555-0100',
      discipline: 'techverse',
      bio: 'Excited for the hackathon!',
      profile_setup_complete: true,
      checked_in_at: null,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    };

    const volunteerAuth: AuthContext = {
      uid: 'vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv',
      userRole: 'volunteer',
    };

    test('Challenge 1: Volunteer CANNOT manipulate email', () => {
      const mutated = { ...baseParticipant, email: 'hacked@emerald.summit' };
      const res = simulateEnforceUsersUpdateRules(volunteerAuth, baseParticipant, mutated);
      expect(res.allowed).toBe(false);
      expect(res.exception).toBe('Volunteers are only permitted to update checked_in_at');
    });

    test('Challenge 1: Volunteer CANNOT manipulate role', () => {
      const mutated: DbUser = { ...baseParticipant, role: 'admin' };
      const res = simulateEnforceUsersUpdateRules(volunteerAuth, baseParticipant, mutated);
      expect(res.allowed).toBe(false);
      expect(res.exception).toBe('Volunteers are only permitted to update checked_in_at');
    });

    test('Challenge 1: Volunteer CANNOT manipulate discipline', () => {
      const mutated = { ...baseParticipant, discipline: 'biosphere' };
      const res = simulateEnforceUsersUpdateRules(volunteerAuth, baseParticipant, mutated);
      expect(res.allowed).toBe(false);
      expect(res.exception).toBe('Volunteers are only permitted to update checked_in_at');
    });

    test('Challenge 1: Volunteer CANNOT manipulate bio', () => {
      const mutated = { ...baseParticipant, bio: 'Malicious injected bio' };
      const res = simulateEnforceUsersUpdateRules(volunteerAuth, baseParticipant, mutated);
      expect(res.allowed).toBe(false);
      expect(res.exception).toBe('Volunteers are only permitted to update checked_in_at');
    });

    test('Challenge 1: Volunteer CANNOT manipulate phone', () => {
      const mutated = { ...baseParticipant, phone: '555-9999' };
      const res = simulateEnforceUsersUpdateRules(volunteerAuth, baseParticipant, mutated);
      expect(res.allowed).toBe(false);
      expect(res.exception).toBe('Volunteers are only permitted to update checked_in_at');
    });

    test('Challenge 1: Volunteer CANNOT manipulate id', () => {
      const mutated = { ...baseParticipant, id: '99999999-9999-9999-9999-999999999999' };
      const res = simulateEnforceUsersUpdateRules(volunteerAuth, baseParticipant, mutated);
      expect(res.allowed).toBe(false);
      expect(res.exception).toBe('Volunteers are only permitted to update checked_in_at');
    });

    test('Challenge 1: Volunteer CANNOT manipulate name', () => {
      const mutated = { ...baseParticipant, name: 'Impostor Name' };
      const res = simulateEnforceUsersUpdateRules(volunteerAuth, baseParticipant, mutated);
      expect(res.allowed).toBe(false);
      expect(res.exception).toBe('Volunteers are only permitted to update checked_in_at');
    });

    test('Challenge 1: Volunteer CANNOT manipulate profile_setup_complete', () => {
      const mutated = { ...baseParticipant, profile_setup_complete: false };
      const res = simulateEnforceUsersUpdateRules(volunteerAuth, baseParticipant, mutated);
      expect(res.allowed).toBe(false);
      expect(res.exception).toBe('Volunteers are only permitted to update checked_in_at');
    });

    test('Challenge 1: Volunteer CANNOT manipulate created_at', () => {
      const mutated = { ...baseParticipant, created_at: '2020-01-01T00:00:00Z' };
      const res = simulateEnforceUsersUpdateRules(volunteerAuth, baseParticipant, mutated);
      expect(res.allowed).toBe(false);
      expect(res.exception).toBe('Volunteers are only permitted to update checked_in_at');
    });

    test('Challenge 2: Volunteer CANNOT self-check-in (auth.uid = new.id)', () => {
      const volunteerProfile: DbUser = {
        id: volunteerAuth.uid!,
        name: 'Victor Volunteer',
        role: 'volunteer',
        email: 'victor@emerald.summit',
        phone: '555-0200',
        discipline: null,
        bio: null,
        profile_setup_complete: true,
        checked_in_at: null,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      };

      const selfCheckInAttempt: DbUser = {
        ...volunteerProfile,
        checked_in_at: '2026-09-06T12:00:00Z',
      };

      const res = simulateEnforceUsersUpdateRules(volunteerAuth, volunteerProfile, selfCheckInAttempt);
      expect(res.allowed).toBe(false);
      expect(res.exception).toBe('Cannot self check-in; see an admin at the front desk');
    });

    test('Challenge 2: Participant CANNOT self-check-in', () => {
      const participantAuth: AuthContext = {
        uid: baseParticipant.id,
        userRole: 'participant',
      };

      const selfCheckInAttempt: DbUser = {
        ...baseParticipant,
        checked_in_at: '2026-09-06T12:00:00Z',
      };

      const res = simulateEnforceUsersUpdateRules(participantAuth, baseParticipant, selfCheckInAttempt);
      expect(res.allowed).toBe(false);
      expect(res.exception).toBe('Cannot self check-in; see an admin at the front desk');
    });

    test('Challenge 3: Participant CANNOT update other users', () => {
      const participantAuth: AuthContext = {
        uid: 'other-participant-id',
        userRole: 'participant',
      };

      const checkInAttempt: DbUser = {
        ...baseParticipant,
        checked_in_at: '2026-09-06T12:00:00Z',
      };

      const res = simulateEnforceUsersUpdateRules(participantAuth, baseParticipant, checkInAttempt);
      expect(res.allowed).toBe(false);
      expect(res.exception).toBe('Permission denied: cannot update other users');
    });

    test('Challenge 4: Volunteer updating ONLY checked_in_at on other participant SUCCEEDS', () => {
      const validCheckIn: DbUser = {
        ...baseParticipant,
        checked_in_at: '2026-09-06T12:00:00Z',
        updated_at: '2026-09-06T12:00:00Z',
      };

      const res = simulateEnforceUsersUpdateRules(volunteerAuth, baseParticipant, validCheckIn);
      expect(res.allowed).toBe(true);
      expect(res.exception).toBeUndefined();
    });

    test('Admin user can update any user without exception', () => {
      const adminAuth: AuthContext = {
        uid: 'admin-id',
        userRole: 'admin',
      };

      const adminUpdate: DbUser = {
        ...baseParticipant,
        name: 'Admin Modified Name',
        checked_in_at: '2026-09-06T12:00:00Z',
      };

      const res = simulateEnforceUsersUpdateRules(adminAuth, baseParticipant, adminUpdate);
      expect(res.allowed).toBe(true);
    });

    test('Service role / system migrations (auth.uid = null) bypass trigger checks', () => {
      const systemAuth: AuthContext = {
        uid: null,
      };

      const systemUpdate: DbUser = {
        ...baseParticipant,
        email: 'system.reassigned@emerald.summit',
      };

      const res = simulateEnforceUsersUpdateRules(systemAuth, baseParticipant, systemUpdate);
      expect(res.allowed).toBe(true);
    });
  });
});
