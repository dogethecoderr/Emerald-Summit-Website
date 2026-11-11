// Session registration rules, ported from the mobile app's
// lib/models/models.dart and lib/backend/repositories.dart. The database
// (register_for_session, update_my_registration, find_team, ...) enforces
// every rule; this file only reads its results and words them the way the
// app does.

/** How someone joined a session (`registrations.participation_type`). */
export type ParticipationType = 'participant' | 'spectator' | 'expert';

export const CHIP_LABEL: Record<ParticipationType, string> = {
  participant: 'Participating',
  spectator: 'Spectating',
  expert: 'Expert',
};

export const STATUS_LABEL: Record<ParticipationType, string> = {
  participant: "You're participating in this session.",
  spectator: "You're spectating this session.",
  expert: "You're serving as an expert here.",
};

/** One organizer-written question a participant answers when joining. */
export interface SessionQuestion {
  id: string;
  prompt: string;
}

/** An editor-written section of a session page. */
export interface SessionPageBlock {
  title: string;
  body: string;
}

export const DEFAULT_QUESTIONS = {
  soloOrTeam: 'Are you participating in a team, or solo?',
  projectName: 'What is your project name?',
  teamCode: "What's your team code?",
  unsureNote:
    "Not sure yet whether you'll have a team? Register as solo for now. You can change your answer later on the session page.",
};

export const DEFAULT_MAX_TEAM_SIZE = 4;
export const LARGEST_TEAM_SIZE_LIMIT = 8;
export const SOLO_ONLY_TEAM_SIZE = 1;

function jsonList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Parses `participant_questions`; malformed or blank entries are dropped. */
export function parseQuestions(raw: unknown): SessionQuestion[] {
  return jsonList(raw)
    .filter((e): e is Record<string, unknown> => e != null && typeof e === 'object')
    .map((e) => ({ id: String(e.id ?? ''), prompt: typeof e.prompt === 'string' ? e.prompt : '' }))
    .filter((q) => q.id && q.prompt.trim());
}

/** Parses `page_blocks`; malformed entries are dropped. */
export function parsePageBlocks(raw: unknown): SessionPageBlock[] {
  return jsonList(raw)
    .filter((e): e is Record<string, unknown> => e != null && typeof e === 'object')
    .map((e) => ({
      title: typeof e.title === 'string' ? e.title : '',
      body: typeof e.body === 'string' ? e.body : '',
    }));
}

/** Decodes a jsonb object (answers, profile details) into a string map. */
export function parseStringMap(raw: unknown): Record<string, string> {
  let value = raw;
  if (typeof value === 'string') {
    if (!value.trim()) return {};
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, v == null ? '' : String(v)]),
  );
}

/**
 * The two-letter prefix of every team code in a discipline. Mirrors
 * team_code_prefix in the app's teams_setup.sql; for display only.
 */
export function teamCodePrefix(disciplineId: string, disciplineName: string): string {
  const pinned: Record<string, string> = {
    techverse: 'TV',
    ventureverse: 'VV',
    biosphere: 'BS',
    novasphere: 'NS',
    civicverse: 'CV',
    imaginex: 'IX',
  };
  if (pinned[disciplineId]) return pinned[disciplineId];
  const caps = disciplineName.replace(/[^A-Z]/g, '');
  if (caps.length >= 2) return caps.slice(0, 2);
  const letters = disciplineName.replace(/[^A-Za-z]/g, '');
  if (!letters) return 'TM';
  return letters.slice(0, 2).toUpperCase().padEnd(2, 'X');
}

/** Cleans up a typed team code ("tv 4821" → "TV4821"). */
export function normalizeTeamCode(code: string): string {
  return code.replace(/\s/g, '').toUpperCase();
}

/** A participant's answer to the solo/team question. */
export type ProjectChoice =
  | { action: 'solo'; projectName: string }
  | { action: 'createTeam'; projectName: string }
  | { action: 'joinTeam'; teamCode: string }
  | { action: 'stayOnTeam'; projectName?: string };

