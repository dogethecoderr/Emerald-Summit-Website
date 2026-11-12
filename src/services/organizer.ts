// Organizer and admin calls, through the same RPCs and tables as the mobile
// app (lib/backend/supabase/supabase_repositories.dart). The database decides
// who may do what; each call here fails for anyone it doesn't allow.
import { supabase } from '../lib/supabase';
import { conflictKindFrom, parseStringMap, type ConflictKind, type ParticipationType } from '../models/registration';
import { summitMetricsFrom, type SummitMetrics } from '../models/metrics';

function client() {
  if (!supabase) throw new Error('This needs the Summit database.');
  return supabase;
}

async function rpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(name, params);
  if (error) throw new Error(error.message);
  return data as T;
}

async function uid(): Promise<string | null> {
  const { data } = await client().auth.getSession();
  return data.session?.user.id ?? null;
}

// ---------------------------------------------------------------------------
// Session roster and attendance
// ---------------------------------------------------------------------------

export interface RosterEntry {
  userId: string;
  name: string;
  email: string;
  attended: boolean;
  type: ParticipationType;
  answers: Record<string, string>;
  /** true team, false solo, null when the project isn't shared yet. */
  isTeam: boolean | null;
  projectName: string | null;
  teamId: string | null;
  teamCode: string | null;
  isTeamOwner: boolean;
  role: string | null;
  details: Record<string, string>;
}

export function rosterEntryFrom(row: Record<string, unknown>): RosterEntry {
  const t = row.participation_type;
  return {
    userId: String(row.user_id),
    name: typeof row.full_name === 'string' ? row.full_name : '',
    email: typeof row.email === 'string' ? row.email : '',
    attended: row.attended === true,
    type: t === 'spectator' || t === 'expert' ? t : 'participant',
    answers: parseStringMap(row.answers),
    isTeam: row.project_mode === 'team' ? true : row.project_mode === 'solo' ? false : null,
    projectName: typeof row.project_name === 'string' ? row.project_name : null,
    teamId: row.team_id == null ? null : String(row.team_id),
    teamCode: typeof row.team_code === 'string' ? row.team_code : null,
    isTeamOwner: row.is_team_owner === true,
    role: typeof row.role === 'string' ? row.role : null,
    details: parseStringMap(row.details),
  };
}

export async function fetchSessionRoster(sessionId: string): Promise<RosterEntry[]> {
  const rows = await rpc<Record<string, unknown>[] | null>('fetch_session_roster', { p_session_id: sessionId });
  return (rows ?? []).map(rosterEntryFrom);
}

export async function markSessionAttendance(sessionId: string, userId: string, attended: boolean): Promise<void> {
  await rpc('mark_session_attendance', { p_session_id: sessionId, p_user_id: userId, p_attended: attended });
}

// ---------------------------------------------------------------------------
// Volunteers on a session
// ---------------------------------------------------------------------------

export interface VolunteerRef {
  id: string;
  name: string;
  email: string;
  subtype: string | null;
  phone: string | null;
  role: string | null;
}

export function volunteerFrom(row: Record<string, unknown>): VolunteerRef {
  return {
    id: String(row.id ?? row.user_id),
    name: typeof row.full_name === 'string' ? row.full_name : '',
    email: typeof row.email === 'string' ? row.email : '',
    subtype: typeof row.subtype === 'string' ? row.subtype : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    role: typeof row.role === 'string' ? row.role : null,
  };
}

export async function fetchSessionVolunteers(sessionId: string): Promise<VolunteerRef[]> {
  const rows = await rpc<Record<string, unknown>[] | null>('fetch_session_volunteers', { p_session_id: sessionId });
  return (rows ?? []).map(volunteerFrom);
}

/** Admin only: every volunteer, for the assign picker. */
export async function fetchVolunteers(): Promise<VolunteerRef[]> {
  const rows = await rpc<Record<string, unknown>[] | null>('fetch_volunteers');
  return (rows ?? []).map(volunteerFrom);
}

export type AssignResult =
  | { outcome: 'assigned' }
  | { outcome: 'conflict'; conflictingTitle: string | null; conflictKind: ConflictKind };

/** Admin only. Refuses a volunteer with an overlapping session or a sign-up for this one. */
export async function assignVolunteer(sessionId: string, userId: string): Promise<AssignResult> {
  const row = await rpc<Record<string, unknown> | null>('assign_volunteer_to_session', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_confirm_registered: false,
  });
  if (row?.outcome === 'conflict' || row?.outcome === 'registered_confirm') {
    return {
      outcome: 'conflict',
      conflictingTitle: typeof row.conflicting_title === 'string' ? row.conflicting_title : null,
      conflictKind: row.outcome === 'registered_confirm' ? 'registered_this' : conflictKindFrom(row.conflict_kind),
    };
  }
  return { outcome: 'assigned' };
}

/** Admin only. Also sends the volunteer a personal notice. */
export async function unassignVolunteer(sessionId: string, userId: string): Promise<void> {
  await rpc('unassign_volunteer_from_session', { p_session_id: sessionId, p_user_id: userId });
}

// ---------------------------------------------------------------------------
// Expert approvals (admins)
// ---------------------------------------------------------------------------

export interface ExpertRequest {
  userId: string;
  fullName: string;
  email: string;
  expertise: string | null;
  bio: string | null;
  phone: string | null;
  requestedAt: string | null;
}

