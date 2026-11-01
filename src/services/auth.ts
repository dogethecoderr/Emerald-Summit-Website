import { supabase } from '../lib/supabase';
import type { Person, Visibility } from '../models/people';
import type { PersonStatus } from '../models/personStatus';
import type { User } from '@supabase/supabase-js';
import { isDemoModeEnabled } from '../lib/demoMode';
import { requiresApproval } from '../models/approvalSurveys';
import { SIGN_IN_ROLES, notEligibleMessage } from '../models/roles';

export type Profile = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  phone?: string;
  discipline?: string | null;
  bio?: string;
  profile_setup_complete: boolean;
  org?: string;
  directory_visible?: boolean;
  email_visible?: Visibility;
  phone_visible?: Visibility;
  bio_visible?: Visibility;
  created_at?: string;
  updated_at?: string;
  checked_in_at?: string;
  // Set from the Allowed Volunteers sheet by the users_role_allowlist trigger
  // (README: Volunteer and admin allowlist). The client never writes these.
  volunteer_subtype?: VolunteerSubtype | null;
  /** Discipline ids this volunteer manages; ['*'] means every discipline. */
  managed_disciplines?: string[];
  can_edit_sessions?: boolean;
  can_post_announcements?: boolean;
  can_check_in_front_desk?: boolean;
};

/** What a student adds at registration, beyond the basic profile. */
export interface RegistrationDetails {
  grade?: number | null;
  school?: string;
  teamName?: string;
  teammates?: string[];
  projectTitle?: string;
  projectOverview?: string;
  track?: string | null;
}

/** A row of public.student_registrations (20261101120000_student_registrations.sql). */
interface RegistrationRow {
  grade: number | null;
  school: string | null;
  team_name: string | null;
  /** The other people on the team; empty when competing solo. */
  teammates: string[];
  /** Planned track within users.discipline. Reserves no sessions. */
  track: string | null;
  project_title: string | null;
  project_overview: string | null;
}

const DEMO_REGISTRATION_KEY = 'bypass_registration';

/**
 * PostgREST's answer for a table it doesn't know (PGRST205), or Postgres's
 * (42P01): the student_registrations migration hasn't run yet.
 */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

function registrationFromRow(row: RegistrationRow): RegistrationDetails {
  return {
    grade: row.grade,
    school: row.school ?? undefined,
    teamName: row.team_name ?? undefined,
    teammates: row.teammates ?? [],
    track: row.track,
    projectTitle: row.project_title ?? undefined,
    projectOverview: row.project_overview ?? undefined,
  };
}

function registrationColumns(details: RegistrationDetails): RegistrationRow {
  return {
    grade: details.grade ?? null,
    school: details.school?.trim() || null,
    team_name: details.teamName?.trim() || null,
    teammates: (details.teammates ?? []).map((n) => n.trim()).filter(Boolean),
    project_title: details.projectTitle?.trim() || null,
    project_overview: details.projectOverview?.trim() || null,
    track: details.track || null,
  };
}

export type VolunteerSubtype = 'eaf_ambassador' | 'student_volunteer' | 'parent_volunteer';

export interface ProfileSettings {
  org: string;
  directoryVisible: boolean;
  emailVisible: Visibility;
  phoneVisible: Visibility;
  bioVisible: Visibility;
}

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  org: 'Emerald High School',
  directoryVisible: true,
  emailVisible: 'private',
  phoneVisible: 'private',
  bioVisible: 'private',
};

const PENDING_ROLE_KEY = 'pending_user_role';

/** Every real-auth path needs a configured client; bypass never does. */
function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_ANON_KEY, or use bypass sign-in.',
    );
  }
  return supabase;
}

/** Roles the Google Sheets allowlist decides (see role_allowlist in README). */
const GATED_ROLES = ['volunteer', 'ambassador', 'admin'];

/** Roles a Google sign-in may ask for. Experts sign in by email instead. */
const GOOGLE_SIGN_IN_ROLES = SIGN_IN_ROLES.map((r) => r.name).filter(
  (name) => !requiresApproval(name),
);

const LOAD_FAILED_MESSAGE = "We couldn't load your account. Try signing in again.";

/**
 * A sign-in that must not continue: the role was refused, or the account
 * couldn't be loaded. AuthContext signs out and shows `message`; the person
 * is never left signed in under some other role.
 */
