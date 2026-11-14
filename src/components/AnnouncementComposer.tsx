import { useEffect, useRef, useState, type DragEvent } from 'react';
import {
  UploadCloud,
  X,
  Loader2,
  AlertTriangle,
} from '@/components/icons';
import { toast } from 'sonner';
import {
  formatBytes,
  postAudiences,
  type AnnouncementAttachment,
  type PostAudience,
} from '../models/announcements';
import {
  uploadAttachment,
  removeAttachmentFile,
  type AnnouncementDraft,
} from '../services/announcements';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { useAuth } from '../context/AuthContext';
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

function emptyDraft(audience: PostAudience | undefined): AnnouncementDraft {
  return {
    title: '',
    body: '',
    category: 'General',
    audience: audience?.label ?? 'Everyone',
    disciplineId: audience && audience.value !== 'everyone' ? audience.value : undefined,
    pinned: false,
    attachments: [],
  };
}

/**
 * New post, like the app's announcement_compose_screen: subject, message,
 * audience (Everyone or a discipline), pin, photos and files. Posts can't be
 * edited afterwards, in the app or here.
 */
export default function AnnouncementComposer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { create, live, configured } = useAnnouncements();
  const { profile } = useAuth();
  const audiences = postAudiences(profile);
  const [draft, setDraft] = useState<AnnouncementDraft>(() => emptyDraft(audiences[0]));
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Nested drag events fire on every child; count them so leaving a child
  // doesn't clear the highlight while the pointer is still over the zone.
  const dragDepth = useRef(0);

  // Each time it opens, start from a blank post.
  useEffect(() => {
    if (open) setDraft(emptyDraft(audiences[0]));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const canSave =
    draft.title.trim().length > 0 &&
    draft.body.trim().length > 0 &&
    uploading === 0 &&
    !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await create(draft);
      toast.success(live ? 'Announcement posted' : 'Posted to this browser only');
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
            New announcement
          </DialogTitle>
          <DialogDescription>
            {live
              ? 'Posts appear in Announcements straight away for the audience you pick.'
              : 'This post will stay in this browser.'}
          </DialogDescription>
        </DialogHeader>

        {!live && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {configured
                ? "Local bypass sign-in has no credentials to publish with. Sign in with a real admin account to post to everyone; uploads stay in memory until then."
                : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to publish to other devices. Uploaded files are previewed from memory and won\'t persist.'}
            </span>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="announcement-title">Subject</Label>
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

          <div className="space-y-1.5">
            <Label htmlFor="announcement-audience">Audience</Label>
            <Select
              value={audiences.find((a) => a.label === draft.audience)?.value ?? audiences[0]?.value}
              onValueChange={(v) => {
                const picked = audiences.find((a) => a.value === v);
                setDraft({ ...draft, audience: picked?.label ?? 'Everyone', disciplineId: v === 'everyone' ? undefined : v });
              }}
            >
              <SelectTrigger id="announcement-audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {audiences.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5">
            <div>
              <Label htmlFor="announcement-pinned" className="text-sm">
                Pin to top
              </Label>
              <p className="text-xs text-muted-foreground">
                Pinned posts stay at the top of Announcements.
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
            <Label>Photos and files</Label>

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
                Images, video, audio, PDFs and documents · up to 10 MB each
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
            Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
