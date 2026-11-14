// Organizers taking someone off a session (app repo,
// session_participant_removal.sql). Same gate as the roster: an admin, a
// volunteer assigned to the session, or a session editor for its discipline.
// A removed person can't sign up for that session again until someone allows
// them back.
import { supabase } from '../lib/supabase';
import type { ParticipationType } from '../models/registration';

function client() {
  if (!supabase) throw new Error('Sign in first.');
  return supabase;
}

export interface SessionRemoval {
  userId: string;
  name: string;
  email: string;
  type: ParticipationType | null;
  removedBy: string | null;
  removedAt: string | null;
}

const TYPES: ParticipationType[] = ['participant', 'spectator', 'expert'];

export function removalFrom(row: Record<string, unknown>): SessionRemoval {
  const type = TYPES.find((t) => t === row.participation_type) ?? null;
  return {
    userId: String(row.user_id),
    name: typeof row.full_name === 'string' ? row.full_name : '',
    email: typeof row.email === 'string' ? row.email : '',
    type,
    removedBy: typeof row.removed_by_name === 'string' ? row.removed_by_name : null,
    removedAt: typeof row.removed_at === 'string' ? row.removed_at : null,
  };
}

/**
 * Who was removed from this session, newest first. Null when the backend
 * doesn't have removals yet (the SQL hasn't been run) or refuses the caller,
 * so the page can hide the Remove buttons instead of showing ones that fail.
 */
export async function fetchSessionRemovals(sessionId: string): Promise<SessionRemoval[] | null> {
  const { data, error } = await client().rpc('fetch_session_removals', { p_session_id: sessionId });
  if (error) return null;
  return ((data ?? []) as Record<string, unknown>[]).map(removalFrom);
}

export type RemoveOutcome = 'removed' | 'not_registered' | 'cannot_remove_self';

/** Deletes their registration, blocks signing back up, and sends them a notice. */
export async function removeFromSession(sessionId: string, userId: string): Promise<RemoveOutcome> {
  const { data, error } = await client().rpc('remove_session_registration', {
    p_session_id: sessionId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  const outcome = (data as Record<string, unknown> | null)?.outcome;
  return outcome === 'not_registered' || outcome === 'cannot_remove_self' ? outcome : 'removed';
}

/** Lifts the block; they can sign up again themselves. */
export async function allowBackToSession(sessionId: string, userId: string): Promise<void> {
  const { error } = await client().rpc('allow_back_to_session', { p_session_id: sessionId, p_user_id: userId });
  if (error) throw new Error(error.message);
}

/** The error register_for_session raises for someone an organizer removed. */
export function isRemovedFromSession(message: string | undefined): boolean {
  return (message ?? '').includes('removed_from_session');
}

export const REMOVED_FROM_SESSION_MESSAGE =
  "An organizer removed you from this session, so you can't sign up for it again. If you think this was a mistake, contact the summit team.";
