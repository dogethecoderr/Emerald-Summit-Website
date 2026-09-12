import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  attachmentTypeForFile,
  formatBytes,
  type Announcement,
} from '../../models/announcements';

// No Supabase configured: exercises the local fallback path that bypass
// sign-in and an unconfigured deploy both land on.
vi.mock('../../lib/supabase', () => ({ supabase: null }));

const {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  setAnnouncementPinned,
  sortAnnouncements,
  isBackendConfigured,
} = await import('../announcements');

const draft = {
  title: 'Buses leave at 4',
  body: 'Meet by the gym doors.',
  category: 'Logistics' as const,
  audience: 'Everyone',
  pinned: false,
  attachments: [],
};

const author = { id: 'admin-1', name: 'Summit Admin' };

describe('announcements service (local fallback)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('reports the backend as unconfigured when there is no client', () => {
    expect(isBackendConfigured()).toBe(false);
  });

  test('creates an announcement and reads it back', async () => {
    const created = await createAnnouncement(draft, author);
    expect(created.title).toBe('Buses leave at 4');
    expect(created.author).toBe('Summit Admin');

    const { announcements, source } = await fetchAnnouncements();
    expect(source).toBe('local');
    expect(announcements.some((a) => a.id === created.id)).toBe(true);
  });

  test('edits persist to the stored feed', async () => {
    const created = await createAnnouncement(draft, author);
    await updateAnnouncement(created.id, { ...draft, title: 'Buses leave at 5' });

    const { announcements } = await fetchAnnouncements();
    expect(announcements.find((a) => a.id === created.id)?.title).toBe(
      'Buses leave at 5',
    );
  });

  test('pinning moves an announcement to the front of the feed', async () => {
    const first = await createAnnouncement(draft, author);
    const second = await createAnnouncement({ ...draft, title: 'Later' }, author);
    await setAnnouncementPinned(first.id, true);

    const { announcements } = await fetchAnnouncements();
    expect(announcements[0].id).toBe(first.id);
    expect(announcements.find((a) => a.id === second.id)?.pinned).toBe(false);
  });

  test('deleting removes it from the feed', async () => {
    const created = await createAnnouncement(draft, author);
    await deleteAnnouncement(created.id);

    const { announcements } = await fetchAnnouncements();
    expect(announcements.some((a) => a.id === created.id)).toBe(false);
  });

  test('a failed update on a missing row is reported, not swallowed', async () => {
    await expect(updateAnnouncement('nope', draft)).rejects.toThrow(
      'Announcement not found',
    );
  });
});

describe('sortAnnouncements', () => {
  const make = (id: string, pinned: boolean, createdAt: string): Announcement => ({
    id,
    title: id,
    body: id,
    category: 'General',
    date: 'Jun 1',
    pinned,
    author: 'Admin',
    audience: 'Everyone',
    createdAt,
  });

  test('pinned first, then newest', () => {
    const sorted = sortAnnouncements([
      make('old', false, '2026-01-01T00:00:00Z'),
      make('new', false, '2026-06-01T00:00:00Z'),
      make('pinned-old', true, '2025-01-01T00:00:00Z'),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(['pinned-old', 'new', 'old']);
  });
});

describe('attachment helpers', () => {
  test('maps mime types to how the feed presents them', () => {
    expect(attachmentTypeForFile({ type: 'image/png', name: 'a.png' })).toBe('Image');
    expect(attachmentTypeForFile({ type: 'video/mp4', name: 'a.mp4' })).toBe('Video');
    expect(attachmentTypeForFile({ type: 'audio/mpeg', name: 'a.mp3' })).toBe('Audio');
    expect(attachmentTypeForFile({ type: 'application/pdf', name: 'a.pdf' })).toBe('PDF');
  });

  test('falls back to the extension when the browser sends no mime type', () => {
    expect(attachmentTypeForFile({ type: '', name: 'notes.docx' })).toBe('Doc');
    expect(attachmentTypeForFile({ type: '', name: 'archive.zip' })).toBe('File');
  });

  test('formats sizes for the attachment row', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(undefined)).toBeUndefined();
  });
});
