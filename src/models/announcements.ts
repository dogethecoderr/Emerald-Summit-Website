// Ported from the Annual Summit App prototype's Announcement type
// (src/app/App.tsx), expanded with `attachments` to absorb what the
// prototype's separate ResourcesScreen did (see ResourcesScreen ~line 699
// and its Resource type / RESOURCE_ICON map) — Resources isn't a standalone
// section in this app; a downloadable/linkable item now just rides along
// on the announcement that introduced it.

import { USER_DISCIPLINES } from './disciplines';

export type AnnouncementCategory = 'Logistics' | 'General' | 'Urgent' | 'Workshop';

export const ANNOUNCEMENT_CATEGORIES: AnnouncementCategory[] = [
  'General',
  'Logistics',
  'Urgent',
  'Workshop',
];

/**
 * Image/Video/Audio render inline in the feed; PDF/Doc/File download; Link and
 * Form open externally. The split is by how the attachment is *presented*,
 * not by its mime type, which is why `attachmentTypeForFile` maps one to the
 * other in a single place.
 */
export type AttachmentType =
  | 'Image'
  | 'Video'
  | 'Audio'
  | 'PDF'
  | 'Doc'
  | 'File'
  | 'Link'
  | 'Form';

/** Types the feed plays/shows inline rather than offering as a download. */
export const INLINE_ATTACHMENT_TYPES: AttachmentType[] = [
  'Image',
  'Video',
  'Audio',
];

export interface AnnouncementAttachment {
  id: string;
  title: string;
  type: AttachmentType;
  /** Public URL — a storage object's public URL, or an external link. */
  url?: string;
  /** Storage object path, kept so edits and deletes can clean up the bucket. */
  path?: string;
  mimeType?: string;
  bytes?: number;
  /** Pre-formatted size for seeded/mock rows that have no byte count. */
  size?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  /** Short display date ("Jun 29"). Derived from createdAt for live rows. */
  date: string;
  pinned: boolean;
  author: string;
  authorId?: string;
  /** Shared backend targeting, applied after RLS has protected personal notices. */
  disciplineId?: string;
  targetUserId?: string;
  audience: string;
  attachments?: AnnouncementAttachment[];
  createdAt?: string;
  updatedAt?: string;
}

/** Audiences an admin can target; free text is allowed too. */
export const ANNOUNCEMENT_AUDIENCES = [
  'Everyone',
  'Participants',
  'Volunteers',
  'Experts',
  'Ambassadors',
  'Attendees',
] as const;

const MIME_PREFIX_TYPE: [string, AttachmentType][] = [
  ['image/', 'Image'],
  ['video/', 'Video'],
  ['audio/', 'Audio'],
  ['application/pdf', 'PDF'],
];

const DOC_EXTENSIONS = /\.(docx?|pptx?|xlsx?|pages|key|numbers|txt|rtf|csv|md)$/i;

/** Pick the presentation type for an uploaded file. */
export function attachmentTypeForFile(file: {
  type?: string;
  name?: string;
}): AttachmentType {
  const mime = (file.type ?? '').toLowerCase();
  for (const [prefix, type] of MIME_PREFIX_TYPE) {
    if (mime.startsWith(prefix)) return type;
  }
  if (file.name && DOC_EXTENSIONS.test(file.name)) return 'Doc';
  return 'File';
}

