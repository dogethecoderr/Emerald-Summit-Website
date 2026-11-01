// Tracks and sessions, editable in the app by admins and by ambassadors for
// their verses (README: Editing tracks and sessions).
//
// The bundled lists in src/models (TRACKS, UNIVERSE_TRACKS, MOCK_SESSIONS) are
// the live store: loadSummitContent() replaces their contents in place with
// the summit_tracks / summit_sessions tables, and every edit updates them the
// same way. Everything that already reads those lists keeps working; a
// component that should re-render on a change calls useSummitContent().
import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import { disciplineByName } from '../models/disciplines';
import { MOCK_SESSIONS, type Session } from '../models/sessions';
import {
  TRACKS,
  UNIVERSE_TRACKS,
  slugify,
  type TrackFormat,
  type TrackInfo,
} from '../models/tracks';
import { getBypassSession, type Profile } from './auth';

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

interface TrackRow {
  verse: string;
  name: string;
  about: string;
  ideas: string[];
  formats: string[];
  sort_order: number;
}

interface SessionRow {
  id: string;
  verse: string;
  track_name: string | null;
  title: string;
  speaker: string;
  time_slot: string;
  duration: string;
  location: string;
  room: string;
  description: string;
  capacity: number;
  enrolled: number;
  expert_capacity: number;
  experts_enrolled: number;
  spectator_cap: number;
  spectators: number;
  // Absent until the volunteer_spots migration runs.
  volunteer_capacity?: number;
  volunteers_enrolled?: number;
}

const trackFromRow = (r: TrackRow): TrackInfo => ({
  verse: r.verse,
  name: r.name,
  slug: slugify(r.name),
  about: r.about,
  ideas: r.ideas ?? [],
  formats: (r.formats ?? []) as TrackFormat[],
});

const sessionFromRow = (r: SessionRow): Session => ({
  id: r.id,
  track: r.verse,
  trackName: r.track_name ?? undefined,
  title: r.title,
  speaker: r.speaker,
  time: r.time_slot,
  duration: r.duration,
  location: r.location,
  room: r.room,
  description: r.description,
  capacity: r.capacity,
  enrolled: r.enrolled,
  expertCapacity: r.expert_capacity,
  expertsEnrolled: r.experts_enrolled,
  spectatorCap: r.spectator_cap,
  spectators: r.spectators,
  volunteerCapacity: r.volunteer_capacity ?? 2,
  volunteersEnrolled: r.volunteers_enrolled ?? 0,
});

/**
 * Swaps the bundled lists for the database's. With no backend, or before the
 * summit_tracks_sessions migration runs, the bundled lists stay.
 */
export async function loadSummitContent(): Promise<void> {
  if (!supabase) return;
  const [tracks, sessions] = await Promise.all([
    supabase.from('summit_tracks').select('*').order('sort_order').order('name'),
    supabase.from('summit_sessions').select('*'),
  ]);
  if (tracks.error || sessions.error) {
    console.warn('Using the bundled tracks and sessions.', tracks.error ?? sessions.error);
    return;
  }
  replaceTracks((tracks.data as TrackRow[]).map(trackFromRow));
  replaceSessions((sessions.data as SessionRow[]).map(sessionFromRow));
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

/** Where an edit went: the database, or only this browser (demo mode). */
export type SaveResult = 'saved' | 'local';

/**
 * Demo and other local sessions have no credentials RLS can check, so their
 * edits change this browser's copy only and never reach the database.
 */
function isLocalOnly(): boolean {
  return getBypassSession() != null || !supabase;
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
  return {
    verse: s.track,
    track_name: s.trackName || null,
    title: s.title.trim(),
    speaker: s.speaker.trim(),
    time_slot: s.time,
    duration: s.duration.trim(),
    location: s.location.trim(),
    room: s.room.trim(),
    description: s.description.trim(),
    capacity: s.capacity,
    expert_capacity: s.expertCapacity,
    spectator_cap: s.spectatorCap,
    volunteer_capacity: s.volunteerCapacity,
  };
}

const newSessionId = () => `s-${Math.random().toString(36).slice(2, 12)}`;

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
  const table = supabase!.from('summit_sessions');
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
  check(await supabase!.from('summit_sessions').delete().eq('id', id).select('id').single());
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

  const columns = {
    verse: cleaned.verse,
    name: cleaned.name,
    about: cleaned.about,
    ideas: cleaned.ideas,
    formats: cleaned.formats,
  };
  const table = supabase!.from('summit_tracks');
  if (originalName) {
    check(
      await table
        .update(columns)
        .eq('verse', input.verse)
        .eq('name', originalName)
        .select('name')
        .single(),
    );
  } else {
    const last = TRACKS.filter((t) => t.verse === input.verse).length;
    check(await table.insert({ ...columns, sort_order: 1000 + last }).select('name').single());
  }
  await loadSummitContent();
  return 'saved';
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
  check(
    await supabase!
      .from('summit_tracks')
      .delete()
      .eq('verse', verse)
      .eq('name', name)
      .select('name')
      .single(),
  );
  await loadSummitContent();
  return 'saved';
}
