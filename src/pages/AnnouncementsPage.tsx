import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
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
  const { announcements, canManage, error, live, remove, togglePinned } =
    useAnnouncements();

  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
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
        title="Announcements"
        sub={
          canManage
            ? 'Post updates with photos, video, audio, and files — everyone sees them the moment you publish.'
            : 'Logistics, schedule changes, and Summit news — with downloadable forms and guides posted alongside them.'
        }
      />
      {canManage && error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Showing the local feed — the announcements backend answered:{' '}
            <code>{error}</code>. Run the pending Supabase migration to publish
            to every profile.
          </span>
        </div>
      )}
      {canManage && !error && !live && (
        <div className="mb-4 rounded-xl border border-border/70 bg-secondary/40 p-3 text-xs text-muted-foreground">
          You're signed in with local bypass, so posts stay in this browser.
          Sign in with a real admin account to publish to everyone.
        </div>
      )}
      <AnnouncementsPanel
        announcements={announcements}
        variant="full"
        canManage={canManage}
        onCompose={() => {
          setEditing(null);
          setComposerOpen(true);
        }}
        onEdit={(a) => {
          setEditing(a);
          setComposerOpen(true);
        }}
        onDelete={setPendingDelete}
        onTogglePin={(a) => {
          void togglePinned(a.id, !a.pinned).catch((err) =>
            toast.error(err?.message ?? 'Could not update pin'),
          );
        }}
      />

      {canManage && (
        <AnnouncementComposer
          open={composerOpen}
          onOpenChange={setComposerOpen}
          editing={editing}
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
