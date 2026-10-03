import { supabase } from '../lib/supabase';
import {
  getActiveDemoUserId,
  getDemoSessionRegistrations,
  setDemoSessionRegistration,
} from './offlineDemo';

export type SessionRegistrationType = 'competitor' | 'expert' | 'spectator';

export interface UserSessionRegistration {
  session_id: string;
  registration_type: SessionRegistrationType;
}

export async function fetchUserSessionRegistrations(
  userId: string,
): Promise<UserSessionRegistration[]> {
  if (!supabase) return getDemoSessionRegistrations(userId);
  const { data, error } = await supabase
    .from('session_registrations')
    .select('session_id, registration_type')
    .eq('user_id', userId);
  if (error) throw new Error(`Could not load your session registrations: ${error.message}`);
  return (data ?? []) as UserSessionRegistration[];
}

export async function saveSessionRegistration(
  sessionId: string,
  registrationType: SessionRegistrationType | null,
): Promise<void> {
  if (!supabase) {
    const userId = getActiveDemoUserId();
    if (!userId) throw new Error('Select a demo user before changing schedule registrations.');
    setDemoSessionRegistration(sessionId, userId, registrationType);
    return;
  }

  const result = registrationType
    ? await supabase.rpc('register_for_session', {
        p_session_id: sessionId,
        p_registration_type: registrationType,
      })
    : await supabase.rpc('unregister_from_session', {
        p_session_id: sessionId,
      });

  if (result.error) throw new Error(result.error.message);
}
