// Registration, projects and teams for one session, through the same RPCs as
// the mobile app (lib/backend/supabase/supabase_repositories.dart,
// SupabaseScheduleRepository and SupabaseExpertsRepository).
import { supabase } from '../lib/supabase';
import { REGISTRATION_CLOSED_MESSAGE } from './siteSwitches';
import { isRemovedFromSession, REMOVED_FROM_SESSION_MESSAGE } from './sessionRemovals';
import {
  GRADE_BLOCK_MESSAGE,
  gradeBlockFromError,
  myProjectFromRow,
  normalizeTeamCode,
  projectModeId,
  projectProblemMessage,
  registrationResultFrom,
  teamLookupFrom,
  parseStringMap,
  type MyProject,
  type ParticipationType,
  type ProjectChoice,
  type RegistrationResult,
  type TeamLookup,
} from '../models/registration';

/** A team problem the backend refused, worded for the person. */
export class TeamCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamCodeError';
  }
}

function client() {
  if (!supabase) throw new Error('Sign in to save your schedule.');
  return supabase;
}

function isRemovedFromTeam(message: string | undefined) {
  return (message ?? '').includes('removed_from_team');
}

/** The server refuses every new sign-up while website_registration_open is off. */
function isRegistrationClosed(message: string | undefined) {
  return (message ?? '').includes('registration_closed');
}

/**
 * Adds or removes a session. `add` says what the page showed, so a stale page
 * can't flip the registration the other way on the server.
 */
export async function toggleRegistration(
  sessionId: string,
  opts: {
    add: boolean;
    type?: ParticipationType;
    answers?: Record<string, string>;
    project?: ProjectChoice;
    newOwnerId?: string;
  },
): Promise<RegistrationResult> {
  const params: Record<string, unknown> = {
    p_session_id: sessionId,
    p_participation_type: opts.type ?? 'participant',
    p_answers: opts.answers ?? {},
    p_project_mode: opts.project ? projectModeId(opts.project) : null,
    p_project_name: opts.project && 'projectName' in opts.project ? opts.project.projectName ?? null : null,
    p_team_code: opts.project?.action === 'joinTeam' ? normalizeTeamCode(opts.project.teamCode) : null,
    p_intent: opts.add ? 'add' : 'remove',
  };
  if (opts.newOwnerId) params.p_new_owner_id = opts.newOwnerId;
  const { data, error } = await client().rpc('register_for_session', params);
  if (error) {
    if (isRemovedFromTeam(error.message)) {
      return { outcome: 'invalid_project', message: projectProblemMessage('removed_from_team')! };
    }
    if (isRegistrationClosed(error.message)) {
      return { outcome: 'invalid_project', message: `${REGISTRATION_CLOSED_MESSAGE}.` };
    }
    if (isRemovedFromSession(error.message)) {
      return { outcome: 'invalid_project', message: REMOVED_FROM_SESSION_MESSAGE };
    }
    const gradeBlock = gradeBlockFromError(error.message);
    if (gradeBlock) return { outcome: 'invalid_project', message: GRADE_BLOCK_MESSAGE[gradeBlock] };
    throw new Error(error.message);
  }
  return registrationResultFrom(data as Record<string, unknown> | null);
}

/** The caller's saved answers to a session's questions. */
export async function fetchMyAnswers(sessionId: string): Promise<Record<string, string>> {
  const { data: auth } = await client().auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) return {};
  const { data, error } = await client().from('registrations')
    .select('answers').eq('session_id', sessionId).eq('user_id', uid).maybeSingle();
  if (error) throw new Error(error.message);
  return parseStringMap(data?.answers);
}

