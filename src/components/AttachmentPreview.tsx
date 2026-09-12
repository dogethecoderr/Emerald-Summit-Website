import {
  FileText,
  Link2,
  Play,
  BookOpen,
  ImageIcon,
  Music,
  File as FileIcon,
  type LucideIcon,
} from 'lucide-react';
import type {
  AnnouncementAttachment,
  AttachmentType,
} from '../models/announcements';
import { cn } from '@/lib/utils';

export const ATTACHMENT_ICON: Record<AttachmentType, LucideIcon> = {
  Image: ImageIcon,
  Video: Play,
  Audio: Music,
  PDF: FileText,
  Doc: FileText,
  File: FileIcon,
  Link: Link2,
  Form: BookOpen,
};

/**
 * Small square used in lists (composer rows, attachment chips). Images show
 * themselves; everything else shows its type icon.
 */
export default function AttachmentPreview({
  attachment,
  size = 'thumb',
}: {
  attachment: AnnouncementAttachment;
  size?: 'thumb' | 'sm';
}) {
  const Icon = ATTACHMENT_ICON[attachment.type];
  const box = size === 'thumb' ? 'h-10 w-10' : 'h-8 w-8';

  if (attachment.type === 'Image' && attachment.url) {
    return (
      <img
        src={attachment.url}
        alt={attachment.title}
        className={cn(box, 'shrink-0 rounded-md object-cover')}
      />
    );
  }

  return (
    <span
      className={cn(
        box,
        'flex shrink-0 items-center justify-center rounded-md bg-emerald/15 text-emerald-mint',
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

/**
 * Full-width rendering inside an announcement: media plays in place, and
 * anything else falls back to the download/open row.
 */
export function AttachmentBlock({
  attachment,
}: {
  attachment: AnnouncementAttachment;
}) {
  const { type, url, title } = attachment;
  if (!url) return null;

  if (type === 'Image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={title}
          loading="lazy"
          className="max-h-[420px] w-full rounded-lg border border-border/60 object-cover transition-opacity hover:opacity-90"
        />
      </a>
    );
  }

  if (type === 'Video') {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="max-h-[420px] w-full rounded-lg border border-border/60 bg-black"
      />
    );
  }

  if (type === 'Audio') {
    return (
      <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
        <p className="mb-2 text-[13px] font-medium">{title}</p>
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  return null;
}