export async function fetchExpertRequests(): Promise<ExpertRequest[]> {
  const rows = await rpc<Record<string, unknown>[] | null>('fetch_expert_requests');
  return (rows ?? []).map((r) => ({
    userId: String(r.user_id),
    fullName: typeof r.full_name === 'string' ? r.full_name : '',
    email: typeof r.email === 'string' ? r.email : '',
    expertise: typeof r.expertise === 'string' ? r.expertise : null,
    bio: typeof r.bio === 'string' ? r.bio : null,
    phone: typeof r.phone === 'string' ? r.phone : null,
    requestedAt: typeof r.requested_at === 'string' ? r.requested_at : null,
  }));
}

/** False when the request was already handled by someone else. */
export async function reviewExpert(userId: string, approve: boolean): Promise<boolean> {
  const res = await rpc<unknown>('review_expert', { p_user_id: userId, p_approve: approve });
  return res !== 'not_pending';
}

/** Clears the admin's badge for waiting experts. */
export async function markExpertQueueSeen(): Promise<void> {
  const id = await uid();
  if (!id) return;
  await client().from('profiles').update({ expert_queue_seen_at: new Date().toISOString() }).eq('id', id);
}

// ---------------------------------------------------------------------------
// Rooms (admins write; everyone reads)
// ---------------------------------------------------------------------------

export interface Room {
  id: string;
  name: string;
  sortOrder: number;
}

export async function fetchRooms(): Promise<Room[]> {
  const { data, error } = await client().from('rooms').select()
    .order('sort_order', { ascending: true }).order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: typeof r.name === 'string' ? r.name : '',
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
  }));
}

export async function createRoom(name: string): Promise<void> {
  const { error } = await client().from('rooms').insert({ name });
  if (error) throw new Error(error.message);
}

export async function renameRoom(id: string, name: string): Promise<void> {
  const { data, error } = await client().from('rooms').update({ name }).eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("You don't have permission to change rooms.");
}

export async function deleteRoom(id: string): Promise<void> {
  const { data, error } = await client().from('rooms').delete().eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("You don't have permission to change rooms.");
}

// ---------------------------------------------------------------------------
// Volunteer hours (volunteers and admins)
// ---------------------------------------------------------------------------

export interface HourLog {
  id: string;
  startedAt: Date;
  endedAt: Date;
  description: string;
}

export const logMinutes = (l: HourLog) =>
  Math.max(0, Math.floor((l.endedAt.getTime() - l.startedAt.getTime()) / 60000));

export async function fetchMyHourLogs(): Promise<HourLog[]> {
  const id = await uid();
  if (!id) return [];
  const { data, error } = await client().from('volunteer_hour_logs')
    .select('id, started_at, ended_at, description').eq('user_id', id)
    .order('started_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    startedAt: new Date(String(r.started_at)),
    endedAt: new Date(String(r.ended_at)),
    description: typeof r.description === 'string' ? r.description : '',
  }));
}

export async function saveHourLog(log: Omit<HourLog, 'id'>, id?: string): Promise<void> {
  const row = {
    started_at: log.startedAt.toISOString(),
    ended_at: log.endedAt.toISOString(),
    description: log.description,
  };
  const table = client().from('volunteer_hour_logs');
  const { error } = id ? await table.update(row).eq('id', id) : await table.insert(row);
  if (error) throw new Error(error.message);
}

export async function deleteHourLog(id: string): Promise<void> {
  const { error } = await client().from('volunteer_hour_logs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// After the summit: expert feedback and volunteering again
// ---------------------------------------------------------------------------

export type FeedbackKind = 'app' | 'summit' | 'session';

export interface ExpertFeedback {
  kind: FeedbackKind;
  sessionId: string | null;
  rating: number;
  comment: string;
}

export async function fetchMyFeedback(): Promise<ExpertFeedback[]> {
  const id = await uid();
  if (!id) return [];
  const { data, error } = await client().from('expert_feedback')
    .select('kind, session_id, rating, comment').eq('expert_id', id);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    kind: r.kind as FeedbackKind,
    sessionId: r.session_id == null ? null : String(r.session_id),
    rating: Number(r.rating),
    comment: typeof r.comment === 'string' ? r.comment : '',
  }));
}

export async function submitFeedback(items: ExpertFeedback[]): Promise<void> {
  await rpc('submit_expert_feedback', {
    p_items: items.map((i) => ({ kind: i.kind, session_id: i.sessionId, rating: i.rating, comment: i.comment })),
  });
}

export async function fetchMyEafInterest(): Promise<boolean | null> {
  const id = await uid();
  if (!id) return null;
  const { data, error } = await client().from('eaf_future_interest')
    .select('wants_to_volunteer').eq('user_id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.wants_to_volunteer === 'boolean' ? data.wants_to_volunteer : null;
}

export async function setEafInterest(yes: boolean): Promise<void> {
  await rpc('set_eaf_future_interest', { p_yes: yes });
}

// ---------------------------------------------------------------------------
// Metrics (admins)
// ---------------------------------------------------------------------------

export async function fetchSummitMetrics(): Promise<SummitMetrics> {
  return summitMetricsFrom(await rpc<Record<string, unknown> | null>('fetch_summit_metrics'));
}