export async function fetchMyProject(sessionId: string): Promise<MyProject | null> {
  const { data, error } = await client().rpc('fetch_my_project', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  return myProjectFromRow(data as Record<string, unknown> | null);
}

export async function findTeam(sessionId: string, code: string): Promise<TeamLookup> {
  const { data, error } = await client().rpc('find_team', {
    p_session_id: sessionId,
    p_code: normalizeTeamCode(code),
  });
  if (error) throw new Error(error.message);
  return teamLookupFrom(data as Record<string, unknown> | null);
}

/** Replaces a participant's answers and project. Throws TeamCodeError when refused. */
export async function updateMyRegistration(
  sessionId: string,
  answers: Record<string, string>,
  project: ProjectChoice,
  newOwnerId?: string,
): Promise<MyProject> {
  const params: Record<string, unknown> = {
    p_session_id: sessionId,
    p_answers: answers,
    p_project_mode: projectModeId(project),
    p_project_name: 'projectName' in project ? project.projectName ?? null : null,
    p_team_code: project.action === 'joinTeam' ? normalizeTeamCode(project.teamCode) : null,
  };
  if (newOwnerId) params.p_new_owner_id = newOwnerId;
  const { data, error } = await client().rpc('update_my_registration', params);
  if (error) {
    if (isRemovedFromTeam(error.message)) throw new TeamCodeError(projectProblemMessage('removed_from_team')!);
    throw new Error(error.message);
  }
  const row = (data ?? {}) as Record<string, unknown>;
  const outcome = typeof row.outcome === 'string' ? row.outcome : null;
  const problem = projectProblemMessage(outcome);
  if (problem) throw new TeamCodeError(problem);
  if (outcome !== 'updated') throw new TeamCodeError("You're not registered as a participant here.");
  return (await fetchMyProject(sessionId)) ?? {
    isTeam: row.team_code != null,
    projectName: typeof row.project_name === 'string' ? row.project_name : '',
    teamCode: typeof row.team_code === 'string' ? row.team_code : null,
    members: [],
    isOwner: false,
    maxTeamSize: 4,
  };
}

export async function transferTeamOwnership(sessionId: string, newOwnerId: string): Promise<void> {
  const { data, error } = await client().rpc('transfer_team_ownership', {
    p_session_id: sessionId,
    p_new_owner_id: newOwnerId,
  });
  if (error) throw new Error(error.message);
  const outcome = (data as Record<string, unknown> | null)?.outcome;
  if (outcome === 'transferred') return;
  throw new TeamCodeError(
    projectProblemMessage(typeof outcome === 'string' ? outcome : null) ?? "Only the team's owner can hand it over.",
  );
}

export async function removeTeamMember(sessionId: string, userId: string): Promise<void> {
  const { data, error } = await client().rpc('remove_team_member', {
    p_session_id: sessionId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  switch ((data as Record<string, unknown> | null)?.outcome) {
    case 'removed': return;
    case 'not_member': throw new TeamCodeError("That person isn't on your team anymore.");
    case 'cannot_remove_self': throw new TeamCodeError('To leave your own team, use "Leave team / go solo".');
    default: throw new TeamCodeError("Only the team's owner can remove members.");
  }
}

/** Names of the approved experts registered for a session. */
export async function fetchSessionExperts(sessionId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('session_experts', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).map(String);
}

export type ManageResult =
  | { outcome: 'managing' | 'stopped' }
  | { outcome: 'conflict'; conflictingTitle: string | null; conflictKind: string };

/** Admin self-manage: overlap-guarded add or remove of themselves as a manager. */
export async function setSessionManage(sessionId: string, manage: boolean): Promise<ManageResult> {
  const { data, error } = await client().rpc('set_session_manage', {
    p_session_id: sessionId,
    p_manage: manage,
  });
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.outcome === 'conflict') {
    return {
      outcome: 'conflict',
      conflictingTitle: typeof row.conflicting_title === 'string' ? row.conflicting_title : null,
      conflictKind: typeof row.conflict_kind === 'string' ? row.conflict_kind : 'registered',
    };
  }
  return { outcome: manage ? 'managing' : 'stopped' };
}
