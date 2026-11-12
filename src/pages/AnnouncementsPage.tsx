import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle } from '@/components/icons';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import AnnouncementsPanel from '../components/AnnouncementsPanel';
import AnnouncementComposer from '../components/AnnouncementComposer';
import { useRequireProfile } from '../hooks/useRequireProfile';
import { useAnnouncements } from '../context/AnnouncementsContext';
import type { Announcement } from '../models/announcements';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AnnouncementsPage() {
  const { ready, redirect } = useRequireProfile();
  const {
    announcements,
    canManage,
    canPost,
    error,
    live,
    remove,
    isUnread,
    markRead,
    markAllRead,
    hide,
    unhide,
    configured,
  } = useAnnouncements();

  // Opening News marks every post seen (clears the badge), as in the app.
  // Each post's dot stays until that post is opened.
  // markAllRead changes once read state loads or new posts arrive; once
  // everything is seen it does nothing, so this settles.
  useEffect(() => {
    if (ready) markAllRead();
  }, [ready, markAllRead]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  // Same wording as the app's "Remove from my feed" and its Undo snackbar.
  const removeFromFeed = async (announcement: Announcement) => {
    try {
      await hide(announcement.id);
      toast('Removed from your feed', {
        action: { label: 'Undo', onClick: () => void unhide(announcement.id) },
      });
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not remove it from your feed');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove(pendingDelete.id);
      toast.success('Announcement deleted');
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not delete announcement');
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <AppShell>
      <PageHeader
        label="Live Updates"
        title="News"
      />
      {canManage && error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Announcements could not be loaded:{' '}
            <code>{error}</code>. Try again in a moment.
          </span>
        </div>
      )}
      {canManage && !error && !live && (
        <div className="mb-4 rounded-xl border border-border/70 bg-secondary/40 p-3 text-xs text-muted-foreground">
          No Summit database is connected, so posts stay in this browser.
        </div>
      )}
      <AnnouncementsPanel
        announcements={announcements}
        isUnread={isUnread}
        onMarkRead={markRead}
        onHide={configured ? removeFromFeed : undefined}
        variant="full"
        canManage={canManage}
        onCompose={canPost ? () => setComposerOpen(true) : undefined}
        onDelete={setPendingDelete}
      />

      {canPost && (
        <AnnouncementComposer
          open={composerOpen}
          onOpenChange={setComposerOpen}
        />
      )}

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Delete announcement?</DialogTitle>
            <DialogDescription>
              “{pendingDelete?.title}” will be removed for everyone. This can't be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
