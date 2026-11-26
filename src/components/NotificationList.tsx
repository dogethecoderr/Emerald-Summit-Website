import { useNavigate } from 'react-router-dom';
import { Bell, Clock, Megaphone, UserRound } from '@/components/icons';
import { useNotifications } from '../context/NotificationsContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { notificationFullTime, notificationLink, notificationStamp, type AppNotification } from '../models/notifications';
import { cn } from '@/lib/utils';

const ICON = { announcement: Megaphone, notice: UserRound, reminder: Clock } as const;

/** The bell's notes, newest first: the full Notifications page and the bell's hover preview (`limit`). */
export default function NotificationList({ limit, onOpen }: { limit?: number; onOpen?: () => void }) {
  const { notifications, loading, error, markRead } = useNotifications();
  const { markRead: openPost } = useAnnouncements();
  const navigate = useNavigate();
  const shown = limit ? notifications.slice(0, limit) : notifications;

  const open = (n: AppNotification) => {
    markRead(n.id);
    // Opening a note about a post opens the post, which clears its dot in Announcements.
    if (n.kind === 'announcement' && n.announcementId) openPost(n.announcementId);
    onOpen?.();
    const to = notificationLink(n);
    if (to) navigate(to);
  };

  if (shown.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
        <Bell className="h-6 w-6" />
        {loading
          ? 'Loading…'
          : error
            ? "Couldn't load your notifications. Try again in a moment."
            : 'Nothing yet. Track reminders, new posts for you and changes to your tracks or team show up here.'}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {shown.map((n) => {
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
                {n.body && <span className={cn('mt-0.5 block text-[13px] text-muted-foreground', limit && 'line-clamp-2')}>{n.body}</span>}
              </span>
              {unread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-rose-600" aria-label="Unread" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
