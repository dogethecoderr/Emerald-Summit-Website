import { expect, test } from 'vitest';
import { teamLinkHref, teamTextParts, teamTrackMatches } from '../teamLinks';

test('Engineering Exhibits cannot resolve to a presentation or another discipline', () => {
  expect(teamTrackMatches('engineering-exhibits', [
    { id: 'engineering-presentations', title: 'Engineering Presentations', track: 'techverse', trackName: 'Engineering Exhibits' },
    { id: 'unrelated-exhibits', title: 'Engineering Exhibits', track: 'novasphere' },
    { id: 'live-engineering-exhibits', title: 'Engineering Exhibits', track: 'techverse' },
  ]).map((session) => session.id)).toEqual(['live-engineering-exhibits']);
});

test('canonical labels and known aliases resolve to real session IDs', () => {
  expect(teamTrackMatches('computer-science-presentations', [
    { id: 'cs-talks', title: 'Comp Sci Presentations', track: 'techverse' },
    { id: 'cs-exhibits', title: 'Computer Science Exhibits', track: 'techverse' },
  ]).map((session) => session.id)).toEqual(['cs-talks']);
  expect(teamTrackMatches('marketing', [
    { id: 'marketing-id', title: 'Marketing', track: 'ventureverse' },
  ]).map((session) => session.id)).toEqual(['marketing-id']);
});

test('an exact combined track title takes precedence and ambiguous slots remain choices', () => {
  expect(teamTrackMatches('art-literature', [
    { id: 'art-workshop', title: 'Art Workshop', track: 'imaginex' },
    { id: 'art-literature', title: 'Art & Literature', track: 'imaginex' },
  ]).map((session) => session.id)).toEqual(['art-literature']);
  expect(teamTrackMatches('cadathon', [
    { id: 'morning-cad', title: 'CADathon', track: 'techverse' },
    { id: 'afternoon-cad', title: 'CADathon', track: 'techverse' },
  ])).toHaveLength(2);
  expect(teamTrackMatches('cadathon', [])).toEqual([]);
});

test('curated links preserve the paragraph and use the longest matching phrase', () => {
  const text = 'I lead Engineering Exhibits, CADATHON, and more.';
  const parts = teamTextParts(text, [
    { text: 'Engineering Exhibit', target: 'engineering-exhibits' },
    { text: 'Engineering Exhibits', target: 'engineering-exhibits' },
    { text: 'CADathon', target: 'cadathon' },
  ]);
  expect(parts.map((part) => part.text).join('')).toBe(text);
  expect(parts.filter((part) => part.target).map((part) => part.text))
    .toEqual(['Engineering Exhibits', 'CADATHON']);
  const boundaries = teamTextParts('I study epigenetics and lead genetics.', [{ text: 'genetics', target: 'genetics' }]);
  expect(boundaries.filter((part) => part.target).map((part) => part.text)).toEqual(['genetics']);
});

test('discipline affiliations retain discipline navigation while track links use stable aliases', () => {
  expect(teamLinkHref('imaginex')).toBe('/disciplines?verse=imaginex');
  expect(teamLinkHref('cadathon')).toBe('/team/tracks/cadathon');
});

test('the Team runs organizers first, then by discipline, a discipline lead before its track leads', async () => {
  const { TEAM_MEMBERS } = await import('../team');
  const { sortTeam, mainDiscipline } = await import('../teamLinks');
  const sorted = sortTeam(TEAM_MEMBERS);
  const groups = sorted.map((m) => mainDiscipline(m) ?? 'organizers');
  const order = ['organizers', 'techverse', 'ventureverse', 'biosphere', 'novasphere', 'civicverse', 'imaginex'];
  expect(groups.map((g) => order.indexOf(g))).toEqual([...groups.map((g) => order.indexOf(g))].sort((a, b) => a - b));
  expect(sorted[0].role).toBe('Event Organization Lead');
  expect(sorted.length).toBe(TEAM_MEMBERS.length);
});

test('every team photo points at a file in public/', async () => {
  const { existsSync } = await import('node:fs');
  const { TEAM_MEMBERS } = await import('../team');
  const photos = TEAM_MEMBERS.flatMap((m) => (m.photo ? [m.photo] : []));
  expect(photos.length).toBeGreaterThan(0);
  for (const photo of photos) expect(existsSync(`public${photo}`), photo).toBe(true);
});

test('the Team splits into its five sections, each section lead first', async () => {
  const { TEAM_MEMBERS } = await import('../team');
  const { teamSections } = await import('../teamLinks');
  const sections = teamSections(TEAM_MEMBERS);
  expect(sections.map((s) => s.title)).toEqual(['Event Organizers', 'Developers', 'Ambassadors', 'EAF Team', 'Parent Volunteers']);
  expect(sections.flatMap((s) => s.members).length).toBe(TEAM_MEMBERS.length);
  const ambassadors = sections[2].members.map((m) => m.id);
  expect(ambassadors.slice(0, 2).sort()).toEqual(['deep-shah', 'guhan-bala']);
  expect(sections[0].members[0].id).toBe('riddhi-krishnan');
  expect(sections[0].members.every((m) => m.role === 'Event Organization Lead')).toBe(true);
});
