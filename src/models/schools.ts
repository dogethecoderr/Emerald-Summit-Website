// Tri-Valley high schools offered at sign-up, ported from the app's
// lib/models/schools.dart. The stored value (profiles.details.school) is the
// school's name, or the typed name for "Other".

export interface TriValleySchool {
  name: string;
  city: string;
  /** Other ways people write it (lowercase), so "Cal High" counts as California High. */
  aliases?: string[];
}

export const TRI_VALLEY_SCHOOLS: TriValleySchool[] = [
  { name: 'Amador Valley High School', city: 'Pleasanton', aliases: ['avhs', 'amador'] },
  { name: 'California High School', city: 'San Ramon', aliases: ['cal high', 'cal'] },
  { name: 'Del Amigo High School', city: 'Danville' },
  { name: 'Del Valle High School', city: 'Livermore' },
  { name: 'Dougherty Valley High School', city: 'San Ramon', aliases: ['dvhs', 'dougherty'] },
  { name: 'Dublin High School', city: 'Dublin', aliases: ['dhs'] },
  { name: 'Emerald High School', city: 'Dublin', aliases: ['ehs', 'pehs'] },
  { name: 'Foothill High School', city: 'Pleasanton', aliases: ['fhs'] },
  { name: 'Granada High School', city: 'Livermore', aliases: ['ghs'] },
  { name: 'Livermore High School', city: 'Livermore', aliases: ['lhs'] },
  { name: 'Livermore Valley Charter Preparatory', city: 'Livermore', aliases: ['lvcp', 'livermore valley charter prep'] },
  { name: 'Monte Vista High School', city: 'Danville', aliases: ['mvhs', 'monte vista'] },
  { name: 'San Ramon Valley High School', city: 'Danville', aliases: ['srvhs'] },
  { name: 'The Athenian School', city: 'Danville', aliases: ['athenian'] },
  { name: 'The Quarry Lane School', city: 'Dublin', aliases: ['quarry lane'] },
  { name: 'Valley Christian High School', city: 'Dublin', aliases: ['valley christian'] },
  { name: 'Valley High School', city: 'Dublin' },
  { name: 'Village High School', city: 'Pleasanton' },
];

function schoolKey(raw: string): string {
  let s = raw.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.startsWith('the ')) s = s.slice(4);
  for (const suffix of [' high school', ' high', ' school', ' hs']) {
    if (s.endsWith(suffix)) {
      s = s.slice(0, -suffix.length);
      break;
    }
  }
  return s.trim();
}

/** The listed school a typed answer refers to, or null. */
export function matchTriValleySchool(raw: string | null | undefined): TriValleySchool | null {
  if (!raw || !raw.trim()) return null;
  const key = schoolKey(raw);
  const lower = raw.trim().toLowerCase();
  return TRI_VALLEY_SCHOOLS.find((s) =>
    schoolKey(s.name) === key || s.aliases?.includes(lower) || s.aliases?.includes(key),
  ) ?? null;
}

/** The name to count an answer under: the listed name, or the typed one tidied up. */
export function canonicalSchoolName(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const listed = matchTriValleySchool(raw);
  if (listed) return listed.name;
  const small = new Set(['of', 'the', 'and', 'at', 'for', 'in']);
  return raw.trim().split(/\s+/).map((w, i) => {
    if (w.length <= 4 && w.toUpperCase() === w) return w;
    if (i > 0 && small.has(w.toLowerCase())) return w.toLowerCase();
    return w[0].toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}
