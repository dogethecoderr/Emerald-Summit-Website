import { supabase } from '../lib/supabase';
import {
  MOCK_ANNOUNCEMENTS,
  attachmentTypeForFile,
  formatAnnouncementDate,
  type Announcement,
  type AnnouncementAttachment,
  type AnnouncementCategory,
} from '../models/announcements';

const BUCKET = 'announcement-media';
const LOCAL_KEY = 'local_announcements';
const LOCAL_CHANNEL = 'emerald-announcements';

/** Fields an admin fills in; everything else is derived or server-assigned. */
export interface AnnouncementDraft {
  title: string;
  body: string;
  category: AnnouncementCategory;
  audience: string;
  pinned: boolean;
  attachments: AnnouncementAttachment[];
}

export interface AnnouncementAuthor {
  id?: string;
  name: string;
}

/** Where the feed currently comes from. */
export type FeedSource = 'remote' | 'local';

export interface FeedResult {
  announcements: Announcement[];
  source: FeedSource;
  /** Set when a configured backend was tried and failed. */
  error?: string;
}

export function isBackendConfigured(): boolean {
  return supabase !== null;
}

/**
 * Writes only reach other people when there is a real Supabase session:
 * bypass sign-in is local to one browser and has no credentials RLS can
 * check, so the composer says plainly that such a post stays put rather than
 * failing against a policy the author can't see.
 */
export async function canPublishRemotely(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return data.session != null;
}

/** Non-null client for paths already gated by canPublishRemotely(). */
function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  audience: string;
  pinned: boolean;
  author_id: string | null;
  author_name: string;
  attachments: AnnouncementAttachment[] | null;
  created_at: string;
  updated_at: string;
}

function rowToAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    audience: row.audience,
    pinned: row.pinned,
    author: row.author_name,
    authorId: row.author_id ?? undefined,
    attachments: row.attachments ?? [],
    date: formatAnnouncementDate(row.created_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftToRow(draft: AnnouncementDraft, author?: AnnouncementAuthor) {
  return {
    title: draft.title.trim(),
    body: draft.body.trim(),
    category: draft.category,
    audience: draft.audience.trim() || 'Everyone',
    pinned: draft.pinned,
    attachments: draft.attachments,
    ...(author ? { author_id: author.id ?? null, author_name: author.name } : {}),
  };
}

/** Pinned first, then newest. Mirrors the announcements_feed_idx ordering. */
export function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });
}

// ---------------------------------------------------------------------------
// Local fallback store
//
// Used when Supabase is unconfigured. Persisted so a reload keeps the demo
// post, and broadcast so other tabs in the same browser update live — the
// closest thing to "every profile at once" that is possible with no backend.
// ---------------------------------------------------------------------------

function readLocal(): Announcement[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [...MOCK_ANNOUNCEMENTS];
    const parsed = JSON.parse(raw) as Announcement[];
    return Array.isArray(parsed) ? parsed : [...MOCK_ANNOUNCEMENTS];
  } catch {
    return [...MOCK_ANNOUNCEMENTS];
  }
}

