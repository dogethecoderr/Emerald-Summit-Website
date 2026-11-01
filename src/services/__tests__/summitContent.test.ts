import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { Profile } from '../auth';

// No backend: every edit takes the local path a demo session uses.
vi.mock('../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));

const content = await import('../summitContent');
const { MOCK_SESSIONS } = await import('../../models/sessions');
const { TRACKS, tracksForUniverse } = await import('../../models/tracks');

const base: Profile = { id: 'u1', email: 'a@example.com', profile_setup_complete: true };

describe('canEditVerse', () => {
  test('admins edit every verse and keynotes', () => {
    const admin = { ...base, role: 'admin' };
    expect(content.canEditVerse(admin, 'techverse')).toBe(true);
    expect(content.canEditVerse(admin, 'keynote')).toBe(true);
  });

  test('an ambassador with the permission edits only their verses, never keynotes', () => {
    const ambassador: Profile = {
      ...base,
      role: 'volunteer',
      volunteer_subtype: 'eaf_ambassador',
      can_edit_sessions: true,
      managed_disciplines: ['biosphere'],
    };
    expect(content.canEditVerse(ambassador, 'biosphere')).toBe(true);
    expect(content.canEditVerse(ambassador, 'techverse')).toBe(false);
    expect(content.canEditVerse(ambassador, 'keynote')).toBe(false);
    expect(content.canEditVerse({ ...ambassador, managed_disciplines: ['*'] }, 'techverse')).toBe(true);
  });

  test('no permission, no editing', () => {
    expect(content.canEditVerse({ ...base, role: 'volunteer', managed_disciplines: ['*'] }, 'techverse')).toBe(false);
    expect(content.canEditVerse({ ...base, role: 'participant' }, 'techverse')).toBe(false);
    expect(content.canEditVerse(null, 'techverse')).toBe(false);
  });
});

describe('local edits', () => {
  beforeEach(() => localStorage.clear());

  test('adds, edits, and deletes a session in place', async () => {
    const before = MOCK_SESSIONS.length;
    const input = {
      track: 'techverse',
      trackName: 'Engineering',
      title: 'Bridge Build',
      speaker: 'Mentors',
      time: '1:00 PM',
      duration: '45 min',
      location: 'Gym',
      room: 'B',
      description: '',
      capacity: 20,
      expertCapacity: 2,
      spectatorCap: 5,
    };
    expect(await content.saveSession(input)).toBe('local');
    const added = MOCK_SESSIONS.find((s) => s.title === 'Bridge Build')!;
    expect(added).toMatchObject({ enrolled: 0, capacity: 20 });
    expect(MOCK_SESSIONS).toHaveLength(before + 1);

    await content.saveSession({ ...input, title: 'Bridge Build 2' }, added.id);
    expect(MOCK_SESSIONS.find((s) => s.id === added.id)?.title).toBe('Bridge Build 2');

    await content.deleteSession(added.id);
    expect(MOCK_SESSIONS).toHaveLength(before);
  });

  test('renaming a track carries its sessions along', async () => {
    const track = TRACKS.find((t) => t.verse === 'techverse' && t.name === 'Robothon')!;
    await content.saveTrack({ ...track, name: 'Robot Rally' }, 'Robothon');
    expect(tracksForUniverse('techverse')).toContain('Robot Rally');
    expect(tracksForUniverse('techverse')).not.toContain('Robothon');
    expect(MOCK_SESSIONS.some((s) => s.trackName === 'Robothon')).toBe(false);
    expect(MOCK_SESSIONS.some((s) => s.trackName === 'Robot Rally')).toBe(true);
  });

  test('a track with sessions cannot be deleted; an empty one can', async () => {
    await expect(content.deleteTrack('techverse', 'Engineering')).rejects.toThrow(/sessions first/);
    await content.saveTrack({ verse: 'techverse', name: 'Drones', about: '', ideas: [], formats: ['Workshop'] });
    expect(tracksForUniverse('techverse')).toContain('Drones');
    await content.deleteTrack('techverse', 'Drones');
    expect(tracksForUniverse('techverse')).not.toContain('Drones');
  });

  test('refuses a duplicate track name in the same verse', async () => {
    await expect(
      content.saveTrack({ verse: 'techverse', name: 'Engineering', about: '', ideas: [], formats: [] }),
    ).rejects.toThrow(/already has a track/);
  });
});
