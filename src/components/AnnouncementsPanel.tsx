import { useMemo, useState } from 'react';
import {
  Pin,
  PinOff,
  Bell,
  Search,
  ChevronRight,
  Link2,
  Download,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';
import type {
  Announcement,
  AnnouncementAttachment,
  AnnouncementCategory,
} from '../models/announcements';
import { formatBytes, INLINE_ATTACHMENT_TYPES } from '../models/announcements';
import { ATTACHMENT_ICON, AttachmentBlock } from './AttachmentPreview';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CATEGORY_STYLE: Record<AnnouncementCategory, string> = {
  Urgent: 'bg-red-500/15 text-red-400 ring-red-500/30',
  Logistics: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  Workshop: 'bg-violet-500/15 text-violet-400 ring-violet-500/30',
  General: 'bg-emerald/15 text-emerald-mint ring-emerald-glow/30',
};

const CATEGORIES = ['All', 'Logistics', 'General', 'Urgent', 'Workshop'] as const;

const COMPACT_COUNT = 3;

/** Admin-only controls; omitted entirely for every other role. */
export interface AnnouncementAdminProps {
  canManage?: boolean;
  onCompose?: () => void;
  onEdit?: (announcement: Announcement) => void;
  onDelete?: (announcement: Announcement) => void;
  onTogglePin?: (announcement: Announcement) => void;
}

function AttachmentRow({ attachment }: { attachment: AnnouncementAttachment }) {
  const Icon = ATTACHMENT_ICON[attachment.type];
  const isOpen = attachment.type === 'Link' || attachment.type === 'Form';
  const size = formatBytes(attachment.bytes) ?? attachment.size;

  return (
    <a
      href={attachment.url ?? '#'}
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
  canManage = false,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  announcement: Announcement;
} & AnnouncementAdminProps) {
  const attachments = announcement.attachments ?? [];
  // Media plays in the body of the post; documents and links stay as rows.
  const inline = attachments.filter(
    (a) => INLINE_ATTACHMENT_TYPES.includes(a.type) && a.url,
  );
  const listed = attachments.filter((a) => !inline.includes(a));

  return (
    <article className="border-b border-border/60 py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px]">
        {announcement.pinned && (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
            <Pin className="h-3 w-3" fill="currentColor" /> Pinned
          </span>
        )}
        <span
          className={cn(
            'rounded-full px-2 py-0.5 font-semibold ring-1',
            CATEGORY_STYLE[announcement.category],
          )}
        >
          {announcement.category}
        </span>
        <span className="text-muted-foreground">→ {announcement.audience}</span>
        <span className="ml-auto text-muted-foreground">{announcement.date}</span>
      </div>
      <h3 className="text-[15px] font-semibold leading-snug">
        {announcement.title}
      </h3>
      <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">
        {announcement.body}
      </p>
      <div className="mt-1.5 text-[11px] text-muted-foreground/80">
        Posted by {announcement.author}
        {announcement.updatedAt &&
          announcement.createdAt &&
          announcement.updatedAt !== announcement.createdAt &&
          ' · edited'}
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

      {canManage && (
        <div className="mt-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEdit?.(announcement)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button
            type="button"
            onClick={() => onTogglePin?.(announcement)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {announcement.pinned ? (
              <>
                <PinOff className="h-3 w-3" /> Unpin
              </>
            ) : (
              <>
                <Pin className="h-3 w-3" /> Pin
              </>
            )}
          </button>
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
  onEdit,
  onDelete,
  onTogglePin,
}: {
  announcements: Announcement[];
  /** 'compact' = top-3 preview with a "View all" link (Dashboard use).
   *  'full' = the complete searchable/filterable list (Announcements tab). */
  variant?: 'compact' | 'full';
  onViewAll?: () => void;
} & AnnouncementAdminProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');

  const pinnedCount = announcements.filter((a) => a.pinned).length;

  const sorted = useMemo(
    () =>
      [...announcements].sort((a, b) =>
        a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1,
      ),
    [announcements],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((a) => {
      const matchesCategory = category === 'All' || a.category === category;
      const matchesQuery =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [sorted, category, query]);

  const isFull = variant === 'full';
  const visible = isFull ? filtered : sorted.slice(0, COMPACT_COUNT);

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">Announcements</h2>
        <div className="flex items-center gap-2">
          {pinnedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald/15 px-2 py-1 text-[11px] font-semibold text-emerald-mint">
              <Bell className="h-3 w-3" /> {pinnedCount} pinned
            </span>
          )}
          {canManage && onCompose && (
            <Button size="sm" className="h-8" onClick={onCompose}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          )}
        </div>
      </div>

      {isFull && (
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search announcements…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-secondary/40 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-emerald-glow/60"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  category === c
                    ? 'bg-emerald text-white'
                    : 'bg-secondary/60 text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        {visible.map((a) => (
          <AnnouncementItem
            key={a.id}
            announcement={a}
            canManage={canManage}
            onEdit={onEdit}
            onDelete={onDelete}
            onTogglePin={onTogglePin}
          />
        ))}
        {isFull && filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No announcements match your search.
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
