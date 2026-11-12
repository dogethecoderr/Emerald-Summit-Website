import { useMemo } from 'react';
import {
  Pin,
  Bell,
  ChevronRight,
  Link2,
  Download,
  Trash2,
  Plus,
  EyeOff,
} from '@/components/icons';
import type {
  Announcement,
  AnnouncementAttachment,
} from '../models/announcements';
import { formatBytes, INLINE_ATTACHMENT_TYPES } from '../models/announcements';
import { ATTACHMENT_ICON, AttachmentBlock } from './AttachmentPreview';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COMPACT_COUNT = 3;

/**
 * Posting and deleting. Like the app, a post can be written and deleted but
 * not edited or re-pinned afterwards.
 */
export interface AnnouncementAdminProps {
  /** Admins: Delete on each post. */
  canManage?: boolean;
  /** Set only for accounts that may post (admins, volunteers with the flag). */
  onCompose?: () => void;
  onDelete?: (announcement: Announcement) => void;
}

/** Read state, owned by AnnouncementsContext; omit to show everything as read. */
export interface AnnouncementReadProps {
  isUnread?: (id: string) => boolean;
  onMarkRead?: (id: string) => void;
  /** "Remove from my feed" (hidden only for this account). */
  onHide?: (announcement: Announcement) => void;
}

function AttachmentRow({ attachment }: { attachment: AnnouncementAttachment }) {
  const Icon = ATTACHMENT_ICON[attachment.type];
  const isOpen = attachment.type === 'Link' || attachment.type === 'Form';
  const size = formatBytes(attachment.bytes) ?? attachment.size;

  if (!attachment.url) return null;
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      {...(isOpen ? {} : { download: attachment.title })}
      className="group flex w-full items-center gap-3 rounded-lg border border-border/70 bg-secondary/40 px-3 py-2.5 text-left transition-colors hover:border-emerald-glow/40 hover:bg-accent/50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald/15 text-emerald-mint">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">
          {attachment.title}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {attachment.type}
          {size ? ` · ${size}` : ''}
        </span>
      </span>
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-mint opacity-70 transition-opacity group-hover:opacity-100">
        {isOpen ? <Link2 className="h-3 w-3" /> : <Download className="h-3 w-3" />}
        {isOpen ? 'Open' : 'Get'}
      </span>
    </a>
  );
}

export function AnnouncementItem({
  announcement,
  unread = false,
  onMarkRead,
  onHide,
  canManage = false,
  onDelete,
}: {
  announcement: Announcement;
  unread?: boolean;
  onMarkRead?: (id: string) => void;
  onHide?: (announcement: Announcement) => void;
} & AnnouncementAdminProps) {
  const attachments = announcement.attachments ?? [];
  // Media plays in the body of the post; documents and links stay as rows.
  const inline = attachments.filter(
    (a) => INLINE_ATTACHMENT_TYPES.includes(a.type) && a.url,
  );
  const listed = attachments.filter((a) => !inline.includes(a));

  return (
    // Opening an unread item (clicking anywhere in it) marks it read.
    <article
      onClick={unread && onMarkRead ? () => onMarkRead(announcement.id) : undefined}
      className={cn(
        'rounded-xl border p-4 transition-colors',
        unread
          ? 'cursor-pointer border-rose-200 bg-rose-50/70 hover:bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:hover:bg-rose-500/15'
          : 'border-border/60 bg-card/50',
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        {unread && (
          <span className="inline-flex items-center gap-1.5 font-bold text-rose-600">
            <span className="h-2 w-2 rounded-full bg-rose-600" aria-hidden />
            New
          </span>
        )}
        {announcement.pinned && (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
            <Pin className="h-3 w-3" weight="fill" /> Pinned
          </span>
        )}
        <span className="text-muted-foreground">{announcement.audience}</span>
        <span className="ml-auto text-muted-foreground">{announcement.date}</span>
      </div>
      <h3
        className={cn(
          'text-[15px] leading-snug',
          unread ? 'font-bold' : 'font-semibold text-foreground/90',
        )}
      >
        {announcement.title}
      </h3>
      <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">
        {announcement.body}
      </p>
      <div className="mt-1.5 text-[11px] text-muted-foreground/80">
        Posted by {announcement.author}
      </div>

      {inline.length > 0 && (
        <div className="mt-3 space-y-2">
          {inline.map((a) => (
            <AttachmentBlock key={a.id} attachment={a} />
          ))}
        </div>
      )}

      {listed.length > 0 && (
        <div className="mt-3 space-y-2">
          {listed.map((a) => (
            <AttachmentRow key={a.id} attachment={a} />
          ))}
        </div>
      )}

      {onHide && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onHide(announcement);
          }}
          title="Hidden only for you"
          className="mt-3 mr-1.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <EyeOff className="h-3 w-3" /> Remove from my feed
        </button>
      )}

      {canManage && (
        <div className="mt-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onDelete?.(announcement)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      )}
    </article>
  );
}

export default function AnnouncementsPanel({
  announcements,
  variant = 'full',
  onViewAll,
  canManage = false,
  onCompose,
  onDelete,
  isUnread,
  onMarkRead,
  onHide,
}: {
  announcements: Announcement[];
  /** 'compact' = top-3 preview with a "View all" link (Dashboard use).
   *  'full' = the whole feed (News), like the app's News tab. */
  variant?: 'compact' | 'full';
  onViewAll?: () => void;
} & AnnouncementAdminProps &
  AnnouncementReadProps) {
  const pinnedCount = announcements.filter((a) => a.pinned).length;
  const unreadCount = isUnread
    ? announcements.filter((a) => isUnread(a.id)).length
    : 0;

  const sorted = useMemo(
    () =>
      [...announcements].sort((a, b) =>
        a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1,
      ),
    [announcements],
  );

  const isFull = variant === 'full';
  const visible = isFull ? sorted : sorted.slice(0, COMPACT_COUNT);

  return (
    <section className="glass rounded-2xl p-5">
      <div
        className={cn(
          'mb-4 flex items-center justify-between gap-2',
          !isFull && 'border-b border-border pb-4',
        )}
      >
        <h2 className="font-display text-base font-semibold">News</h2>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-1 text-[11px] font-bold text-white">
              {unreadCount} unread
            </span>
          )}
          {pinnedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald/15 px-2 py-1 text-[11px] font-semibold text-emerald-mint">
              <Bell className="h-3 w-3" /> {pinnedCount} pinned
            </span>
          )}
          {onCompose && (
            <Button size="sm" className="h-8" onClick={onCompose}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {visible.map((a) => (
          <AnnouncementItem
            key={a.id}
            announcement={a}
            unread={isUnread?.(a.id) ?? false}
            onMarkRead={onMarkRead}
            onHide={onHide}
            canManage={canManage}
            onDelete={onDelete}
          />
        ))}
        {announcements.length === 0 && (
          <div className={cn('text-center text-sm text-muted-foreground', isFull ? 'py-10' : 'py-6')}>
            No announcements yet.
          </div>
        )}
      </div>

      {!isFull && onViewAll && (
        <button
          onClick={onViewAll}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-mint transition-colors hover:text-emerald-glow"
        >
          View all <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </section>
  );
}
