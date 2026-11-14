// Shared mobile catalog, exposed through the existing website model lists.
import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import { disciplineByName } from '../models/disciplines';
import { MOCK_SESSIONS, type Session } from '../models/sessions';
import {
  TRACKS,
  UNIVERSE_TRACKS,
  slugify,
  type TrackInfo,
} from '../models/tracks';
import type { Profile } from './auth';
import { DEFAULT_MAX_TEAM_SIZE, parsePageBlocks, parseQuestions } from '../models/registration';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let version = 0;
let source: 'bundle' | 'database' = 'bundle';
const listeners = new Set<() => void>();

function changed() {
  version++;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders the caller whenever tracks or sessions change. */
export function useSummitContent(): number {
  return useSyncExternalStore(subscribe, () => version);
}

/** Where the lists came from: the bundled sample data or the database. */
export function contentSource(): 'bundle' | 'database' {
  return source;
}

function replaceTracks(next: TrackInfo[]) {
  TRACKS.splice(0, TRACKS.length, ...next);
  for (const key of Object.keys(UNIVERSE_TRACKS)) delete UNIVERSE_TRACKS[key];
  for (const t of next) (UNIVERSE_TRACKS[t.verse] ??= []).push(t.name);
}

function replaceSessions(next: Session[]) {
  MOCK_SESSIONS.splice(0, MOCK_SESSIONS.length, ...next);
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** The shared mobile backend owns this catalog; there is no separate tracks table. */
interface DisciplineRow {
  id: string;
  name: string;
  tagline: string;
}

interface SessionRow {
  id: string;
  discipline_id: string;
  title: string;
  track: string;
  expert_name: string;
  start_time: string;
  end_time: string;
  room: string;
  description: string;
  capacity: number;
  enrolled: number;
  discipline_name?: string | null;
  participant_questions?: unknown;
  max_team_size?: number | null;
  project_prompt?: string | null;
  participant_deadline?: string | null;
  allow_eighth_graders?: boolean | null;
  page_blocks?: unknown;
  hero_image_url?: string | null;
  sponsor?: string | null;
}

/**
 * Whether the shared sessions have the allow_eighth_graders column yet
 * (eighth_grade_participation.sql in the app repo). Until then the editor
 * can't save the box, and 8th graders are kept to spectating.
 */
let eighthGradeColumn = false;
export function hasEighthGradeColumn(): boolean {
  return eighthGradeColumn;
}

export function usesSharedBackend(): boolean {
  return supabase !== null;
}

export function toMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})(?:[:.]\d+)?(?:\s*([AP]M))?$/i.exec(time.trim());
  if (!match) return NaN;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return NaN;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + minute;
}

function clockTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function displayTime(time: string): string {
  const minutes = toMinutes(time);
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

const sessionFromRow = (r: SessionRow): Session => ({
  id: r.id,
  track: r.discipline_id,
  trackName: r.track || r.title,
  title: r.title,
  // The app dropped the free-text expert line; the page lists approved
  // experts who registered (session_experts) instead.
  speaker: '',
  time: displayTime(r.start_time),
  duration: `${Math.max(0, toMinutes(r.end_time) - toMinutes(r.start_time))} min`,
  // Lists show the room; the session page hides it while rooms are locked.
  location: r.room ?? '',
  room: r.room ?? '',
  description: r.description,
  capacity: r.capacity,
  enrolled: r.enrolled,
  // The shared backend counts participants, spectators, and experts against
  // one capacity. It has no separate expert/spectator/volunteer seat quotas.
  expertCapacity: r.capacity,
  expertsEnrolled: r.enrolled,
  spectatorCap: r.capacity,
  spectators: r.enrolled,
  volunteerCapacity: 0,
  volunteersEnrolled: 0,
  disciplineName: r.discipline_name ?? undefined,
  start: clockTime(toMinutes(r.start_time)),
  end: clockTime(toMinutes(r.end_time)),
  questions: parseQuestions(r.participant_questions),
  maxTeamSize: typeof r.max_team_size === 'number' ? r.max_team_size : DEFAULT_MAX_TEAM_SIZE,
  customProjectPrompt: r.project_prompt?.trim() || null,
  participantDeadline: r.participant_deadline ?? null,
  allowEighthGraders: r.allow_eighth_graders === true,
  pageBlocks: parsePageBlocks(r.page_blocks),
  heroImageUrl: r.hero_image_url?.trim() || null,
  sponsor: r.sponsor?.trim() || null,
});

/** Read the same disciplines and session view as the mobile app. */
export async function loadSummitContent(): Promise<void> {
  if (!supabase) return;
  if (source === 'bundle') {
    replaceTracks([]);
    replaceSessions([]);
    source = 'database';
    changed();
  }
  const [disciplines, sessions] = await Promise.all([
    supabase.from('disciplines').select('*').order('sort_order', { ascending: true }),
    supabase.from('sessions_with_counts').select('*').order('start_time', { ascending: true }),
  ]);
  if (disciplines.error || sessions.error) {
    console.warn('Could not load Summit sessions.', disciplines.error ?? sessions.error);
    // A configured shared backend must never present sample seats as live data.
    replaceTracks([]);
    replaceSessions([]);
    source = 'database';
    changed();
    return;
  }
  const rows = (sessions.data ?? []) as SessionRow[];
  if (rows.length > 0) eighthGradeColumn = 'allow_eighth_graders' in rows[0];
  const names = new Set(((disciplines.data ?? []) as DisciplineRow[]).map((d) => d.id));
  const mapped = rows.filter((r) => names.has(r.discipline_id)).map(sessionFromRow);
  const tracks = new Map<string, TrackInfo>();
  for (const session of mapped) {
    const name = session.trackName!;
    const key = `${session.track}:${name}`;
    if (!tracks.has(key)) tracks.set(key, {
      verse: session.track,
      name,
      slug: slugify(name),
      about: session.description,
      ideas: [],
      formats: [],
    });
  }
  replaceTracks([...tracks.values()]);
  replaceSessions(mapped);
  source = 'database';
  changed();
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

/**
 * Mirrors public.can_edit_verse: admins edit everything; volunteers and
 * ambassadors with can_edit_sessions edit their sheet's verses ('*' = all),
 * never keynotes. The database enforces it; this only decides what to show.
 */
export function canEditVerse(profile: Profile | null | undefined, verse: string): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (profile.role !== 'volunteer' && profile.role !== 'ambassador') return false;
  if (!profile.can_edit_sessions || verse === 'keynote') return false;
  const scope = profile.managed_disciplines ?? [];
  return scope.includes('*') || scope.includes(verse);
}

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

/** Where an edit went: the database, or only this browser (no backend configured). */
export type SaveResult = 'saved' | 'local';

/** With no backend configured (tests, offline work) edits stay in this browser. */
function isLocalOnly(): boolean {
  return !supabase;
}

function check<T extends { error: { message: string; code?: string } | null }>(res: T): T {
  if (res.error) {
    // 42501: an insert RLS refused. PGRST116: an update or delete RLS hid
    // the row from, so nothing matched.
    if (res.error.code === '42501' || res.error.code === 'PGRST116') {
      throw new Error("You don't have permission to edit this verse.");
    }
    throw new Error(res.error.message);
  }
  return res;
}

export type SessionInput = Omit<
  Session,
  'id' | 'enrolled' | 'expertsEnrolled' | 'spectators' | 'volunteersEnrolled'
>;

function sessionColumns(s: SessionInput) {
  const start = toMinutes(s.time);
  const durationMatch = /^(\d+)\s*(?:min(?:utes?)?)?$/i.exec(s.duration.trim());
  const duration = durationMatch ? Number(durationMatch[1]) : 0;
  if (!Number.isFinite(start) || duration <= 0 || start + duration >= 24 * 60) {
    throw new Error('Use a valid start time and a positive length in minutes.');
  }
  if (!Number.isInteger(s.capacity) || s.capacity <= 0) {
    throw new Error('Capacity must be a positive number.');
  }
  // Room fields stay out while rooms are locked, matching the mobile editor.
  return {
    discipline_id: s.track,
    title: s.title.trim(),
    expert_name: s.speaker.trim(),
    start_time: clockTime(start),
    end_time: clockTime(start + duration),
    description: s.description.trim(),
    capacity: s.capacity,
  };
}

const newSessionId = () => crypto.randomUUID();

/** Creates a session, or updates the one with `id`. */
export async function saveSession(input: SessionInput, id?: string): Promise<SaveResult> {
  const sessionId = id ?? newSessionId();
  if (isLocalOnly()) {
    const existing = MOCK_SESSIONS.find((s) => s.id === sessionId);
    const next: Session = {
      enrolled: 0,
      expertsEnrolled: 0,
      spectators: 0,
      volunteersEnrolled: 0,
      ...existing,
      ...input,
      trackName: input.trackName || undefined,
      id: sessionId,
    };
    replaceSessions(
      existing
        ? MOCK_SESSIONS.map((s) => (s.id === sessionId ? next : s))
        : [...MOCK_SESSIONS, next],
    );
    changed();
    return 'local';
  }
  const table = supabase!.from('sessions');
  check(
    id
      ? await table.update(sessionColumns(input)).eq('id', id).select('id').single()
      : await table.insert({ id: sessionId, ...sessionColumns(input) }).select('id').single(),
  );
  await loadSummitContent();
  return 'saved';
}

export async function deleteSession(id: string): Promise<SaveResult> {
  if (isLocalOnly()) {
    replaceSessions(MOCK_SESSIONS.filter((s) => s.id !== id));
    changed();
    return 'local';
  }
  check(await supabase!.from('sessions').delete().eq('id', id).select('id').single());
  await loadSummitContent();
  return 'saved';
}

export type TrackInput = Omit<TrackInfo, 'slug'>;

/**
 * Creates a track, or updates the one named `originalName` in that verse.
 * Renaming carries the track's sessions along (on update cascade).
 */
export async function saveTrack(input: TrackInput, originalName?: string): Promise<SaveResult> {
  const name = input.name.trim();
  const clash = TRACKS.some(
    (t) => t.verse === input.verse && t.name === name && t.name !== originalName,
  );
  if (clash) {
    const verse = disciplineByName(input.verse)?.label ?? input.verse;
    throw new Error(`${verse} already has a track called ${name}.`);
  }
  const cleaned: TrackInfo = {
    ...input,
    name,
    slug: slugify(name),
    about: input.about.trim(),
    ideas: input.ideas.map((i) => i.trim()).filter(Boolean),
  };

  if (isLocalOnly()) {
    replaceTracks(
      originalName
        ? TRACKS.map((t) => (t.verse === input.verse && t.name === originalName ? cleaned : t))
        : [...TRACKS, cleaned],
    );
    if (originalName && originalName !== name) {
      replaceSessions(
        MOCK_SESSIONS.map((s) =>
          s.track === input.verse && s.trackName === originalName ? { ...s, trackName: name } : s,
        ),
      );
    }
    changed();
    return 'local';
  }

  throw new Error('Tracks are sessions in the Summit database. Edit the session instead.');
}

/** Deletes a track. One that still has sessions can't be deleted. */
export async function deleteTrack(verse: string, name: string): Promise<SaveResult> {
  if (MOCK_SESSIONS.some((s) => s.track === verse && s.trackName === name)) {
    throw new Error('Move or delete this track\'s sessions first.');
  }
  if (isLocalOnly()) {
    replaceTracks(TRACKS.filter((t) => !(t.verse === verse && t.name === name)));
    changed();
    return 'local';
  }
  throw new Error('Tracks are sessions in the Summit database. Delete the session instead.');
}

// ---------------------------------------------------------------------------
// The app's session editor fields (session_editor_screen.dart)
// ---------------------------------------------------------------------------

/** The columns the app's editor writes. Room and expert are left alone. */
export interface SessionColumns {
  discipline_id: string;
  title: string;
  start_time: string;
  end_time: string;
  capacity: number;
  max_team_size: number;
  participant_deadline: string | null;
  /** Left out until the column exists on the shared backend. */
  allow_eighth_graders?: boolean;
  project_prompt: string | null;
  description: string;
  page_blocks: { title: string; body: string }[];
  participant_questions: { id: string; prompt: string }[];
}

/** How many registrants would clash if the session ran at start–end. 0 on any error. */
export async function previewTimeConflicts(sessionId: string, start: string, end: string): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc('session_time_conflicts', {
    p_session_id: sessionId, p_start: start, p_end: end,
  });
  return error || !Array.isArray(data) ? 0 : data.length;
}

/** Tells the people whose schedule a time change broke. Best-effort. */
export async function notifyTimeConflicts(sessionId: string): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('notify_session_time_conflicts', { p_session_id: sessionId });
}

/** Creates or updates a session with the app's columns, then reloads the catalog. */
export async function saveSessionColumns(columns: SessionColumns, id?: string): Promise<void> {
  if (!supabase) throw new Error('This needs the Summit database.');
  const table = supabase.from('sessions');
  check(
    id
      ? await table.update(columns).eq('id', id).select('id').single()
      : await table.insert({ id: newSessionId(), ...columns }).select('id').single(),
  );
  await loadSummitContent();
}
