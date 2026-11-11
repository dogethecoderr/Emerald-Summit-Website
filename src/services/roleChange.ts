// Changing role on an existing account, the way the app's Profile → Change
// role does it: preview what happens to each session (preview_role_change),
// then save the role and re-read what the server kept. The server moves
// sessions down to spectating and refuses gated roles off the allowlist.
import { supabase } from '../lib/supabase';
import { notEligibleMessage } from '../models/roles';
import { profileFromRow, storedRole, type Profile } from './auth';

export interface RoleChangeTeam {
  action: string;
  projectName: string;
  toName: string | null;
  code: string | null;
}

export interface RoleChangeItem {
  sessionId: string;
  title: string;
  /** participant, expert or managing */
  from: string;
  /** spectator, dropped or unchanged */
  to: string;
  team: RoleChangeTeam | null;
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export async function previewRoleChange(role: string): Promise<RoleChangeItem[]> {
  const { data, error } = await client().rpc('preview_role_change', { p_role: storedRole(role) });
  if (error) throw error;
  return ((data as Record<string, any>[] | null) ?? []).map((m) => ({
    sessionId: String(m.session_id),
    title: m.title ?? '',
    from: m.from ?? '',
    to: m.to ?? 'spectator',
    team: m.team == null ? null : {
      action: m.team.action ?? 'left',
      projectName: m.team.project_name ?? '',
      toName: m.team.to_name ?? null,
      code: m.team.code ?? null,
    },
  }));
}

/** Port of the app's describeRoleChange: one plain sentence per session. */
export function describeRoleChange(c: RoleChangeItem): string {
  const title = `"${c.title}"`;
  let base: string;
  if (c.from === 'managing' && c.to === 'dropped') {
    base = `${title}: you'll stop managing it. It's full, so it will be removed from your day.`;
  } else if (c.from === 'managing' && c.to === 'unchanged') {
    base = `${title}: you'll stop managing it. You stay registered for it.`;
  } else if (c.from === 'managing') {
    base = `${title}: you'll stop managing it and spectate instead.`;
  } else if (c.from === 'expert') {
    base = `${title}: you'll go from serving as an expert to spectating.`;
  } else {
    base = `${title}: you'll go from participating to spectating.`;
  }
  const team = c.team;
  if (!team) return base;
  const project = `"${team.projectName}"`;
  if (team.action === 'handed_off') return `${base} Your team ${project} goes to ${team.toName ?? 'a teammate'}.`;
  if (team.action === 'deleted') {
    return `${base} Nobody else has joined your team ${project}, so it will be deleted and its code ${team.code ? `${team.code} ` : ''}will stop working.`;
  }
  return `${base} You'll leave the team ${project}.`;
}

const PLURAL: Record<string, string> = {
  participant: 'participants',
  expert: 'experts',
  attendee: 'parents and spectators',
  volunteer: 'volunteers',
  admin: 'admins',
};

/** The app's lead-in line above the list of session changes. */
export function roleChangeLeadIn(role: string, label: string): string {
  return role === 'attendee'
    ? `As a ${label}, you can only spectate. These sessions change:`
    : `Some of your sessions change, because ${PLURAL[role] ?? `${label.toLowerCase()}s`} can't take part in them the way you do now:`;
}

/** Saves the new role and returns the profile the server kept. */
export async function changeRole(role: string): Promise<Profile> {
  const c = client();
  const { data: auth } = await c.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw new Error('Not signed in.');
  const { data, error } = await c.from('profiles')
    .update({ role: storedRole(role), updated_at: new Date().toISOString() })
    .eq('id', userId).select('*').single();
  if (error || !data) throw new Error('Could not save your profile. Please try again.');
  if (data.role !== storedRole(role)) throw new Error(notEligibleMessage(role));
  return profileFromRow(data);
}
