// Counting helpers for the admin and session metrics, ported from the app's
// lib/models/metrics.dart.
import { canonicalSchoolName } from './schools';
import type { ParticipationType } from './registration';

export const NO_SCHOOL_LABEL = 'No school given';
export const NO_GRADE_LABEL = 'No grade given';

/** A grade answer reduced to "9" to "12", "Other", or NO_GRADE_LABEL. */
export function gradeLabel(raw: string | number | null | undefined): string {
  const s = raw == null ? '' : String(raw).trim().toLowerCase();
  if (!s) return NO_GRADE_LABEL;
  const words: Record<string, string> = { freshman: '9', sophomore: '10', junior: '11', senior: '12', eighth: '8' };
  for (const [word, grade] of Object.entries(words)) if (s.includes(word)) return grade;
  const n = Number(/\d+/.exec(s)?.[0]);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return String(n);
  return 'Other';
}

/** Grade columns in reading order: numbers, then Other, then blank. */
export function compareGrades(a: string, b: string): number {
  const rank = (g: string) => {
    const n = Number(g);
    if (g !== '' && Number.isInteger(n)) return n;
    return g === 'Other' ? 100 : g === NO_GRADE_LABEL ? 101 : 99;
  };
  return rank(a) - rank(b);
}

export function schoolLabel(raw: string | null | undefined): string {
  return canonicalSchoolName(raw) ?? NO_SCHOOL_LABEL;
}

export interface MetricsPerson {
  id: string;
  role: string;
  school: string;
  grade: string;
}

export interface MetricsRegistration {
  userId: string;
  sessionId: string;
  disciplineId: string;
  disciplineName: string;
  type: ParticipationType;
}

export interface SummitMetrics {
  people: MetricsPerson[];
  registrations: MetricsRegistration[];
}

export function summitMetricsFrom(raw: Record<string, unknown> | null): SummitMetrics {
  const list = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
  return {
    people: list(raw?.people).map((m) => ({
      id: String(m.id),
      role: String(m.role ?? 'participant'),
      school: schoolLabel(typeof m.school === 'string' ? m.school : null),
      grade: gradeLabel(m.grade as string | number | null | undefined),
    })),
    registrations: list(raw?.registrations).map((m) => ({
      userId: String(m.user_id),
      sessionId: String(m.session_id),
      disciplineId: String(m.discipline_id),
      disciplineName: String(m.discipline_name ?? m.discipline_id),
      type: (m.participation_type === 'spectator' || m.participation_type === 'expert'
        ? m.participation_type : 'participant') as ParticipationType,
    })),
  };
}

/** Distinct people per label, largest first, `last` at the end. */
export function countBy(
  labelAndPerson: Iterable<[string, string]>,
  opts: { last?: string; compare?: (a: string, b: string) => number } = {},
): [string, number][] {
  const people = new Map<string, Set<string>>();
  for (const [label, id] of labelAndPerson) {
    if (!people.has(label)) people.set(label, new Set());
    people.get(label)!.add(id);
  }
  const out: [string, number][] = [...people].map(([k, v]) => [k, v.size]);
  out.sort((a, b) => {
    if (opts.compare) return opts.compare(a[0], b[0]);
    if (a[0] === opts.last) return 1;
    if (b[0] === opts.last) return -1;
    return b[1] - a[1] || a[0].localeCompare(b[0]);
  });
  return out;
}

/** Distinct people per (row, column), e.g. schools × disciplines. */
export interface CrossTab {
  rows: string[];
  columns: string[];
  count: (row: string, column: string) => number;
  rowTotals: Map<string, number>;
  columnTotals: Map<string, number>;
  total: number;
  maxCell: number;
}

export function crossTab(
  facts: Iterable<[string, string, string]>,
  columns: string[],
  lastRow?: string,
): CrossTab {
  const cells = new Map<string, Set<string>>();
  const rowPeople = new Map<string, Set<string>>();
  const colPeople = new Map<string, Set<string>>();
  const everyone = new Set<string>();
  const add = (m: Map<string, Set<string>>, k: string, id: string) => {
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(id);
  };
  for (const [row, col, id] of facts) {
    add(cells, `${row}\u0000${col}`, id);
    add(rowPeople, row, id);
    add(colPeople, col, id);
    everyone.add(id);
  }
  const rows = [...rowPeople.keys()].sort((a, b) => {
    if (a === lastRow) return 1;
    if (b === lastRow) return -1;
    return rowPeople.get(b)!.size - rowPeople.get(a)!.size || a.localeCompare(b);
  });
  const sizes = (m: Map<string, Set<string>>) => new Map([...m].map(([k, v]) => [k, v.size]));
  const cellSizes = sizes(cells);
  return {
    rows,
    columns: [...columns.filter((c) => colPeople.has(c)), ...[...colPeople.keys()].filter((c) => !columns.includes(c))],
    count: (row, column) => cellSizes.get(`${row}\u0000${column}`) ?? 0,
    rowTotals: sizes(rowPeople),
    columnTotals: sizes(colPeople),
    total: everyone.size,
    maxCell: Math.max(0, ...cellSizes.values()),
  };
}
