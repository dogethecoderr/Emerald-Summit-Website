import { supabase } from '../lib/supabase';
import type { Person, Visibility } from '../models/people';
import type { PersonStatus } from '../models/personStatus';
import type { User } from '@supabase/supabase-js';
import { isDevLoginEnabled } from '../lib/devLogin';
import { SIGN_IN_ROLES, VOLUNTEER_SUBTYPE_LABELS, notEligibleMessage, roleByName } from '../models/roles';

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

/** Every auth path needs a configured client. */
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

export function storedRole(role: string): string {
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
  const testAccount = takeTestAccountSignIn();
  // A test account gets its role from the allowlist or its email, not the page.
  const requested = testAccount ? null : takePendingRole();
  if (requested && !GOOGLE_SIGN_IN_ROLES.includes(requested)) throw refused(requested);
  const client = requireSupabase();
  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error || !data) throw new SignInRefusedError(LOAD_FAILED_MESSAGE);
  let row = data;

  if (testAccount && !row.onboarded) {
    row = await autoOnboardTestAccount(row);
  }

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

/**
 * Demo mode and the local expert sign-in are gone (the shared backend has
 * real test accounts instead). This drops what they left in a browser.
 */
function clearLegacyLocalSession(): void {
  for (const key of ['bypass_session', 'bypass_profile', 'bypass_registration']) {
    localStorage.removeItem(key);
  }
}
clearLegacyLocalSession();

/** Profile writes need a real Supabase session. */
async function requireRealSession() {
  const { data: { session } } = await requireSupabase().auth.getSession();
  if (!session) throw new Error('Not signed in.');
  return session;
}

export async function signInWithGoogle(roleName: string): Promise<void> {
  // On return the account moves to this role if it is new
  // (see getCurrentProfile).
  savePendingRole(roleName);
  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/home',
    },
  });
  if (error) throw error;
}

/**
 * A failed Google sign-in comes back with `error_description` in the query or
 * hash (for example a provider misconfiguration). Returns a message for the
 * roles page and removes the error from the address bar, so it isn't silently
 * dropped. Null when the URL has no error.
 */
export function takeOAuthError(): string | null {
  if (typeof window === 'undefined') return null;
  const { search, hash, pathname } = window.location;
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const raw = query.get('error_description') ?? fragment.get('error_description')
    ?? query.get('error') ?? fragment.get('error');
  if (!raw) return null;
  for (const key of ['error', 'error_code', 'error_description', 'sb']) query.delete(key);
  const rest = query.toString();
  window.history.replaceState(window.history.state, '', pathname + (rest ? `?${rest}` : ''));
  localStorage.removeItem(PENDING_ROLE_KEY);
  return `Google sign-in didn't finish (${raw.replace(/\+/g, ' ')}). Try again, or use your email.`;
}

export async function sendSignInCode(email: string, roleName: string): Promise<void> {
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

// ---------------------------------------------------------------------------
// Test accounts (the shared dev-login function, same flow as the app)
// ---------------------------------------------------------------------------

const TEST_ACCOUNT_KEY = 'test_account_sign_in';
const TEST_SIGN_IN_UNREACHABLE = 'Could not reach the test sign-in. Try again.';
let testAccountNotice: string | null = null;

function markTestAccountSignIn(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(TEST_ACCOUNT_KEY, '1');
    else sessionStorage.removeItem(TEST_ACCOUNT_KEY);
  } catch {
    // Storage blocked: the account still signs in, it just gets the role picker.
  }
}

function takeTestAccountSignIn(): boolean {
  try {
    const on = sessionStorage.getItem(TEST_ACCOUNT_KEY) === '1';
    sessionStorage.removeItem(TEST_ACCOUNT_KEY);
    return on;
  } catch {
    return false;
  }
}

/** The one-time "you were given the X role" note, read once after sign-in. */
export function takeTestAccountNotice(): string | null {
  const notice = testAccountNotice;
  testAccountNotice = null;
  return notice;
}

/**
 * True when this email is a test account, so the page asks for the shared
 * password instead of sending a code. Always false unless VITE_DEV_LOGIN is
 * on; any failure means a normal code.
 */
export async function isTestAccount(email: string): Promise<boolean> {
  if (!isDevLoginEnabled || !supabase) return false;
  try {
    const { data, error } = await supabase.functions.invoke('dev-login', {
      body: { email: email.trim().toLowerCase(), check: true },
    });
    return !error && data?.test === true;
  } catch {
    return false;
  }
}