export class SignInRefusedError extends Error {
  constructor(
    message: string,
    readonly role: string | null = null,
  ) {
    super(message);
    this.name = 'SignInRefusedError';
  }
}

function refused(roleName: string): SignInRefusedError {
  return new SignInRefusedError(notEligibleMessage(roleName), roleName);
}

export function savePendingRole(roleName: string): void {
  localStorage.setItem(PENDING_ROLE_KEY, roleName);
}

export function takePendingRole(): string | null {
  const value = localStorage.getItem(PENDING_ROLE_KEY);
  if (value == null) return null;
  localStorage.removeItem(PENDING_ROLE_KEY);
  return value;
}

/**
 * Whether the signed-in email is on the sheet for a gated role. RLS lets a
 * user read only their own role_allowlist rows.
 */
async function isOnAllowlist(roleName: string): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from('role_allowlist')
    .select('role, subtype')
    .eq('role', roleName === 'admin' ? 'admin' : 'volunteer');
  if (error) throw new SignInRefusedError(LOAD_FAILED_MESSAGE);
  const rows = (data ?? []) as { role: string; subtype: string | null }[];
  if (roleName === 'ambassador') {
    return rows.some((r) => r.subtype === 'eaf_ambassador');
  }
  return rows.length > 0;
}

// AuthContext asks twice on load (getSession and onAuthStateChange). Both
// share one request, so only one of them consumes the pending role; before,
// the second could create the account as a participant.
const inFlight = new Map<string, Promise<Profile>>();

/**
 * Loads the signed-in user's public.users row, creating it on first sign-in,
 * and moves it to the role picked on the login page. Throws
 * SignInRefusedError when that role isn't allowed or the row can't be read.
 */
export function getCurrentProfile(user: User): Promise<Profile> {
  const pending = inFlight.get(user.id);
  if (pending) return pending;
  const request = loadProfile(user).finally(() => inFlight.delete(user.id));
  inFlight.set(user.id, request);
  return request;
}

async function loadProfile(user: User): Promise<Profile> {
  const requested = takePendingRole();
  if (requested && !GOOGLE_SIGN_IN_ROLES.includes(requested)) {
    throw refused(requested);
  }

  const { data, error } = await requireSupabase()
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    console.error('Failed to fetch user profile', error);
    throw new SignInRefusedError(LOAD_FAILED_MESSAGE);
  }

  let row = data as Profile | null;

  if (!row) {
    // First sign-in. The role_allowlist trigger would quietly turn a gated
    // role into participant, so check the sheet first and create nothing
    // for a refused role.
    const role = requested ?? 'participant';
    if (GATED_ROLES.includes(role) && !(await isOnAllowlist(role))) {
      throw refused(role);
    }
    const { data: inserted, error: insertError } = await requireSupabase()
      .from('users')
      .insert({
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.full_name || 'New User',
        role,
        profile_setup_complete: false,
      })
      .select('*')
      .single();
    if (insertError || !inserted) {
      console.error('Failed to create user profile', insertError);
      throw new SignInRefusedError(LOAD_FAILED_MESSAGE);
    }
    row = inserted as Profile;
  } else if (requested && row.role !== requested) {
    // An existing account signing in with a different role: ask the server to
    // switch. enforce_users_update_rules allows participant/attendee for anyone
    // and volunteer/ambassador/admin only for emails on that Google Sheet; it
    // refuses anything else with 42501.
    const { data: updated, error: updateError } = await requireSupabase()
      .from('users')
      .update({ role: requested })
      .eq('id', user.id)
      .select('*')
      .single();
    if (updateError && updateError.code !== '42501') {
      console.error('Failed to switch role', updateError);
      throw new SignInRefusedError(LOAD_FAILED_MESSAGE);
    }
    if (updated) row = updated as Profile;
  }

  // Whatever the server kept must be the role that was asked for.
  if (requested && row.role !== requested) throw refused(requested);
  return row;
}

const DEMO_EMAIL = 'bypass@example.com';

export function getBypassSession(): any | null {
  const raw = localStorage.getItem('bypass_session');
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    // A demo session left over from a dev build doesn't carry into a build
    // where demo mode is off.
    if (session?.demo && !isDemoModeEnabled) {
      clearBypass();
      return null;
    }
    return session;
  } catch {
    clearBypass();
    return null;
  }
}

export function getBypassProfile(): Profile | null {
  if (!getBypassSession()) return null;
  const raw = localStorage.getItem('bypass_profile');
  return raw ? JSON.parse(raw) as Profile : null;
}

