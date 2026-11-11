// The participant's project on the session page: solo, or their team with its
// code and members (the app's _ProjectCard in session_detail_screen.dart).
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Copy, LogOut, User, UserX, Users } from '@/components/icons';
import { mustHandOff, teamsAllowed, type MyProject, type TeamMember } from '../../models/registration';

export function TeamCodeChip({ code }: { code: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-1.5">
      <span className="select-all font-display text-2xl font-bold tracking-[0.12em] text-emerald">{code}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Copy team code"
        onClick={() => {
          void navigator.clipboard?.writeText(code)
            .then(() => toast.success(`Copied team code ${code}`))
            .catch(() => toast.error("Couldn't copy the code. Select it and copy it instead."));
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function ProjectCard({
  project: p,
  onLeave,
  onTransfer,
  onRemoveMember,
}: {
  project: MyProject | null;
  onLeave: () => void;
  onTransfer: () => void;
  onRemoveMember: (member: TeamMember) => void;
}) {
  const Icon = p == null ? User : p.isTeam ? Users : User;
  return (
    <section className="rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-5 w-5 text-emerald" />
        {p == null ? 'Your project' : p.isTeam ? 'Team project' : 'Solo project'}
      </div>
      {p == null ? (
        <p className="mt-2 text-sm">
          Let the organizers know whether you're working solo or on a team, and what your project is.
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-lg font-semibold">{p.projectName}</p>
          {p.isTeam && p.teamCode && (
            <div className="space-y-1.5">
              <TeamCodeChip code={p.teamCode} />
              <p className="text-xs text-muted-foreground">
                Share this code with teammates so they can join when they register for this session.
              </p>
            </div>
          )}
          {p.isTeam && p.members.length > 0 && (
            <div>
              <p className="text-sm font-semibold">Members</p>
              <ul className="mt-1 space-y-1">
                {p.members.map((m) => (
                  <li key={m.id || m.name} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1">{m.isOwner ? `${m.name} · Owner` : m.name}</span>
                    {p.isOwner && !m.isOwner && m.id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${m.name} from the team`}
                        className="h-8 w-8 text-destructive"
                        onClick={() => onRemoveMember(m)}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {teamsAllowed(p.maxTeamSize) && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  The max number of members your team can have is {p.maxTeamSize}.
                </p>
              )}
            </div>
          )}
          {p.isTeam && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onLeave}>
                <LogOut className="h-4 w-4" /> Leave team / go solo
              </Button>
              {mustHandOff(p) && (
                <Button type="button" variant="ghost" size="sm" onClick={onTransfer}>
                  <Users className="h-4 w-4" /> Transfer ownership
                </Button>
              )}
            </div>
          )}
          {!p.isTeam && teamsAllowed(p.maxTeamSize) && (
            <p className="text-xs text-muted-foreground">
              Teaming up later? Edit your registration to create or join a team.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
