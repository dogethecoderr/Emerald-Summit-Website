// The bell's Notifications list, shared by the top bar and /notifications.
// Mirrors the app's AppState notifications: loads on sign-in, reloads on
// every change to this person's notes, and every 5 minutes asks for any due
// session reminders.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { AppNotification } from '../models/notifications';
import {
  fetchNotifications,
  markNotificationsRead,
  queueMyReminders,
  subscribeToNotifications,
} from '../services/notifications';

interface NotificationsContextValue {
  notifications: AppNotification[];
  loading: boolean;
  error: string | null;
  /**
   * True once the list has loaded from the backend. Until then (signed out, or
   * notifications_setup.sql not run yet) News keeps showing personal notices,
   * so they're never out of sight.
   */
  available: boolean;
  unreadCount: number;
  reload: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const EMPTY: NotificationsContextValue = {
  notifications: [],
  loading: false,
  error: null,
  available: false,
  unreadCount: 0,
  reload: async () => {},
  markRead: () => {},
  markAllRead: () => {},
};

const NotificationsContext = createContext<NotificationsContextValue>(EMPTY);

const REMINDER_INTERVAL_MS = 5 * 60 * 1000;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  // Only the newest load for the current account may land.
  const request = useRef(0);
  const activeUser = useRef(userId);
  activeUser.current = userId;

  const reload = useCallback(async () => {
    const mine = ++request.current;
    const forUser = activeUser.current;
    if (!forUser) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchNotifications();
      if (mine === request.current && forUser === activeUser.current) {
        setNotifications(list);
        setError(null);
        setAvailable(true);
      }
    } catch (e) {
      if (mine === request.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mine === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setNotifications([]);
    setError(null);
    setAvailable(false);
    if (!userId) return;
    void reload();
    const unsubscribe = subscribeToNotifications(userId, () => void reload());
    const remind = () => void queueMyReminders().then(reload);
    remind();
    const timer = window.setInterval(remind, REMINDER_INTERVAL_MS);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [userId, reload]);

  // The latest list, so the mark-read calls decide what to send without
  // waiting for a state update.
  const current = useRef(notifications);
  current.current = notifications;

  const markRead = useCallback((id: string) => {
    if (!current.current.some((n) => n.id === id && !n.readAt)) return;
    const now = new Date().toISOString();
    setNotifications((list) => list.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: now } : n)));
    void markNotificationsRead([id]);
  }, []);

  const markAllRead = useCallback(() => {
    if (!current.current.some((n) => !n.readAt)) return;
    const now = new Date().toISOString();
    setNotifications((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    void markNotificationsRead();
  }, []);

  const value = useMemo<NotificationsContextValue>(() => ({
    notifications,
    loading,
    error,
    available,
    unreadCount: notifications.filter((n) => !n.readAt).length,
    reload,
    markRead,
    markAllRead,
  }), [notifications, loading, error, available, reload, markRead, markAllRead]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