/** True for a demo-mode session (not the expert email sign-in). */
export function isDemoSession(): boolean {
  return getBypassSession()?.demo === true;
}

/**
 * Demo sign-in: a local session that never reaches the database. It starts
 * at profile setup like a real first sign-in, where Skip moves on.
 */
export function signInWithBypass(roleName: string): void {
  if (!isDemoModeEnabled) {
    throw new Error('Demo mode is off in this build.');
  }
  startLocalSession(
    roleName,
    DEMO_EMAIL,
    `Bypass ${roleName.charAt(0).toUpperCase() + roleName.slice(1)}`,
    true,
  );
}

/**
 * Prototype sign-in for roles gated by the approvals sheet (expert,
 * volunteer): the caller has just confirmed this email is Approved there.
 * Reuses the local bypass session, so nothing else needs to know about it.
 */
export function signInWithApprovedEmail(
  roleName: string,
  email: string,
  name: string,
): void {
  startLocalSession(roleName, email, name || email, false);
}

function startLocalSession(
  roleName: string,
  email: string,
  name: string,
  demo: boolean,
): void {
  // One role at a time: a local session replaces any Google session.
  void supabase?.auth.signOut();
  localStorage.removeItem(PENDING_ROLE_KEY);
  const session = {
    demo,
    user: {
      id: 'bypass_user_id',
      email,
      user_metadata: { full_name: name },
    },
  };
  const profile: Profile = {
    id: 'bypass_user_id',
    email,
    name,
    role: roleName,
    profile_setup_complete: !demo,
    // The local demo never reaches the sheets, so a demo volunteer gets every
    // sheet permission to show all of the Volunteer Hub. These only drive this
    // browser's UI: with no Supabase session, RLS refuses every write.
    ...(roleName === 'volunteer'
      ? {
          volunteer_subtype: 'student_volunteer' as const,
          managed_disciplines: ['*'],
          can_edit_sessions: true,
          can_post_announcements: true,
          can_check_in_front_desk: true,
        }
      : {}),
  };
  localStorage.setItem('bypass_session', JSON.stringify(session));
  localStorage.setItem('bypass_profile', JSON.stringify(profile));
  
  // Emit storage event to trigger AuthContext refresh
  window.dispatchEvent(new Event('storage'));
}

/**
 * Finishes (or skips) profile setup for a demo session. Only the profile in
 * this browser changes; nothing is registered.
 */
export function completeDemoProfile(input?: SaveProfileInput): void {
  const profile = getBypassProfile();
  if (!profile || !isDemoSession()) return;
  const next: Profile = {
    ...profile,
    ...(input?.name ? { name: input.name } : {}),
    ...(input?.phone ? { phone: input.phone } : {}),
    ...(input?.discipline ? { discipline: input.discipline } : {}),
    ...(input?.bio ? { bio: input.bio } : {}),
    profile_setup_complete: true,
  };
  localStorage.setItem('bypass_profile', JSON.stringify(next));
  if (input?.registration) {
    localStorage.setItem(
      DEMO_REGISTRATION_KEY,
      JSON.stringify(registrationColumns(input.registration)),
    );
  }
  window.dispatchEvent(new Event('storage'));
}

export function clearBypass(): void {
  localStorage.removeItem('bypass_session');
  localStorage.removeItem('bypass_profile');
  localStorage.removeItem(DEMO_REGISTRATION_KEY);
}

/** Profile writes go to the database only for a real Google session. */
async function requireRealSession() {
  if (getBypassSession()) {
    throw new Error('Local sign-in: nothing is saved to the Summit database.');
  }
  const { data: { session } } = await requireSupabase().auth.getSession();
  if (!session) throw new Error('Not signed in.');
  return session;
}

export async function signInWithGoogle(roleName: string): Promise<void> {
  // One role at a time: the Google sign-in replaces any demo/local session,
  // and on return the account moves to this role (see getCurrentProfile).
  clearBypass();
  savePendingRole(roleName);
  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/home',
    },
  });
  if (error) throw error;
}

export async function signInWithLinkedIn(roleName: string): Promise<void> {
  savePendingRole(roleName);
  // Not implemented in DB by default, but left for compatibility
  throw new Error('LinkedIn login is currently not supported with the real backend.');
}