/** The `p_project_mode` value the RPCs take. */
export function projectModeId(choice: ProjectChoice): 'solo' | 'create' | 'join' | 'stay' {
  switch (choice.action) {
    case 'solo': return 'solo';
    case 'createTeam': return 'create';
    case 'joinTeam': return 'join';
    case 'stayOnTeam': return 'stay';
  }
}

export interface TeamMember {
  id: string;
  name: string;
  isOwner: boolean;
}

/** The signed-in participant's project for one session. */
export interface MyProject {
  isTeam: boolean;
  projectName: string;
  teamCode: string | null;
  members: TeamMember[];
  isOwner: boolean;
  maxTeamSize: number;
}

export const teamsAllowed = (maxTeamSize: number) => maxTeamSize >= 2;

/** True when leaving would need a new owner: the caller owns a team with others on it. */
export const mustHandOff = (p: MyProject | null) =>
  p != null && p.isTeam && p.isOwner && p.members.length > 1;

/** Parses fetch_my_project; null when there's no solo/team answer yet. */
export function myProjectFromRow(row: Record<string, unknown> | null | undefined): MyProject | null {
  if (!row) return null;
  const mode = row.mode;
  if (mode !== 'solo' && mode !== 'team') return null;
  const details = Array.isArray(row.member_details) ? row.member_details : null;
  const members: TeamMember[] = details
    ? details
      .filter((m): m is Record<string, unknown> => m != null && typeof m === 'object')
      .map((m) => ({ id: String(m.id ?? ''), name: String(m.name ?? ''), isOwner: m.is_owner === true }))
    : (Array.isArray(row.members) ? row.members : []).map((m) => ({ id: '', name: String(m), isOwner: false }));
  return {
    isTeam: mode === 'team',
    projectName: typeof row.project_name === 'string' ? row.project_name : '',
    teamCode: typeof row.team_code === 'string' ? row.team_code : null,
    isOwner: row.is_owner === true,
    maxTeamSize: typeof row.max_team_size === 'number' ? row.max_team_size : DEFAULT_MAX_TEAM_SIZE,
    members,
  };
}

/** User-facing text for the project/team outcomes the backend can return. */
export function projectProblemMessage(outcome: string | null | undefined): string | null {
  switch (outcome) {
    case 'team_not_found':
    case 'no_team':
      return "That team doesn't exist anymore. Check the code with your teammate.";
    case 'team_wrong_session': return 'That team code is for a different session.';
    case 'team_full': return 'That team is already full.';
    case 'teams_not_allowed': return "This session is solo only. Teams aren't allowed.";
    case 'removed_from_team': return "That team's owner removed you from it, so you can't rejoin it.";
    case 'project_name_required': return 'Please enter your project name.';
    case 'choose_new_owner': return 'You own this team. Choose a teammate to take over before you leave.';
    case 'invalid_new_owner': return "That person isn't on your team anymore. Pick someone else.";
    case 'expert_not_approved': return 'Only approved expert accounts can serve as an expert.';
    default: return null;
  }
}

/** What a time conflict is with (the backend's `conflict_kind`). */
export type ConflictKind = 'registered' | 'managing' | 'managing_this' | 'registered_this';

export function conflictKindFrom(raw: unknown): ConflictKind {
  return raw === 'managing' || raw === 'managing_this' || raw === 'registered_this' ? raw : 'registered';
}

export type RegistrationResult =
  | { outcome: 'added'; teamCode: string | null }
  | { outcome: 'removed' }
  | { outcome: 'full' }
  | { outcome: 'participation_closed' }
  | { outcome: 'conflict'; conflictingTitle: string | null; conflictKind: ConflictKind }
  | { outcome: 'invalid_project'; message: string };

/** Maps a register_for_session result the same way the app does. */
export function registrationResultFrom(raw: Record<string, unknown> | null): RegistrationResult {
  const outcome = typeof raw?.outcome === 'string' ? raw.outcome : 'added';
  const problem = projectProblemMessage(outcome);
  if (problem) return { outcome: 'invalid_project', message: problem };
  switch (outcome) {
    case 'removed': return { outcome: 'removed' };
    case 'full': return { outcome: 'full' };
    case 'participation_closed': return { outcome: 'participation_closed' };
    case 'conflict':
      return {
        outcome: 'conflict',
        conflictingTitle: typeof raw?.conflicting_title === 'string' ? raw.conflicting_title : null,
        conflictKind: conflictKindFrom(raw?.conflict_kind),
      };
    default:
      return { outcome: 'added', teamCode: typeof raw?.team_code === 'string' ? raw.team_code : null };
  }
}

