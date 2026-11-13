// The bell's Notifications list, the app's AppNotification
// (notifications_setup.sql in the app repo): short notes about the signed-in
// person, separate from News.

export type NotificationKind = 'announcement' | 'notice' | 'reminder';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  announcementId?: string;
  sessionId?: string;
  createdAt?: string;
  readAt?: string;
}

export function notificationFromRow(row: Record<string, unknown>): AppNotification {
  const kind = row.kind === 'announcement' || row.kind === 'reminder' ? row.kind : 'notice';
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const opt = (v: unknown) => (v == null || v === '' ? undefined : String(v));
  return {
    id: String(row.id),
    kind,
    title: text(row.title),
    body: text(row.body),
    announcementId: opt(row.announcement_id),
    sessionId: opt(row.session_id),
    createdAt: opt(row.created_at),
    readAt: opt(row.read_at),
  };
}

/** "just now", "5m ago", "3h ago", "2d ago", like the app. */
export function timeAgo(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Where tapping a note goes: the post in News, its session, or nowhere. */
export function notificationLink(n: AppNotification): string | null {
  if (n.kind === 'announcement' && n.announcementId) return '/announcements';
  if (n.sessionId) return `/sessions/${n.sessionId}`;
  return null;
}
