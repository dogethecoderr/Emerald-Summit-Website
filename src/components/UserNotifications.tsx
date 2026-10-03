import { useCallback, useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import {
  getDemoNotifications,
  markDemoNotificationRead,
  subscribeOfflineDemo,
} from '../services/offlineDemo';

interface UserNotification {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export default function UserNotifications({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setNotifications(getDemoNotifications(userId));
      setLoadError(null);
      return;
    }
    const { data, error } = await supabase
      .from('user_notifications')
      .select('id, title, body, created_at, read_at')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) {
      setLoadError(`Could not load notifications: ${error.message}`);
      return;
    }
    setLoadError(null);
    setNotifications((data ?? []) as UserNotification[]);
  }, [userId]);

  useEffect(() => {
    void refresh();
    if (!supabase || typeof supabase.channel !== 'function') {
      return subscribeOfflineDemo(() => void refresh());
    }

    const client = supabase;
    const channel = client
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh, userId]);

  const markRead = async (notificationId: string) => {
    if (!supabase) {
      try {
        markDemoNotificationRead(notificationId, userId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not update notification.');
      }
      return;
    }
    const { error } = await supabase.rpc('mark_user_notification_read', {
      p_notification_id: notificationId,
    });
    if (error) {
      toast.error(`Could not update notification: ${error.message}`);
      return;
    }
    setNotifications((current) => current.map((notification) =>
      notification.id === notificationId
        ? { ...notification, read_at: new Date().toISOString() }
        : notification,
    ));
  };

  if (notifications.length === 0 && !loadError) return null;

  return (
    <section aria-label="Notifications" className="mb-6 space-y-2">
      {loadError && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}
      {notifications.map((notification) => (
        <article
          key={notification.id}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            notification.read_at
              ? 'border-border/60 bg-card/40'
              : 'border-emerald-glow/30 bg-emerald/10'
          }`}
        >
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-emerald-mint" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{notification.title}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {notification.body}
            </p>
            <time className="mt-1 block text-[10px] text-muted-foreground" dateTime={notification.created_at}>
              {new Date(notification.created_at).toLocaleString()}
            </time>
          </div>
          {!notification.read_at && (
            <button
              type="button"
              onClick={() => void markRead(notification.id)}
              aria-label={`Mark ${notification.title} as read`}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
