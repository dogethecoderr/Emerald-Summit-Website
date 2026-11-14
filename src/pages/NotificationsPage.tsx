// The bell's Notifications list, like the app's notifications_screen.dart:
// short notes about you (a new post that reaches you, a personal notice, a
// session starting within the hour), separate from Announcements. Tapping a note marks
// it read and opens what it's about; "Mark all as read" clears the bell.
import { Navigate, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Clock, Megaphone, UserRound } from '@/components/icons';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { useRequireProfile } from '../hooks/useRequireProfile';
import { useNotifications } from '../context/NotificationsContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { notificationFullTime, notificationLink, notificationStamp, type AppNotification } from '../models/notifications';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ICON = { announcement: Megaphone, notice: UserRound, reminder: Clock } as const;

export default function NotificationsPage() {
  const { ready, redirect } = useRequireProfile();
  const { notifications, loading, error, unreadCount, markRead, markAllRead } = useNotifications();
  const { markRead: openPost } = useAnnouncements();
  const navigate = useNavigate();

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const open = (n: AppNotification) => {
    markRead(n.id);
    // Opening a note about a post opens the post, which clears its dot in Announcements.
    if (n.kind === 'announcement' && n.announcementId) openPost(n.announcementId);
    const to = notificationLink(n);
    if (to) navigate(to);
  };

  return (
    <AppShell>
      <PageHeader label="For you" title="Notifications" />
      <section className="glass mx-auto max-w-3xl rounded-2xl p-2 sm:p-4">
        <div className="flex items-center justify-between gap-2 px-2 pb-3">
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" /> Mark all as read
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
            <Bell className="h-6 w-6" />
            {loading
              ? 'Loading…'
              : error
                ? "Couldn't load your notifications. Try again in a moment."
                : 'Nothing yet. Session reminders, new posts for you and changes to your sessions or team show up here.'}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((n) => {
              const Icon = ICON[n.kind];
              const unread = !n.readAt;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent/40"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald/15 text-emerald">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={cn('min-w-0 text-[14px]', unread ? 'font-bold' : 'font-medium text-foreground/85')}>{n.title}</span>
                        {n.createdAt && (
                          <time
                            dateTime={n.createdAt}
                            title={notificationFullTime(n.createdAt)}
                            className="shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-muted-foreground"
                          >
                            {notificationStamp(n.createdAt)}
                          </time>
                        )}
                      </span>
                      {n.body && <span className="mt-0.5 block text-[13px] text-muted-foreground">{n.body}</span>}
                    </span>
                    {unread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-rose-600" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
