import { Link, useLocation } from 'react-router-dom';
import type { TeamMention } from '../models/team';
import { TEAM_TARGETS, teamLinkHref, teamTextParts } from '../models/teamLinks';

export default function TeamLinkedText({ text, mentions }: {
  text: string;
  mentions: readonly TeamMention[];
}) {
  const { pathname } = useLocation();
  const inPortal = pathname === '/summit-27/team';
  const teamReturnTo = inPortal ? pathname : '/lineup';
  // /disciplines needs sign-in, so on the public page a discipline opens the landing page's Disciplines section.
  const publicDiscipline = (key: keyof typeof TEAM_TARGETS) => !inPortal && TEAM_TARGETS[key].kind === 'discipline';
  return (
    <>
      {teamTextParts(text, mentions).map((part, index) => part.target ? (
        <Link
          key={index}
          to={publicDiscipline(part.target) ? '/' : teamLinkHref(part.target)}
          state={publicDiscipline(part.target) ? { scrollTo: 'disciplines' } : { teamReturnTo }}
          className="text-emerald underline decoration-emerald/40 underline-offset-2 hover:decoration-emerald focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {part.text}
        </Link>
      ) : part.text)}
    </>
  );
}
