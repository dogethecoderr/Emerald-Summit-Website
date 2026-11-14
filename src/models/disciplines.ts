// The Summit's disciplines. The live list is the shared `disciplines` table
// (loadSummitContent replaces this array with it, in its sort_order, as the
// app does); the six below are only the bundled fallback before it loads or
// with no backend. A discipline an admin adds shows up on Discover.

export interface DisciplineInfo {
  /** The row id, e.g. 'techverse'. */
  name: string;
  label: string;
  /** The row's tagline. */
  description: string;
  color: string;
  /** The app's icon key (disciplineIcon() in its models.dart), e.g. 'gavel'. */
  icon?: string;
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

/** The six keep their colors; a new discipline gets emerald, like the app. */
const KNOWN_COLORS: Record<string, string> = Object.fromEntries(USER_DISCIPLINES.map((d) => [d.name, d.color]));
export const NEW_DISCIPLINE_COLOR = '#10B981';

export interface DisciplineRow {
  id: string;
  name: string;
  tagline?: string | null;
  icon?: string | null;
}

/** Swaps in the database's disciplines, already in sort_order. */
export function replaceDisciplines(rows: DisciplineRow[]): void {
  USER_DISCIPLINES.splice(0, USER_DISCIPLINES.length, ...rows.map((r) => ({
    name: r.id,
    label: r.name,
    description: (r.tagline ?? '').trim(),
    color: KNOWN_COLORS[r.id] ?? NEW_DISCIPLINE_COLOR,
    icon: r.icon ?? 'category',
  })));
}

/** The icon keys the app's discipline editor offers, in its order. */
export const DISCIPLINE_ICON_KEYS = [
  'terminal', 'precision_manufacturing', 'biotech', 'rocket_launch',
  'palette', 'functions', 'science', 'public', 'psychology', 'music_note',
  'engineering', 'calculate', 'gavel', 'lightbulb', 'trending_up',
  'category',
] as const;

/** "six" for 6, so headings read like the old fixed copy. */
export function countWord(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] ?? String(n);
}

export function disciplineByName(
  name: string | undefined | null,
): DisciplineInfo | undefined {
  if (!name) return undefined;
  return USER_DISCIPLINES.find((d) => d.name === name);
}
