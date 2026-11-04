import { supabase } from '../lib/supabase';
import type { Person, Visibility } from '../models/people';
import type { PersonStatus } from '../models/personStatus';
import type { User } from '@supabase/supabase-js';
import { isDemoModeEnabled } from '../lib/demoMode';
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
  details?: Record<string, unknown>;
  expert_status?: string | null;
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

function registrationFromRow(row: RegistrationRow): RegistrationDetails {
  return {
    grade: row.grade == null ? null : Number(row.grade),
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
        'VITE_SUPABASE_PUBLISHABLE_KEY.',
    );
  }
  return supabase;
}

const GOOGLE_SIGN_IN_ROLES = SIGN_IN_ROLES.map((r) => r.name);

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

/** Map the shared mobile profile into the website's existing view model. */
export function profileFromRow(row: Record<string, any>): Profile {
  const details = row.details && typeof row.details === 'object' ? row.details : {};
  return {
    ...row,
    id: row.id,
    email: row.email ?? '',
    name: row.full_name ?? '',
    role: row.role === 'parentSpectator' ? 'attendee' : row.role,
    profile_setup_complete: row.onboarded === true,
    details,
    phone: details.phone ?? '',
    bio: details.bio ?? details.expertise ?? '',
    org: details.school ?? '',
    discipline: details.discipline ?? null,
  };
}

function storedRole(role: string): string {
  return role === 'attendee' ? 'parentSpectator' : role === 'ambassador' ? 'volunteer' : role;
}

// AuthContext asks twice on load (getSession and onAuthStateChange). Both
// share one request, so only one of them consumes the pending role; before,
// the second could create the account as a participant.
const inFlight = new Map<string, Promise<Profile>>();

/** Read the same server-owned profile as the mobile app. Never insert a second account. */
export function getCurrentProfile(user: User): Promise<Profile> {
  const pending = inFlight.get(user.id);
  if (pending) return pending;
  const request = loadProfile(user).finally(() => inFlight.delete(user.id));
  inFlight.set(user.id, request);
  return request;
}

async function loadProfile(user: User): Promise<Profile> {
  const requested = takePendingRole();
  if (requested && !GOOGLE_SIGN_IN_ROLES.includes(requested)) throw refused(requested);
  const client = requireSupabase();
  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error || !data) throw new SignInRefusedError(LOAD_FAILED_MESSAGE);
  let row = data;

  // A completed mobile profile must survive signing in from another role's page.
  // A role change needs the app's explicit preview/confirmation flow.
  if (!row.onboarded && requested && row.role !== storedRole(requested)) {
    const { data: updated, error: updateError } = await client.from('profiles')
      .update({ role: storedRole(requested) }).eq('id', user.id).select('*').single();
    if (updateError || !updated) throw new SignInRefusedError(LOAD_FAILED_MESSAGE);
    row = updated;
    if (row.role !== storedRole(requested)) throw refused(requested);
  }
  const profile = profileFromRow(row);
  const { data: checkins, error: checkinError } = await client.rpc('my_summit_checkin');
  if (!checkinError && checkins?.[0]?.present) profile.checked_in_at = checkins[0].checked_in_at;
  return profile;
}

const DEMO_EMAIL = 'bypass@example.com';

/** The user id every local (demo or expert email) session uses. */
export const BYPASS_USER_ID = 'bypass_user_id';

export function getBypassSession(): any | null {
  const raw = localStorage.getItem('bypass_session');
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    // A demo session left over from a dev build doesn't carry into a build
    // where demo mode is off.
    if (!isDemoModeEnabled) {
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
  if (!isDemoModeEnabled) throw new Error('Sign in with Google or an email code.');
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
      id: BYPASS_USER_ID,
      email,
      user_metadata: { full_name: name },
    },
  };
  const profile: Profile = {
    id: BYPASS_USER_ID,
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

export async function sendSignInCode(email: string, roleName: string): Promise<void> {
  clearBypass();
  savePendingRole(roleName);
  const { error } = await requireSupabase().auth.signInWithOtp({
    email, options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifySignInCode(email: string, token: string): Promise<void> {
  const { error } = await requireSupabase().auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
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

async function writeProfile(input: Partial<SaveProfileInput>, complete: boolean): Promise<void> {
  const session = await requireRealSession();
  const client = requireSupabase();
  const { data: current, error: readError } = await client.from('profiles').select('*')
    .eq('id', session.user.id).single();
  if (readError || !current) throw new Error(LOAD_FAILED_MESSAGE);
  const details = { ...(current.details ?? {}) };
  if (input.phone !== undefined) details.phone = input.phone;
  if (input.bio !== undefined) details.bio = input.bio;
  if (input.discipline !== undefined) details.discipline = input.discipline;
  if (input.org !== undefined) details.school = input.org;
  if (input.registration) {
    Object.assign(details, registrationColumns(input.registration));
    if (input.registration.grade != null) details.grade = String(input.registration.grade);
  }
  const payload: Record<string, unknown> = { details, updated_at: new Date().toISOString() };
  if (input.name !== undefined) payload.full_name = input.name;
  if (complete) payload.onboarded = true;
  const { data: updated, error } = await client.from('profiles').update(payload)
    .eq('id', session.user.id).select('*').single();
  if (error || !updated) throw error ?? new Error(LOAD_FAILED_MESSAGE);
}

export async function saveProfile(input: SaveProfileInput): Promise<void> {
  await writeProfile(input, true);
}

/** Prefill existing answers without maintaining a second registration database. */
export async function getRegistration(): Promise<RegistrationDetails | null> {
  if (getBypassSession()) {
    const raw = localStorage.getItem(DEMO_REGISTRATION_KEY);
    return raw ? registrationFromRow(JSON.parse(raw) as RegistrationRow) : null;
  }
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.from('profiles').select('details').eq('id', session.user.id).single();
  if (error) throw error;
  return data?.details ? registrationFromRow(data.details as RegistrationRow) : null;
}

export function needsProfileSetup(profile: Profile | null): boolean {
  if (profile == null) return true;
  return profile.profile_setup_complete !== true;
}

export async function updateProfileSettings(input: Partial<SaveProfileInput>): Promise<void> {
  await writeProfile(input, false);
}

export async function signOut(): Promise<void> {
  // A local (demo or expert) session ends first, and AuthContext is told at
  // once: Supabase's own SIGNED_OUT is ignored while a local session exists,
  // which used to leave a demo signed in until a second click.
  const hadLocal = getBypassSession() != null;
  clearBypass();
  localStorage.removeItem(PENDING_ROLE_KEY);
  if (hadLocal) window.dispatchEvent(new Event('storage'));
  // Optional: with no client configured there is nothing else to clear.
  await supabase?.auth.signOut();
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
