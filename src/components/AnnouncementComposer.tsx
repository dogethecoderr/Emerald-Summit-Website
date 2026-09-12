import { useEffect, useRef, useState, type DragEvent } from 'react';
import {
  UploadCloud,
  X,
  Loader2,
  Link2,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_CATEGORIES,
  formatBytes,
  type Announcement,
  type AnnouncementAttachment,
  type AnnouncementCategory,
} from '../models/announcements';
import {
  uploadAttachment,
  removeAttachmentFile,
  type AnnouncementDraft,
} from '../services/announcements';
import { useAnnouncements } from '../context/AnnouncementsContext';
import AttachmentPreview from './AttachmentPreview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const EMPTY_DRAFT: AnnouncementDraft = {
  title: '',
  body: '',
  category: 'General',
  audience: 'Everyone',
  pinned: false,
  attachments: [],
};

function draftFrom(announcement: Announcement | null): AnnouncementDraft {
  if (!announcement) return { ...EMPTY_DRAFT, attachments: [] };
  return {
    title: announcement.title,
    body: announcement.body,
    category: announcement.category,
    audience: announcement.audience,
    pinned: announcement.pinned,
    attachments: [...(announcement.attachments ?? [])],
  };
}

export default function AnnouncementComposer({
  open,
  onOpenChange,
  editing = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing announcement to edit; null composes a new one. */
  editing?: Announcement | null;
}) {
  const { create, update, live, configured } = useAnnouncements();
  const [draft, setDraft] = useState<AnnouncementDraft>(() => draftFrom(editing));
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  // Nested drag events fire on every child; count them so leaving a child
  // doesn't clear the highlight while the pointer is still over the zone.
  const dragDepth = useRef(0);

  // Reopening for a different announcement must not keep the previous form.
  useEffect(() => {
    if (open) {
      setDraft(draftFrom(editing));
      setLinkOpen(false);
      setLinkUrl('');
      setLinkTitle('');
    }
  }, [open, editing]);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading((n) => n + list.length);
    await Promise.all(
      list.map(async (file) => {
        try {
          const attachment = await uploadAttachment(file);
          setDraft((d) => ({ ...d, attachments: [...d.attachments, attachment] }));
        } catch (err: any) {
          toast.error(err?.message ?? `Could not upload ${file.name}`);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
  };

  const removeAttachment = (attachment: AnnouncementAttachment) => {
    setDraft((d) => ({
      ...d,
      attachments: d.attachments.filter((a) => a.id !== attachment.id),
    }));
    // Only orphan-clean uploads made in this session; an attachment already
    // saved on another announcement version is left alone until save.
    void removeAttachmentFile(attachment);
  };

  const addLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    setDraft((d) => ({
      ...d,
      attachments: [
        ...d.attachments,
        {
          id: crypto.randomUUID(),
          title: linkTitle.trim() || normalized.replace(/^https?:\/\//i, ''),
          type: 'Link',
          url: normalized,
        },
      ],
    }));
    setLinkUrl('');
    setLinkTitle('');
    setLinkOpen(false);
  };

  const canSave =
    draft.title.trim().length > 0 &&
    draft.body.trim().length > 0 &&
    uploading === 0 &&
    !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, draft);
        toast.success('Announcement updated');
      } else {
        await create(draft);
        toast.success(live ? 'Posted to everyone' : 'Posted to this browser only');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not save announcement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? 'Edit announcement' : 'New announcement'}
          </DialogTitle>
          <DialogDescription>
            {live
              ? 'Posts appear on every signed-in profile immediately.'
              : 'This post will stay in this browser.'}
          </DialogDescription>
        </DialogHeader>

        {!live && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {configured
                ? "Local bypass sign-in has no credentials to publish with. Sign in with a real admin account to post to everyone; uploads stay in memory until then."
                : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to publish to other devices. Uploaded files are previewed from memory and won\'t persist.'}
            </span>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="announcement-title">Title</Label>
            <Input
              id="announcement-title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Track sign-ups close Friday"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="announcement-body">Message</Label>
            <Textarea
              id="announcement-body"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="Share the details everyone needs…"
              className="min-h-[120px]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={draft.category}
                onValueChange={(v) =>
                  setDraft({ ...draft, category: v as AnnouncementCategory })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select
                value={draft.audience}
                onValueChange={(v) => setDraft({ ...draft, audience: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_AUDIENCES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5">
            <div>
              <Label htmlFor="announcement-pinned" className="text-sm">
                Pin to the top
              </Label>
              <p className="text-xs text-muted-foreground">
                Pinned posts lead the feed and count toward the sidebar badge.
              </p>
            </div>
            <Switch
              id="announcement-pinned"
              checked={draft.pinned}
              onCheckedChange={(pinned) => setDraft({ ...draft, pinned })}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Attachments</Label>
              <button
                type="button"
                onClick={() => setLinkOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-mint transition-colors hover:text-emerald-glow"
              >
                <Link2 className="h-3 w-3" /> Add link
              </button>
            </div>

            {linkOpen && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-secondary/30 p-2">
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com/form"
                  className="h-8 flex-1 min-w-[180px] text-xs"
                  onKeyDown={(e) => e.key === 'Enter' && addLink()}
                />
                <Input
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Label (optional)"
                  className="h-8 w-40 text-xs"
                  onKeyDown={(e) => e.key === 'Enter' && addLink()}
                />
                <Button size="sm" className="h-8" onClick={addLink}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
            )}

            <div
              onDragEnter={(e) => {
                e.preventDefault();
                dragDepth.current += 1;
                setDragging(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => {
                dragDepth.current -= 1;
                if (dragDepth.current <= 0) setDragging(false);
              }}
              onDrop={handleDrop}
              onClick={() => fileInput.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()
              }
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
                dragging
                  ? 'border-emerald-glow bg-emerald/10'
                  : 'border-border hover:border-emerald-glow/50 hover:bg-accent/30',
              )}
            >
              <UploadCloud
                className={cn(
                  'h-6 w-6',
                  dragging ? 'text-emerald-glow' : 'text-muted-foreground',
                )}
              />
              <p className="text-sm font-medium">
                {dragging ? 'Drop to attach' : 'Drag files here, or click to browse'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Images, video, audio, PDFs and documents · up to 100 MB each
              </p>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {uploading > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploading {uploading} file{uploading === 1 ? '' : 's'}…
              </div>
            )}

            {draft.attachments.length > 0 && (
              <ul className="space-y-2">
                {draft.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg border border-border/70 bg-secondary/40 p-2"
                  >
                    <AttachmentPreview attachment={a} size="thumb" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.type}
                        {formatBytes(a.bytes) ? ` · ${formatBytes(a.bytes)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a)}
                      aria-label={`Remove ${a.title}`}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? 'Save changes' : 'Post announcement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
