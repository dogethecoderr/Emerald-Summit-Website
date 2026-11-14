// Disciplines for the Emerald Summit web prototype. Mirrors the disciplines
// used in the separate Emerald Summit Flutter app so the two stay aligned.

export interface DisciplineInfo {
  name: string;
  label: string;
  description: string;
  color: string;
}

export const USER_DISCIPLINES: DisciplineInfo[] = [
  {
    name: 'techverse',
    label: 'TechVerse',
    description: 'Technology & Engineering',
    color: '#3B82F6',
  },
  {
    name: 'biosphere',
    label: 'BioSphere',
    description: 'Life Sciences & Environment',
    color: '#14B8A6',
  },
  {
    name: 'imaginex',
    label: 'ImagineX',
    description: 'Arts, Literature, Music, Drama & Improv',
    color: '#E11D48',
  },
  {
    name: 'novasphere',
    label: 'NovaSphere',
    description: 'Core Sciences, Climate Change & Sustainability',
    color: '#7C3AED',
  },
  {
    name: 'ventureverse',
    label: 'VentureVerse',
    description: 'Entrepreneurship & Marketing',
    color: '#F59E0B',
  },
  {
    name: 'civicverse',
    label: 'CivicVerse',
    description: 'Mock Trial, Government Policy & Rights',
    color: '#F97316',
  },
];

export function disciplineByName(
  name: string | undefined | null,
): DisciplineInfo | undefined {
  if (!name) return undefined;
  return USER_DISCIPLINES.find((d) => d.name === name);
}
