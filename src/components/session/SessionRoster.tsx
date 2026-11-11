// A session's people, grouped under their project like the app's
// session_roster_screen.dart: teams (owner first), then solo projects, then
// participants who haven't shared a project, then spectators and experts.
// Admins and the session's managers mark attendance; editors only look.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { Session } from '../../models/sessions';
import { CHIP_LABEL, DEFAULT_MAX_TEAM_SIZE, type ParticipationType } from '../../models/registration';
import { gradeLabel, NO_GRADE_LABEL } from '../../models/metrics';
import { canonicalSchoolName } from '../../models/schools';
import { fetchSessionRoster, markSessionAttendance, type RosterEntry } from '../../services/organizer';

interface Group {
  title: string;
  detail?: string;
  owner?: string;
  members: RosterEntry[];
  isProject: boolean;
  isTeam: boolean;
}

const byName = (a: RosterEntry, b: RosterEntry) => a.name.toLowerCase().localeCompare(b.name.toLowerCase());

export function groupRoster(roster: RosterEntry[], maxTeamSize: number): Group[] {
  if (!roster.some((e) => e.type === 'participant')) return [];
  const teams = new Map<string, RosterEntry[]>();
  const projects: Group[] = [];
  const unshared: RosterEntry[] = [];
  const spectators: RosterEntry[] = [];
  const experts: RosterEntry[] = [];
  for (const e of roster) {
    if (e.type === 'spectator') spectators.push(e);
    else if (e.type === 'expert') experts.push(e);
    else if (e.isTeam === true && e.teamId) {
      if (!teams.has(e.teamId)) teams.set(e.teamId, []);
      teams.get(e.teamId)!.push(e);
    } else if (e.isTeam === false) {
      projects.push({ title: e.projectName || 'Untitled project', detail: 'Solo', members: [e], isProject: true, isTeam: false });
    } else unshared.push(e);
  }
  for (const members of teams.values()) {
    const first = members[0];
    members.sort((a, b) => (a.isTeamOwner !== b.isTeamOwner ? (a.isTeamOwner ? -1 : 1) : byName(a, b)));
    const owner = members[0].isTeamOwner ? members[0] : null;
    const n = members.length;
    projects.push({
      title: first.projectName || 'Untitled project',
      detail: `Team ${first.teamCode ?? ''} · ${maxTeamSize >= 2 ? `${n}/${maxTeamSize}` : n} member${n === 1 && maxTeamSize < 2 ? '' : 's'}`,
      owner: owner ? owner.name || owner.email : undefined,
      members,
      isProject: true,
      isTeam: true,
    });
  }
  projects.sort((a, b) => (a.isTeam !== b.isTeam ? (a.isTeam ? -1 : 1) : a.title.toLowerCase().localeCompare(b.title.toLowerCase())));
  return [
    ...projects,
    ...(unshared.length ? [{ title: 'Project not shared yet', detail: 'Registered before the team question, or still deciding', members: unshared, isProject: false, isTeam: false }] : []),
    ...(spectators.length ? [{ title: 'Spectators', members: spectators, isProject: false, isTeam: false }] : []),
    ...(experts.length ? [{ title: 'Experts', members: experts, isProject: false, isTeam: false }] : []),
  ];
}

export default function SessionRoster({
  session,
  types,
  canMarkAttendance,
  emptyMessage,
}: {
  session: Session;
  types: ParticipationType[];
  canMarkAttendance: boolean;
  emptyMessage: string;
}) {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchSessionRoster(session.id)
      .then((all) => setRoster(all.filter((e) => types.includes(e.type))))
      .catch(() => setError("Couldn't load this session's people. Try again."));
    // types is a fixed list per tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);
  useEffect(load, [load]);

  const toggle = async (entry: RosterEntry, attended: boolean) => {
    setRoster((r) => r?.map((e) => (e.userId === entry.userId ? { ...e, attended } : e)) ?? r);
    try {
      await markSessionAttendance(session.id, entry.userId, attended);
    } catch {
      setRoster((r) => r?.map((e) => (e.userId === entry.userId ? { ...e, attended: !attended } : e)) ?? r);
      toast.error('Could not save attendance.');
    }
  };

  if (error) {
    return (
      <div className="space-y-3 py-6 text-sm">
        <p role="alert" className="text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>Try again</Button>
      </div>
    );
  }
  if (!roster) return <div className="space-y-3 py-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>;

  const present = roster.filter((e) => e.attended).length;
  const groups = groupRoster(roster, session.maxTeamSize ?? DEFAULT_MAX_TEAM_SIZE);
  const projectCount = groups.filter((g) => g.isProject).length;
  const prompts = Object.fromEntries((session.questions ?? []).map((q) => [q.id, q.prompt]));

  const row = (e: RosterEntry) => {
    const school = canonicalSchoolName(e.details.school);
    const grade = gradeLabel(e.details.grade);
    return (
      <li key={e.userId} className="flex items-start gap-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{e.name || e.email}</p>
          <p className="text-xs text-muted-foreground">
            {[e.attended ? 'Present' : 'Not marked', CHIP_LABEL[e.type], e.isTeamOwner ? 'Team owner' : null].filter(Boolean).join(' · ')}
          </p>
          {(school || grade !== NO_GRADE_LABEL) && (
            <p className="text-xs text-muted-foreground">
              {[school, grade !== NO_GRADE_LABEL ? `Grade ${grade}` : null].filter(Boolean).join(' · ')}
            </p>
          )}
          {Object.entries(e.answers).map(([id, answer]) => (
            <p key={id} className="text-xs text-muted-foreground">{prompts[id] ?? 'Answer'}: {answer}</p>
          ))}
          {e.email && e.name && <a href={`mailto:${e.email}`} className="text-xs text-emerald hover:underline">{e.email}</a>}
        </div>
        {canMarkAttendance && (
          <Switch
            checked={e.attended}
            aria-label={`${e.name || e.email} is present`}
            onCheckedChange={(v) => void toggle(e, v)}
          />
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4 py-2">
      <p className="text-sm text-muted-foreground">
        {present} / {roster.length} present{projectCount > 0 ? ` · ${projectCount} project${projectCount === 1 ? '' : 's'}` : ''}
      </p>
      {!canMarkAttendance && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          View only. Attendance is marked by the volunteers assigned to this session.
        </p>
      )}
      {roster.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : groups.length === 0 ? (
        <ul className="divide-y divide-border">{[...roster].sort(byName).map(row)}</ul>
      ) : (
        groups.map((g) => (
          <section key={`${g.title}-${g.members[0].userId}`} className="rounded-2xl border border-border px-4 py-3">
            <h3 className="font-semibold">{g.title}</h3>
            <p className="text-xs text-emerald">
              {[g.detail, `${g.members.filter((m) => m.attended).length}/${g.members.length} present`].filter(Boolean).join(' · ')}
            </p>
            {g.owner && <p className="text-xs font-semibold text-emerald">Owner: {g.owner}</p>}
            <ul className="mt-1 divide-y divide-border">{g.members.map(row)}</ul>
          </section>
        ))
      )}
    </div>
  );
}