function writeLocal(list: Announcement[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    new BroadcastChannel(LOCAL_CHANNEL).postMessage('changed');
  } catch {
    // Private-mode storage failures shouldn't take the composer down; the
    // in-memory list the caller already holds stays correct for this tab.
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchAnnouncements(): Promise<FeedResult> {
  if (!supabase) {
    return { announcements: sortAnnouncements(readLocal()), source: 'local' };
  }

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  // A configured backend that can't answer (missing migration, network) falls
  // back to the local feed so the app still reads, but the error travels with
  // it so the UI can say why this isn't live.
  if (error) {
    return {
      announcements: sortAnnouncements(readLocal()),
      source: 'local',
      error: error.message,
    };
  }

  return {
    announcements: (data as AnnouncementRow[]).map(rowToAnnouncement),
    source: 'remote',
  };
}

/**
 * Live feed subscription. Calls `onChange` whenever any admin anywhere
 * inserts, edits, or deletes an announcement; the caller re-fetches rather
 * than patching, so ordering and server defaults stay authoritative.
 */
export function subscribeToAnnouncements(onChange: () => void): () => void {
  if (!supabase) {
    const channel = new BroadcastChannel(LOCAL_CHANNEL);
    channel.onmessage = () => onChange();
    return () => channel.close();
  }

  // Captured so the cleanup closure keeps the non-null narrowing above.
  const client = supabase;
  const channel = client
    .channel('announcements-feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'announcements' },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createAnnouncement(
  draft: AnnouncementDraft,
  author: AnnouncementAuthor,
): Promise<Announcement> {
  if (!(await canPublishRemotely())) {
    const now = new Date().toISOString();
    const created: Announcement = {
      id: `local-${crypto.randomUUID()}`,
      ...draft,
      author: author.name,
      authorId: author.id,
      date: formatAnnouncementDate(now),
      createdAt: now,
      updatedAt: now,
    };
    writeLocal(sortAnnouncements([created, ...readLocal()]));
    return created;
  }

  const { data, error } = await client()
    .from('announcements')
    .insert(draftToRow(draft, author))
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return rowToAnnouncement(data as AnnouncementRow);
}

export async function updateAnnouncement(
  id: string,
  draft: AnnouncementDraft,
): Promise<Announcement> {
  if (!(await canPublishRemotely())) {
    const list = readLocal();
    const index = list.findIndex((a) => a.id === id);
    if (index === -1) throw new Error('Announcement not found');
    const updated: Announcement = {
      ...list[index],
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    list[index] = updated;
    writeLocal(sortAnnouncements(list));
    return updated;
  }

  const { data, error } = await client()
    .from('announcements')
    .update(draftToRow(draft))
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return rowToAnnouncement(data as AnnouncementRow);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  if (!(await canPublishRemotely())) {
    writeLocal(readLocal().filter((a) => a.id !== id));
    return;
  }

  const { error } = await client().from('announcements').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Pin/unpin without opening the composer. */
export async function setAnnouncementPinned(
  id: string,
  pinned: boolean,
): Promise<void> {
  if (!(await canPublishRemotely())) {
    const list = readLocal();
    const index = list.findIndex((a) => a.id === id);
    if (index === -1) return;
    list[index] = { ...list[index], pinned };
    writeLocal(sortAnnouncements(list));
    return;
  }

  const { error } = await client()
    .from('announcements')
    .update({ pinned })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/** 100 MB — matches the bucket's file_size_limit in the migration. */
export const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

/**
 * Upload one file and return the attachment record to store on the
 * announcement. Without a backend the file stays an object URL: good enough
 * to preview in this tab, and the composer warns that it won't travel.
 */
export async function uploadAttachment(
  file: File,
): Promise<AnnouncementAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${file.name} is larger than the 100 MB limit`);
  }

  const base: AnnouncementAttachment = {
    id: crypto.randomUUID(),
    title: file.name,
    type: attachmentTypeForFile(file),
    mimeType: file.type || undefined,
    bytes: file.size,
  };

  if (!supabase || !(await canPublishRemotely())) {
    return { ...base, url: URL.createObjectURL(file) };
  }

  // Keep the extension so the browser and storage agree on content type, and
  // prefix with a uuid so two "map.pdf" uploads can coexist.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${new Date().getFullYear()}/${base.id}-${safeName}`;

  const { error } = await client().storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (error) throw new Error(`${file.name}: ${error.message}`);

  const { data } = client().storage.from(BUCKET).getPublicUrl(path);
  return { ...base, path, url: data.publicUrl };
}

/** Remove an uploaded object; best-effort, so a failed cleanup never blocks. */
export async function removeAttachmentFile(
  attachment: AnnouncementAttachment,
): Promise<void> {
  if (!supabase || !attachment.path) return;
  await client().storage.from(BUCKET).remove([attachment.path]);
}