/** Signs a test account in with the shared password. The password is never stored. */
export async function signInWithTestAccount(email: string, password: string): Promise<void> {
  if (!isDevLoginEnabled) throw new Error('Test accounts are off in this build.');
  const client = requireSupabase();
  const e = email.trim().toLowerCase();
  let data: { otp?: string; type?: string } | null = null;
  try {
    const res = await client.functions.invoke('dev-login', { body: { email: e, password } });
    if (res.error) {
      const status = (res.error as { context?: { status?: number } }).context?.status;
      throw new Error(
        status === 401 ? 'Wrong email or password.'
          : status === 403 || status === 404 ? 'Test accounts are turned off on this server.'
            : TEST_SIGN_IN_UNREACHABLE,
      );
    }
    data = res.data;
  } catch (err) {
    throw err instanceof Error && err.message !== '' ? err : new Error(TEST_SIGN_IN_UNREACHABLE);
  }
  const otp = data?.otp;
  if (!otp) throw new Error(TEST_SIGN_IN_UNREACHABLE);

  localStorage.removeItem(PENDING_ROLE_KEY);
  // Set before the session lands: the profile load reads it to skip the picker.
  markTestAccountSignIn(true);
  const { error } = await client.auth.verifyOtp({
    email: e, token: otp, type: data?.type === 'magiclink' ? 'magiclink' : 'email',
  });
  if (error) {
    markTestAccountSignIn(false);
    throw error;
  }
}

async function isAllowlisted(email: string, role: 'admin' | 'volunteer'): Promise<boolean> {
  const { data, error } = await requireSupabase().from('role_allowlist').select('email')
    .eq('email', email.toLowerCase()).eq('role', role).maybeSingle();
  if (error) throw error;
  return data != null;
}

/** Open roles aren't on any sheet, so test accounts are named by role. */
function inferOpenTestRole(email: string): string {
  const local = email.split('@')[0].toLowerCase();
  if (local.includes('expert')) return 'expert';
  if (local.includes('spectator') || local.includes('parent')) return 'parentSpectator';
  return 'participant';
}

/**
 * Port of the app's _autoOnboardTestAccount: admin if allowlisted, else
 * volunteer if allowlisted, else inferred from the email. The server trigger
 * still decides; the re-read shows what it kept.
 */
async function autoOnboardTestAccount(row: Record<string, any>): Promise<Record<string, any>> {
  const email: string = row.email ?? '';
  let role: string;
  try {
    role = (await isAllowlisted(email, 'admin')) ? 'admin'
      : (await isAllowlisted(email, 'volunteer')) ? 'volunteer'
        : inferOpenTestRole(email);
  } catch {
    role = inferOpenTestRole(email);
  }
  const { data: updated, error } = await requireSupabase().from('profiles').update({
    full_name: row.full_name || email.split('@')[0],
    role,
    onboarded: true,
    updated_at: new Date().toISOString(),
  }).eq('id', row.id).select('*').single();
  if (error || !updated) throw new SignInRefusedError(LOAD_FAILED_MESSAGE);

  const shown = profileFromRow(updated);
  const roleLabel = roleByName(shown.role)?.label ?? shown.role;
  const subtype = shown.volunteer_subtype ? VOLUNTEER_SUBTYPE_LABELS[shown.volunteer_subtype] : undefined;
  testAccountNotice = `Testing account: you were given the ${subtype ? `${roleLabel} · ${subtype}` : roleLabel} role automatically, so there is no role picker.`;
  return updated;
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
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.from('profiles').select('details').eq('id', session.user.id).single();
  if (error) throw error;
  return data?.details ? registrationFromRow(data.details as RegistrationRow) : null;
}

/** The signed-in account's expert_status, read fresh ("Check again"). */
export async function fetchExpertStatus(): Promise<string | null> {
  const session = await requireRealSession();
  const { data, error } = await requireSupabase().from('profiles').select('expert_status')
    .eq('id', session.user.id).single();
  if (error) throw error;
  return (data?.expert_status as string | null) ?? null;
}

/** Clears the one-time "expert request wasn't approved" note, as the app does. */
export async function acknowledgeExpertDecline(): Promise<void> {
  const { error } = await requireSupabase().rpc('acknowledge_expert_decline');
  if (error) throw error;
}

export function needsProfileSetup(profile: Profile | null): boolean {
  if (profile == null) return true;
  return profile.profile_setup_complete !== true;
}

export async function updateProfileSettings(input: Partial<SaveProfileInput>): Promise<void> {
  await writeProfile(input, false);
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(PENDING_ROLE_KEY);
  // With no client configured there is nothing else to clear.
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