/** "1.4 MB" — undefined when the byte count is unknown. */
export function formatBytes(bytes: number | undefined): string | undefined {
  if (bytes === undefined || Number.isNaN(bytes)) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** The short "Jun 29" label the feed shows. */
export function formatAnnouncementDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'a1',
    title: 'Summit Date TBD. Stay Tuned!',
    body: 'We are finalizing the Summit date and will announce it as soon as it is confirmed. Please check back here for the official date and begin exploring the six discipline tracks.',
    category: 'General',
    date: 'Jun 29',
    pinned: true,
    author: 'Marcus Chen & Elena Rodriguez',
    audience: 'Everyone',
  },
  {
    id: 'a2',
    title: 'Discipline Track Sign-Ups Opening Soon',
    body: 'Registration for TechVerse, BioSphere, ImagineX, NovaSphere, VentureVerse, and CivicVerse opens once the Summit date is confirmed. Each track has limited spots. Mark your interest now in the Schedule Builder.',
    category: 'General',
    date: 'Jun 29',
    pinned: true,
    author: 'Elena Rodriguez',
    audience: 'Participants',
  },
  {
    id: 'a3',
    title: 'Ambassador Applications Now Open',
    body: 'Emerald High students interested in representing a discipline as a Student Ambassador can apply below. Applications close two weeks before the Summit.',
    category: 'Urgent',
    date: 'Jun 28',
    pinned: false,
    author: 'Marcus Chen',
    audience: 'Ambassadors',
    attachments: [
      { id: 'a3-f1', title: 'Student Ambassador Application', type: 'Form' },
    ],
  },
  {
    id: 'a4',
    title: 'Volunteer Orientation Details Coming',
    body: 'A dedicated volunteer orientation will be held on the morning of the Summit. Details including time and location will be posted here once the date is set.',
    category: 'Logistics',
    date: 'Jun 27',
    pinned: false,
    author: 'Summit Ops Team',
    audience: 'Volunteers',
    attachments: [
      { id: 'a4-f1', title: 'Code of Conduct & Community Agreement', type: 'PDF', size: '420 KB' },
      { id: 'a4-f2', title: 'Emerald High Campus Map', type: 'PDF', size: '950 KB' },
    ],
  },
  {
    id: 'a5',
    title: 'TechVerse: Bring a Laptop',
    body: 'All TechVerse participants should bring a laptop or tablet. We will have a limited number of loaners available on a first-come basis at the front desk.',
    category: 'Workshop',
    date: 'Jun 26',
    pinned: false,
    author: 'Aiden Tran',
    audience: 'TechVerse',
  },
  {
    id: 'a6',
    title: 'Summit Promo Video Is Live',
    body: "Get a preview of last year's Summit. Share it with friends and family who are curious what the day looks like.",
    category: 'General',
    date: 'Jun 24',
    pinned: false,
    author: 'Summit Ops Team',
    audience: 'Everyone',
    attachments: [{ id: 'a6-f1', title: 'Summit Promo Video', type: 'Video' }],
  },
];

/** One choice in the composer's Audience menu. */
export interface PostAudience {
  /** 'everyone' or a discipline id. */
  value: string;
  label: string;
}

/**
 * Who this account may post to, as in the app's composer: admins pick
 * Everyone or any discipline; a volunteer with can_post_announcements picks
 * one of the disciplines they manage (all of them for '*'). Empty means they
 * can't post. The database's insert policy enforces the same rule.
 */
export function postAudiences(profile: {
  role?: string | null;
  can_post_announcements?: boolean | null;
  managed_disciplines?: string[] | null;
} | null | undefined): PostAudience[] {
  if (!profile) return [];
  const isAdmin = profile.role === 'admin';
  const isPoster = (profile.role === 'volunteer' || profile.role === 'ambassador') && profile.can_post_announcements === true;
  if (!isAdmin && !isPoster) return [];
  const scope = profile.managed_disciplines ?? [];
  const disciplines = isAdmin || scope.includes('*')
    ? USER_DISCIPLINES
    : USER_DISCIPLINES.filter((d) => scope.includes(d.name));
  return [
    ...(isAdmin ? [{ value: 'everyone', label: 'Everyone' }] : []),
    ...disciplines.map((d) => ({ value: d.name, label: d.label })),
  ];
}

/** What the in-app banner shows for a new post, and where tapping it goes. */
export interface AnnouncementBanner {
  title: string;
  body: string;
  /** '/notifications' for a personal notice (the bell), '/announcements' for a post. */
  to: string;
}

/**
 * The app's banner rule (AppState._onAnnouncementInserted): nothing for your
 * own posts, or for posts that don't reach you; admins see who sent a
 * discipline post where. Picks the newest of [added].
 */
export function bannerFor(
  added: Announcement[],
  me: {
    userId?: string;
    isAdmin: boolean;
    reaches: (disciplineId: string) => boolean;
  },
): AnnouncementBanner | null {
  const newest = [...added]
    .filter((a) => !a.authorId || a.authorId !== me.userId)
    .filter((a) => (a.targetUserId ? a.targetUserId === me.userId : !a.disciplineId || me.reaches(a.disciplineId)))
    .sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''))[0];
  if (!newest) return null;
  if (newest.targetUserId) return { title: newest.title, body: newest.body, to: '/notifications' };
  if (me.isAdmin && newest.disciplineId) {
    const who = newest.author || 'Someone';
    const where = USER_DISCIPLINES.find((d) => d.name === newest.disciplineId)?.label ?? newest.disciplineId;
    return { title: `${who} sent an announcement to the ${where} discipline`, body: newest.title, to: '/announcements' };
  }
  return { title: newest.title, body: newest.body, to: '/announcements' };
}
