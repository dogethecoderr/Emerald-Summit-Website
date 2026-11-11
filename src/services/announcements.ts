import { supabase } from '../lib/supabase';
import {
  attachmentTypeForFile,
  formatAnnouncementDate,
  type Announcement,
  type AnnouncementAttachment,
  type AnnouncementCategory,
} from '../models/announcements';

const BUCKET = 'announcement_attachments';
// v2: a browser's saved copy from before the feed started empty held the
// sample posts too, so it's left behind.
const LOCAL_KEY = 'local_announcements_v2';
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

interface SharedAttachment {
  url: string;
  path: string;
  name: string;
  type: string;
  size: number;
}

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  audience: string;
  pinned: boolean;
  created_by: string | null;
  author: string;
  discipline_id?: string | null;
  target_user_id?: string | null;
  attachments: SharedAttachment[] | null;
  created_at: string;
  updated_at?: string;
}

function rowToAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: 'General',
    audience: row.audience,
    pinned: row.pinned,
    author: row.author,
    authorId: row.created_by ?? undefined,
    disciplineId: row.discipline_id ?? undefined,
    targetUserId: row.target_user_id ?? undefined,
    attachments: (row.attachments ?? []).map((a, index) => ({
      id: a.path || `${row.id}-${index}`,
      title: a.name,
      type: attachmentTypeForFile({ name: a.name, type: a.type }),
      url: a.url,
      path: a.path,
      mimeType: a.type,
      bytes: a.size,
    })),
    date: formatAnnouncementDate(row.created_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftToRow(draft: AnnouncementDraft, author?: AnnouncementAuthor) {
  return {
    title: draft.title.trim(),
    body: draft.body.trim(),
    audience: draft.audience.trim() || 'Everyone',
    pinned: draft.pinned,
    attachments: draft.attachments.map((a) => ({
      url: a.url ?? '',
      path: a.path ?? '',
      name: a.title,
      type: a.mimeType ?? 'application/octet-stream',
      size: a.bytes ?? 0,
    })),
    ...(author ? { created_by: author.id ?? null, author: author.name } : {}),
  };
}

/** Match the mobile feed's audience rules in addition to database RLS. */
export function announcementsForUser(
  list: Announcement[],
  audience: {
    userId?: string;
    registeredDisciplines: ReadonlySet<string>;
    canManageDiscipline: (id: string) => boolean;
  },
): Announcement[] {
  return list.filter((announcement) => {
    if (announcement.targetUserId) return announcement.targetUserId === audience.userId;
    if (!announcement.disciplineId) return true;
    return audience.canManageDiscipline(announcement.disciplineId)
      || audience.registeredDisciplines.has(announcement.disciplineId);
  });
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
    // The feed starts empty: real announcements come from admins. The sample
    // posts in MOCK_ANNOUNCEMENTS only illustrate the /app showcase.
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Announcement[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

  // Keep a failed real feed separate from private browser-only demo posts.
  if (error) {
    return {
      announcements: [],
      source: 'remote',
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

  const client = supabase;
  let disposed = false;
  let authVersion = 0;
  let channel: ReturnType<typeof client.channel> | undefined;
  const sync = (signedIn: boolean) => {
    if (disposed) return;
    if (!signedIn && channel) {
      void client.removeChannel(channel);
      channel = undefined;
    } else if (signedIn && !channel) {
      channel = client.channel('public:announcements')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, onChange)
        .subscribe();
    }
  };
  const initialVersion = authVersion;
  void client.auth.getSession().then(({ data }) => {
    if (authVersion === initialVersion) sync(data.session != null);
  }).catch(() => {});
  const { data: auth } = client.auth.onAuthStateChange((_event, session) => {
    authVersion++;
    sync(session != null);
    if (!disposed) onChange();
  });
  return () => {
    disposed = true;
    auth.subscription.unsubscribe();
    if (channel) void client.removeChannel(channel);
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
// Read state and "Remove from my feed" (the app's announcement_reads and
// announcement_dismissals, so both follow the account across devices)
// ---------------------------------------------------------------------------

async function signedInUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Ids this account has opened (opened_at set), like the app's dots. Null when signed out. */
export async function fetchOpenedIds(): Promise<Set<string> | null> {
  if (!(await signedInUserId())) return null;
  const { data, error } = await client().from('announcement_reads').select('announcement_id, opened_at');
  if (error) return new Set();
  return new Set(
    (data as { announcement_id: string; opened_at: string | null }[])
      .filter((r) => r.opened_at != null)
      .map((r) => String(r.announcement_id)),
  );
}

/** Marks posts opened. Best-effort, like the app: a failure leaves them unread. */
export async function markOpened(ids: string[]): Promise<void> {
  const userId = await signedInUserId();
  if (!userId || ids.length === 0) return;
  const openedAt = new Date().toISOString();
  await client().from('announcement_reads').upsert(
    ids.map((id) => ({ user_id: userId, announcement_id: id, opened_at: openedAt })),
    { onConflict: 'user_id,announcement_id' },
  );
}

/** Ids this account removed from its own feed. Null when signed out. */
export async function fetchDismissedIds(): Promise<Set<string> | null> {
  if (!(await signedInUserId())) return null;
  const { data, error } = await client().from('announcement_dismissals').select('announcement_id');
  if (error) return new Set();
  return new Set((data as { announcement_id: string }[]).map((r) => String(r.announcement_id)));
}

/** "Remove from my feed": hidden only for this account. */
export async function hideForMe(id: string): Promise<void> {
  const userId = await signedInUserId();
  if (!userId) throw new Error('Sign in to remove posts from your feed.');
  const { error } = await client().from('announcement_dismissals').upsert(
    { user_id: userId, announcement_id: id },
    { onConflict: 'user_id,announcement_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

/** Undo of hideForMe. */
export async function unhideForMe(id: string): Promise<void> {
  const userId = await signedInUserId();
  if (!userId) return;
  const { error } = await client().from('announcement_dismissals').delete()
    .eq('user_id', userId).eq('announcement_id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/** Shared announcement_attachments bucket limit (mobile storage_upload_limits.sql). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Upload one file and return the attachment record to store on the
 * announcement. Without a backend the file stays an object URL: good enough
 * to preview in this tab, and the composer warns that it won't travel.
 */
export async function uploadAttachment(
  file: File,
): Promise<AnnouncementAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${file.name} is larger than the 10 MB limit`);
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
  const { data: auth } = await client().auth.getSession();
  if (!auth.session) throw new Error('Not signed in');
  const path = `${auth.session.user.id}/${base.id}-${safeName}`;

  const { error } = await client().storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', cacheControl: '31536000', upsert: false });

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
