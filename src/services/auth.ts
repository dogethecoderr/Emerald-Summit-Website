import { supabase } from '../lib/supabase';
import type { Person, Visibility } from '../models/people';
import type { PersonStatus } from '../models/personStatus';
import type { User } from '@supabase/supabase-js';

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
};

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
 * Gets the current profile from the public.users table.
 * If the row doesn't exist yet, it creates it using the pending role if available.
 */
export async function getCurrentProfile(user: User): Promise<Profile | null> {
  let { data, error } = await requireSupabase()
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error && error.code === 'PGRST116') {
    // Row not found, create one.
    const pendingRole = takePendingRole() || 'participant';
    const newProfile = {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.full_name || 'New User',
      role: pendingRole,
      profile_setup_complete: false,
    };
    const { data: inserted, error: insertError } = await requireSupabase()
      .from('users')
      .insert(newProfile)
      .select('*')
      .single();
    
    if (insertError) {
      console.error('Failed to create user profile', insertError);
      return null;
    }
    data = inserted;
  } else if (error) {
    console.error('Failed to fetch user profile', error);
    return null;
  }

  // If they have a pending role, and they are not fully set up, we could update their role.
  const pendingRole = takePendingRole();
  if (pendingRole && data && !data.profile_setup_complete && data.role !== pendingRole) {
    const { data: updated, error: updateError } = await requireSupabase()
      .from('users')
      .update({ role: pendingRole })
      .eq('id', user.id)
      .select('*')
      .single();
    if (!updateError && updated) {
      data = updated;
    }
  }

  return data as Profile;
}

export function getBypassSession(): any | null {
  const raw = localStorage.getItem('bypass_session');
  return raw ? JSON.parse(raw) : null;
}

export function getBypassProfile(): Profile | null {
  const raw = localStorage.getItem('bypass_profile');
  return raw ? JSON.parse(raw) as Profile : null;
}

export function signInWithBypass(roleName: string): void {
  const session = {
    user: {
      id: 'bypass_user_id',
      email: 'bypass@example.com',
      user_metadata: {
        full_name: `Bypass ${roleName.charAt(0).toUpperCase() + roleName.slice(1)}`,
      }
    }
  };
  const profile: Profile = {
    id: 'bypass_user_id',
    email: 'bypass@example.com',
    name: `Bypass ${roleName.charAt(0).toUpperCase() + roleName.slice(1)}`,
    role: roleName,
    profile_setup_complete: true,
  };
  localStorage.setItem('bypass_session', JSON.stringify(session));
  localStorage.setItem('bypass_profile', JSON.stringify(profile));
  
  // Emit storage event to trigger AuthContext refresh
  window.dispatchEvent(new Event('storage'));
}

export function clearBypass(): void {
  localStorage.removeItem('bypass_session');
  localStorage.removeItem('bypass_profile');
}

export async function signInWithGoogle(roleName: string): Promise<void> {
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
}

export async function saveProfile(input: SaveProfileInput): Promise<void> {
  const { data: { session } } = await requireSupabase().auth.getSession();
  if (!session) throw new Error('Not signed in.');

  const updatePayload: any = {
    name: input.name,
    profile_setup_complete: true,
  };
  
  if (input.phone) updatePayload.phone = input.phone;
  if (input.discipline) updatePayload.discipline = input.discipline;
  if (input.bio) updatePayload.bio = input.bio;

  const { error } = await requireSupabase()
    .from('users')
    .update(updatePayload)
    .eq('id', session.user.id);
    
  if (error) throw error;
}

export function needsProfileSetup(profile: Profile | null): boolean {
  if (profile == null) return true;
  return profile.profile_setup_complete !== true;
}

export async function updateProfileSettings(
  input: Partial<SaveProfileInput>,
): Promise<void> {
  const { data: { session } } = await requireSupabase().auth.getSession();
  if (!session) throw new Error('Not signed in.');
  
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
