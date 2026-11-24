import { TEAM_MEMBERS } from '../models/team';
import { mainDiscipline, sortTeam } from '../models/teamLinks';
import { vibeFor } from '../models/verseVibes';
import { useTheme } from '../context/ThemeContext';
import TeamLinkedText from './TeamLinkedText';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

const TEAM = sortTeam(TEAM_MEMBERS);

export const TEAM_INTRO = 'Meet the students and organizers behind Emerald Summit ’27.';

/** Shared profiles for the public Team section and the signed-in Team tab. */
export default function TeamDirectory() {
  const { theme } = useTheme();
  // Each discipline's own accent (the deeper light-theme one on light cards); organizers get the Summit's emerald.
  const accent = (discipline: string | null) => vibeFor(discipline, theme).accent;
  // Roles are plain text; track and discipline links live in the bios only.
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{TEAM_INTRO}</p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Summit team">
        {TEAM.map((member) => (
          <li key={member.id} className="min-w-0">
            <article className="h-full space-y-4 rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {member.photo && <AvatarImage src={member.photo} alt={member.name} className="object-cover" />}
                  {/* Also shown while a photo loads or if it fails. */}
                  <AvatarFallback aria-label="No photo yet">
                    <svg viewBox="0 0 64 64" className="h-full w-full text-muted-foreground/40" aria-hidden="true">
                      <circle cx="32" cy="24" r="11" fill="currentColor" />
                      <path d="M10 60c0-12 10-20 22-20s22 8 22 20z" fill="currentColor" />
                    </svg>
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-2">
                  <h3 className="break-words font-display text-xl font-semibold leading-snug">{member.name}</h3>
                  <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-emerald" style={{ color: accent(mainDiscipline(member)) }}>
                    {member.role}
                  </p>
                </div>
              </div>
              <p className="break-words text-[15px] leading-relaxed text-muted-foreground">
                <TeamLinkedText text={member.bio} mentions={member.mentions} />
              </p>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
