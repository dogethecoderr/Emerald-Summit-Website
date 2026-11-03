// The website uses the same registrations and assignment RPCs as the mobile app.
import { supabase } from '../lib/supabase';
import { getBypassSession } from './auth';

export type ReservationKind = 'competing' | 'spectating' | 'judging' | 'volunteering';

export interface Reservation {
  sessionId: string;
  kind: ReservationKind;
}

type ParticipationType = 'participant' | 'spectator' | 'expert';
const kinds: Record<ParticipationType, ReservationKind> = {
  participant: 'competing', spectator: 'spectating', expert: 'judging',
};

/** True when this browser has a real session for the shared database. */
export async function canSaveSchedule(): Promise<boolean> {
  if (!supabase || getBypassSession()) return false;
  const { data } = await supabase.auth.getSession();
  return data.session != null;
}

/** The signed-in person's registrations, RLS-scoped to their account. */
export async function fetchMyReservations(): Promise<Reservation[] | null> {
  if (!(await canSaveSchedule())) return null;
  const { data: auth } = await supabase!.auth.getSession();
  const { data, error } = await supabase!.from('registrations')
    .select('session_id, participation_type').eq('user_id', auth.session!.user.id);
  if (error) throw new Error(error.message);
  return (data as { session_id: string; participation_type: ParticipationType }[])
    .filter((r) => r.participation_type in kinds)
    .map((r) => ({ sessionId: r.session_id, kind: kinds[r.participation_type] }));
}

/** Volunteers see sessions assigned by an admin, never self-selected shifts. */
export async function fetchMyVolunteerAssignments(): Promise<string[] | null> {
  if (!(await canSaveSchedule())) return null;
  const { data: auth } = await supabase!.auth.getSession();
  const { data, error } = await supabase!.from('session_volunteers')
    .select('session_id').eq('user_id', auth.session!.user.id);
  if (error) throw new Error(error.message);
  return (data as { session_id: string }[]).map((r) => r.session_id);
}

function checkOutcome(data: { outcome?: string; conflicting_title?: string } | null, expected: string) {
  const outcome = data?.outcome;
  if (outcome === expected) return;
  const messages: Record<string, string> = {
    full: 'This session is full.',
    conflict: data?.conflicting_title
      ? `This overlaps with ${data.conflicting_title}.` : 'This overlaps with another session.',
    participation_closed: 'Participation is closed. Only spectators can register now.',
    expert_not_approved: 'Your expert application must be approved before you can register as an expert.',
    owner_transfer_required: 'Transfer team ownership in the mobile app before leaving this session.',
    project_name_required: 'Add your project details in the mobile app before registering.',
    team_full: 'That team is full.',
    team_not_found: 'We could not find that team.',
    team_wrong_session: 'That team is for a different session.',
    removed_from_team: 'The team owner removed you from this team.',
  };
  throw new Error(messages[outcome ?? ''] ?? `Could not update registration (${outcome ?? 'no result'}).`);
}

/** Writes use the mobile RPC so capacity and time conflicts stay server-enforced. */
export async function reserve(sessionId: string, kind: ReservationKind): Promise<void> {
  if (kind === 'volunteering') throw new Error('Volunteer sessions are assigned by an admin.');
  if (!(await canSaveSchedule())) throw new Error('Sign in to save your schedule.');
  const type: ParticipationType = kind === 'judging' ? 'expert' : kind === 'spectating' ? 'spectator' : 'participant';
  const { data, error } = await supabase!.rpc('register_for_session', {
    p_session_id: sessionId, p_participation_type: type, p_answers: {}, p_intent: 'add',
  });
  if (error) throw new Error(error.message);
  checkOutcome(data, 'added');
}

export async function release(sessionId: string): Promise<void> {
  if (!(await canSaveSchedule())) throw new Error('Sign in to save your schedule.');
  const { data, error } = await supabase!.rpc('register_for_session', {
    p_session_id: sessionId, p_intent: 'remove',
  });
  if (error) throw new Error(error.message);
  checkOutcome(data, 'removed');
}
