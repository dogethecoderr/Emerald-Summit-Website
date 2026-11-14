import { beforeEach, describe, expect, test, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  list: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => {
        storage.from(bucket);
        return {
          list: storage.list,
          upload: storage.upload,
          remove: storage.remove,
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${bucket}/${path}` } }),
        };
      },
    },
  },
  isSupabaseConfigured: true,
}));

import { deleteSessionPhoto, fetchSessionPhotos, splitHero, uploadSessionPhoto } from '../sessionPhotos';

beforeEach(() => vi.clearAllMocks());

describe('fetchSessionPhotos', () => {
  test("lists the session's folder in session_photos, skipping folders and dotfiles", async () => {
    storage.list.mockResolvedValue({
      data: [
        { id: '1', name: 'p_1.jpg' },
        { id: null, name: 'sub' },
        { id: '2', name: '.emptyFolderPlaceholder' },
        { id: '3', name: 'p_2.jpg' },
      ],
      error: null,
    });
    const photos = await fetchSessionPhotos('s1');
    expect(storage.from).toHaveBeenCalledWith('session_photos');
    expect(storage.list.mock.calls[0][0]).toBe('s1');
    expect(photos).toEqual([
      { name: 'p_1.jpg', url: 'https://cdn/session_photos/s1/p_1.jpg' },
      { name: 'p_2.jpg', url: 'https://cdn/session_photos/s1/p_2.jpg' },
    ]);
  });

  test('gives an empty list on an error', async () => {
    storage.list.mockResolvedValue({ data: null, error: new Error('nope') });
    expect(await fetchSessionPhotos('s1')).toEqual([]);
    storage.list.mockRejectedValue(new Error('offline'));
    expect(await fetchSessionPhotos('s1')).toEqual([]);
  });
});

describe('splitHero', () => {
  const a = { name: 'a', url: 'u/a' };
  const b = { name: 'b', url: 'u/b' };

  test('uses the explicit hero and leaves it out of the gallery', () => {
    expect(splitHero('u/b', [a, b])).toEqual({ hero: 'u/b', gallery: [a] });
  });

  test('falls back to the first photo when no hero was set', () => {
    expect(splitHero(null, [a, b])).toEqual({ hero: 'u/a', gallery: [b] });
  });

  test('no photos and no hero means no banner', () => {
    expect(splitHero(null, [])).toEqual({ hero: null, gallery: [] });
  });
});

describe('uploadSessionPhoto', () => {
  test("uploads into the session's folder with a long cache and returns the public URL", async () => {
    storage.upload.mockResolvedValue({ error: null });
    const file = new File(['x'], 'beach.png', { type: 'image/png' });
    const photo = await uploadSessionPhoto('s1', file);
    const [path, , options] = storage.upload.mock.calls[0];
    expect(path).toMatch(/^s1\/p_\d+\.(png|jpg)$/);
    expect(options).toMatchObject({ cacheControl: '31536000', upsert: false });
    expect(photo.url).toBe(`https://cdn/session_photos/${path}`);
  });

  test("refuses a file that isn't a photo without uploading", async () => {
    const file = new File(['x'], 'notes.pdf', { type: 'application/pdf' });
    await expect(uploadSessionPhoto('s1', file)).rejects.toThrow("isn't a photo");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  test('throws when Storage refuses the write', async () => {
    storage.upload.mockResolvedValue({ error: new Error('new row violates row-level security policy') });
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    await expect(uploadSessionPhoto('s1', file)).rejects.toThrow();
  });
});

describe('deleteSessionPhoto', () => {
  test("removes the file from the session's folder", async () => {
    storage.remove.mockResolvedValue({ data: [{ name: 's1/p_1.jpg' }], error: null });
    await deleteSessionPhoto('s1', 'p_1.jpg');
    expect(storage.remove).toHaveBeenCalledWith(['s1/p_1.jpg']);
  });

  test('throws when nothing was removed (Storage RLS refused it quietly)', async () => {
    storage.remove.mockResolvedValue({ data: [], error: null });
    await expect(deleteSessionPhoto('s1', 'p_1.jpg')).rejects.toThrow();
  });
});