export interface SaveProfileInput {
  name: string;
  phone?: string;
  discipline?: string | null;
  bio?: string;
  org?: string;
  directoryVisible?: boolean;
  emailVisible?: Visibility;
  phoneVisible?: Visibility;
  bioVisible?: Visibility;
  /** Participants' team and project steps. */
  registration?: RegistrationDetails;
}

export async function saveProfile(input: SaveProfileInput): Promise<void> {
  const session = await requireRealSession();

  const updatePayload: any = {
    name: input.name,
    profile_setup_complete: true,
  };
  
  if (input.phone) updatePayload.phone = input.phone;
  if (input.discipline) updatePayload.discipline = input.discipline;
  if (input.bio) updatePayload.bio = input.bio;

  // Team, track, and project go in their own table, which only the student
  // and admins can read. Until its migration runs, finishing setup must not
  // depend on it.
  if (input.registration) {
    const { error } = await requireSupabase()
      .from('student_registrations')
      .upsert({ user_id: session.user.id, ...registrationColumns(input.registration) });
    if (error && !isMissingTable(error)) throw error;
    if (error) {
      console.warn('Registration details not saved: run the student_registrations migration.', error);
    }
  }

  const { error } = await requireSupabase()
    .from('users')
    .update(updatePayload)
    .eq('id', session.user.id);
    
  if (error) throw error;
}

/**
 * The signed-in student's registration details, to prefill profile setup:
 * from this browser for a demo session, else from student_registrations.
 */
export async function getRegistration(): Promise<RegistrationDetails | null> {
  if (getBypassSession()) {
    const raw = localStorage.getItem(DEMO_REGISTRATION_KEY);
    return raw ? registrationFromRow(JSON.parse(raw) as RegistrationRow) : null;
  }
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('student_registrations')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error) {
    if (!isMissingTable(error)) console.error('Failed to load registration', error);
    return null;
  }
  return data ? registrationFromRow(data as RegistrationRow) : null;
}

export function needsProfileSetup(profile: Profile | null): boolean {
  if (profile == null) return true;
  return profile.profile_setup_complete !== true;
}

export async function updateProfileSettings(
  input: Partial<SaveProfileInput>,
): Promise<void> {
  const session = await requireRealSession();

  const payload: any = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.phone !== undefined) payload.phone = input.phone;
  if (input.discipline !== undefined) payload.discipline = input.discipline;
  if (input.bio !== undefined) payload.bio = input.bio;

  const { error } = await requireSupabase()
    .from('users')
    .update(payload)
    .eq('id', session.user.id);

  if (error) throw error;
}

export async function signOut(): Promise<void> {
  // Optional: with no client configured there is nothing but bypass to clear.
  await supabase?.auth.signOut();
  clearBypass();
  localStorage.removeItem(PENDING_ROLE_KEY);
}

function settingsFromProfile(profile: Profile | null | undefined): ProfileSettings {
  return {
    org:
      (profile?.org as string | undefined)?.trim() ||
      DEFAULT_PROFILE_SETTINGS.org,
    directoryVisible:
      profile?.directory_visible !== false,
    emailVisible:
      (profile?.email_visible as Visibility | undefined) ??
      DEFAULT_PROFILE_SETTINGS.emailVisible,
    phoneVisible:
      (profile?.phone_visible as Visibility | undefined) ??
      DEFAULT_PROFILE_SETTINGS.phoneVisible,
    bioVisible:
      (profile?.bio_visible as Visibility | undefined) ??
      DEFAULT_PROFILE_SETTINGS.bioVisible,
  };
}

export function getProfileSettings(
  profile: Profile | null | undefined,
): ProfileSettings {
  return settingsFromProfile(profile);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function profileToPerson(profile: Profile): Person {
  const settings = getProfileSettings(profile);
  const roleName = (profile.role as string | undefined) ?? 'participant';
  const name = (profile.name as string | undefined) ?? 'Summit User';
  const email = (profile.email as string | undefined) ?? '';
  const phone = (profile.phone as string | undefined) ?? '';
  const bio = (profile.bio as string | undefined) ?? '';

  return {
    id: (profile.id as string | undefined) ?? email,
    name,
    role: roleName,
    org: settings.org,
    email,
    phone,
    initials: getInitials(name),
    bio,
    emailVisible: settings.emailVisible,
    phoneVisible: settings.phoneVisible,
    bioVisible: settings.bioVisible,
    status: 'validated' as PersonStatus,
  };
}
