// The bell's Notifications list, the app's AppNotification
// (notifications_setup.sql in the app repo): short notes about the signed-in
// person, separate from Announcements.

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

/**
 * The bell's stamp next to each note, in the viewer's time zone. A note from
 * today keeps the app's relative style ("just now", "5m ago", "3h ago"); once
 * it's from an earlier calendar day it shows the date: "Thu, Nov 12" this
 * year, "Nov 12, 2025" for another year. `timeZone` is for tests.
 */
export function notificationStamp(iso: string | undefined, now: Date = new Date(), timeZone?: string): string {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  if (day(then) === day(now)) {
    const minutes = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }
  const year = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(d);
  return year(then) === year(now)
    ? new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(then)
    : new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' }).format(then);
}

/** The full date and time, for the stamp's hover text. */
export function notificationFullTime(iso: string | undefined, timeZone?: string): string {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(then);
}

/** Where tapping a note goes: the post in Announcements, its session, or nowhere. */
export function notificationLink(n: AppNotification): string | null {
  if (n.kind === 'announcement' && n.announcementId) return '/announcements';
  if (n.sessionId) return `/sessions/${n.sessionId}`;
  return null;
}
