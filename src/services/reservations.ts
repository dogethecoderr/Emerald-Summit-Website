// A signed-in person's schedule, saved in public.session_reservations
// (20261101160000_session_reservations.sql; volunteers since
// 20261101180000_volunteer_spots.sql). The database refuses a full session or
// a second session in one time slot and keeps every session's seat counts in
// step. Demo and expert (approvals-sheet) sessions have no
// database credentials, so their schedules stay in the browser.
import { supabase } from '../lib/supabase';
import { getBypassSession } from './auth';

export type ReservationKind = 'competing' | 'spectating' | 'judging' | 'volunteering';

export interface Reservation {
  sessionId: string;
  kind: ReservationKind;
}

/** True when this browser's schedule can be saved to the database. */
export async function canSaveSchedule(): Promise<boolean> {
  if (!supabase || getBypassSession()) return false;
  const { data } = await supabase.auth.getSession();
  return data.session != null;
}

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

/** The signed-in person's reservations, or null when nothing is saved remotely. */
export async function fetchMyReservations(): Promise<Reservation[] | null> {
  if (!(await canSaveSchedule())) return null;
  const { data: auth } = await supabase!.auth.getSession();
  const { data, error } = await supabase!
    .from('session_reservations')
    .select('session_id, kind')
    .eq('user_id', auth.session!.user.id);
  if (error) {
    if (!isMissingTable(error)) console.error('Failed to load schedule', error);
    return null;
  }
  return (data as { session_id: string; kind: ReservationKind }[]).map((r) => ({
    sessionId: r.session_id,
    kind: r.kind,
  }));
}

/** Saves one reservation. Throws with the database's reason when refused. */
export async function reserve(sessionId: string, kind: ReservationKind): Promise<void> {
  const { data: auth } = await supabase!.auth.getSession();
  const { error } = await supabase!
    .from('session_reservations')
    .insert({ user_id: auth.session!.user.id, session_id: sessionId, kind });
  if (error) {
    // 23505: already reserved (e.g. a second tab); the schedule is right.
    if (error.code === '23505') return;
    throw new Error(error.message);
  }
}

export async function release(sessionId: string): Promise<void> {
  const { data: auth } = await supabase!.auth.getSession();
  const { error } = await supabase!
    .from('session_reservations')
    .delete()
    .eq('user_id', auth.session!.user.id)
    .eq('session_id', sessionId);
  if (error) throw new Error(error.message);
}
