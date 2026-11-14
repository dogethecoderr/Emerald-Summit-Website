// A session's own photos (hero + gallery), the same as the app's
// SupabaseSessionMediaRepository: one folder per session (`<session_id>/…`) in
// the public `session_photos` bucket. Anyone can read and list it; Storage RLS
// (session_pages_setup.sql in the app repo) lets only admins and the session's
// discipline editors upload or delete, so a bypassed UI is still refused.
import { supabase } from '../lib/supabase';

const BUCKET = 'session_photos';

/** session_photos' limit (storage_upload_limits.sql in the app repo). */
export const MAX_SESSION_PHOTO_BYTES = 10 * 1024 * 1024;

/** The types the bucket takes. Anything else is refused by Storage. */
export const SESSION_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];

/** The app shrinks photos to 2000 px at 85% quality before upload; so does this. */
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

export interface SessionPhoto {
  /** The file name inside the session's folder. */
  name: string;
  url: string;
}

/** Every photo in the session's folder, oldest first. Never throws: [] on any error. */
export async function fetchSessionPhotos(sessionId: string): Promise<SessionPhoto[]> {
  if (!supabase) return [];
  try {
    const store = supabase.storage.from(BUCKET);
    const { data, error } = await store.list(sessionId, { limit: 100, sortBy: { column: 'name', order: 'asc' } });
    if (error || !data) return [];
    return data
      // Subfolders have no id; Supabase keeps a dotfile in empty folders.
      .filter((o) => o.id != null && !o.name.startsWith('.'))
      .map((o) => ({ name: o.name, url: store.getPublicUrl(`${sessionId}/${o.name}`).data.publicUrl }));
  } catch {
    return [];
  }
}

/**
 * The page's top photo and the strip under it, as the app shows them: the
 * explicit hero, or the first photo when none was set, and every other photo
 * in the gallery (the hero is one of the folder's files).
 */
export function splitHero(heroUrl: string | null | undefined, photos: SessionPhoto[]): { hero: string | null; gallery: SessionPhoto[] } {
  const hero = heroUrl || photos[0]?.url || null;
  return { hero, gallery: photos.filter((p) => p.url !== hero) };
}

/** Shrinks a photo to 2000 px on its long edge as a JPEG. Null if the browser can't decode it. */
async function shrink(file: File): Promise<Blob | null> {
  if (file.type === 'image/gif') return null; // keep animation
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  } catch {
    return null;
  }
}

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif',
};

/**
 * Uploads one photo into the session's folder and returns it. Named like the
 * app's (`p_<millis>.jpg`), so the folder sorts in upload order. Throws on a
 * refused write, a file that isn't a photo, or one over 10 MB.
 */
export async function uploadSessionPhoto(sessionId: string, file: File): Promise<SessionPhoto> {
  if (!supabase) throw new Error('This needs the Summit database.');
  if (!SESSION_PHOTO_TYPES.includes(file.type)) throw new Error(`${file.name} isn't a photo.`);
  const small = await shrink(file);
  const body: Blob = small ?? file;
  const type = small ? 'image/jpeg' : file.type;
  if (body.size > MAX_SESSION_PHOTO_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
  const name = `p_${Date.now()}.${EXTENSION[type] ?? 'jpg'}`;
  const path = `${sessionId}/${name}`;
  const store = supabase.storage.from(BUCKET);
  const { error } = await store.upload(path, body, { contentType: type, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return { name, url: store.getPublicUrl(path).data.publicUrl };
}

/** Deletes one photo from the session's folder. Throws on a refused delete. */
export async function deleteSessionPhoto(sessionId: string, name: string): Promise<void> {
  if (!supabase) throw new Error('This needs the Summit database.');
  const { data, error } = await supabase.storage.from(BUCKET).remove([`${sessionId}/${name}`]);
  if (error) throw error;
  // Storage answers a delete RLS refused with an empty list, not an error.
  if (!data?.length) throw new Error('Not allowed');
}