/** The dialog text for a time conflict, worded like the app. */
export function conflictMessage(
  kind: ConflictKind,
  conflictingTitle: string | null,
  role: string | undefined,
): string {
  const title = conflictingTitle ?? 'another session';
  if (kind === 'managing_this') return "You're managing this session, so you can't also sign up for it.";
  if (kind === 'managing') {
    const hint = role === 'admin'
      ? ' Stop managing that one first to add this.'
      : role === 'volunteer'
        ? ' Ask an admin to take you off that one first.'
        : '';
    return `This overlaps with "${title}", which you're managing.${hint}`;
  }
  return `This overlaps with "${title}", which is already on your schedule. Remove that one first to add this.`;
}

export type TeamLookupOutcome =
  | 'found' | 'full' | 'not_found' | 'wrong_session' | 'teams_not_allowed' | 'removed' | 'too_many_tries';

export interface TeamLookup {
  outcome: TeamLookupOutcome;
  projectName: string | null;
  memberCount: number;
  maxTeamSize: number;
  sessionTitle: string | null;
}

export function teamLookupFrom(raw: Record<string, unknown> | null): TeamLookup {
  const o = raw?.outcome;
  const outcome: TeamLookupOutcome =
    o === 'found' || o === 'full' || o === 'wrong_session' || o === 'teams_not_allowed'
      || o === 'removed' || o === 'too_many_tries'
      ? o
      : 'not_found';
  return {
    outcome,
    projectName: typeof raw?.project_name === 'string' ? raw.project_name : null,
    memberCount: typeof raw?.member_count === 'number' ? raw.member_count : 0,
    maxTeamSize: typeof raw?.max_team_size === 'number' ? raw.max_team_size : DEFAULT_MAX_TEAM_SIZE,
    sessionTitle: typeof raw?.session_title === 'string' ? raw.session_title : null,
  };
}

/** Why a team code can't be used, or null when it was found. */
export function teamLookupProblem(l: TeamLookup): string | null {
  switch (l.outcome) {
    case 'found': return null;
    case 'full': return `"${l.projectName ?? 'That team'}" is full (${l.memberCount} of ${l.maxTeamSize} members).`;
    case 'removed':
      return `The owner of "${l.projectName ?? 'that team'}" removed you from it, so you can't rejoin with this code.`;
    case 'teams_not_allowed': return "This session is solo only. Teams aren't allowed.";
    case 'too_many_tries': return "That's a lot of codes that didn't match. Wait 15 minutes and try again.";
    case 'wrong_session':
      return l.sessionTitle == null
        ? 'That code is for a different session.'
        : `That code is for "${l.sessionTitle}", not this session.`;
    default: return "We couldn't find a team with that code. Check it with your teammate.";
  }
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fri, Jan 15 at 3:00 PM" in local time, with the year when it isn't this one. */
export function formatDeadline(d: Date, now = new Date()): string {
  const year = d.getFullYear() === now.getFullYear() ? '' : `, ${d.getFullYear()}`;
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}${year} at ${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}

/** True once a participant deadline (ISO string) has passed. */
export function participationClosed(deadline: string | null | undefined, now = new Date()): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  return !Number.isNaN(d.getTime()) && now.getTime() >= d.getTime();
}

/** The "Add to my day" choices each role gets, in the app's order. */
export type AddMode = 'participate' | 'spectate' | 'expert' | 'manage';

export function addModesForRole(role: string | undefined): AddMode[] {
  switch (role) {
    case 'expert': return ['expert', 'spectate'];
    case 'admin': return ['participate', 'spectate', 'manage'];
    case 'attendee': return ['spectate'];
    default: return ['participate', 'spectate'];
  }
}
