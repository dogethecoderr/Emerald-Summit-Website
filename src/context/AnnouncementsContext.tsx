import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { useSchedule } from './ScheduleContext';
import { MOCK_SESSIONS } from '../models/sessions';
import { canEditVerse, useSummitContent } from '../services/summitContent';
import {
  createAnnouncement,
  announcementsForUser,
  deleteAnnouncement,
  canPublishRemotely,
  fetchAnnouncements,
  fetchDismissedIds,
  fetchOpenedIds,
  fetchSeenIds,
  hideForMe,
  markOpened,
  markSeen,
  unhideForMe,
  isBackendConfigured,
  setAnnouncementPinned,
  sortAnnouncements,
  subscribeToAnnouncements,
  updateAnnouncement,
  type AnnouncementDraft,
} from '../services/announcements';
import type { Announcement } from '../models/announcements';

interface AnnouncementsContextValue {
  announcements: Announcement[];
  loading: boolean;
  error: string | null;
  /** True for admins — gates every composer and edit control in the UI. */
  canManage: boolean;
  /** False when posts can't leave this browser (no backend, or no admin session). */
  live: boolean;
  /** Whether a Supabase client exists at all. */
  configured: boolean;
  refresh: () => Promise<void>;
  create: (draft: AnnouncementDraft) => Promise<void>;
  update: (id: string, draft: AnnouncementDraft) => Promise<void>;
  remove: (id: string) => Promise<void>;
  togglePinned: (id: string, pinned: boolean) => Promise<void>;
  /** Posts this account hasn't seen yet: the badge, like the app's News tab. */
  unreadCount: number;
  isUnread: (id: string) => boolean;
  markRead: (id: string) => void;
  /** Marks every post seen (clears the badge), as opening News does in the app. */
  markAllRead: () => void;
  /** "Remove from my feed": hidden only for this account (announcement_dismissals). */
  hide: (id: string) => Promise<void>;
  unhide: (id: string) => Promise<void>;
}

/** Without a backend (tests, offline work) read state lives in this browser.
 *  Signed in, it's the shared announcement_reads table, as in the app. */
function readKey(userId: string | undefined): string {
  return `announcement_reads:${userId ?? 'guest'}`;
}

function loadReadIds(userId: string | undefined): Set<string> {
  try {
    const raw = localStorage.getItem(readKey(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(userId: string | undefined, ids: Set<string>): void {
  try {
    localStorage.setItem(readKey(userId), JSON.stringify([...ids]));
  } catch {
    // Storage full or blocked: read state just won't persist.
  }
}

const AnnouncementsContext = createContext<AnnouncementsContextValue | undefined>(
  undefined,
);

export function AnnouncementsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const contentVersion = useSummitContent();
  const { mySchedule, expertSchedule, spectating } = useSchedule();
  // Empty until the feed loads; there are no sample posts for real users.
  const [storedAnnouncements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const userId = profile?.id;
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  // True once read state comes from the shared tables for this account.
  const [sharedState, setSharedState] = useState(false);
  const [feedUserId, setFeedUserId] = useState(userId);
  const announcements = useMemo(() => {
    if (feedUserId !== userId) return [];
    const registered = new Set([...mySchedule, ...expertSchedule, ...spectating]);
    const disciplines = new Set(MOCK_SESSIONS.filter((s) => registered.has(s.id)).map((s) => s.track));
    return announcementsForUser(storedAnnouncements.filter((a) => !hiddenIds.has(a.id)), {
      userId,
      registeredDisciplines: disciplines,
      canManageDiscipline: (id) => canEditVerse(profile, id),
    });
  }, [storedAnnouncements, hiddenIds, feedUserId, userId, profile, mySchedule, expertSchedule, spectating, contentVersion]);
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds(userId));
  // Seen at all (any announcement_reads row); null until loaded from the database.
  const [seenIds, setSeenIds] = useState<Set<string> | null>(null);

  // Switching accounts loads that account's read and hidden state.
  useEffect(() => {
    let current = true;
    setReadIds(loadReadIds(userId));
    setSeenIds(null);
    setHiddenIds(new Set());
    setSharedState(false);
    void Promise.all([fetchOpenedIds(), fetchDismissedIds(), fetchSeenIds()])
      .then(([opened, dismissed, seen]) => {
        if (!current || opened == null) return;
        setReadIds(opened);
        setSeenIds(seen ?? new Set());
        setHiddenIds(dismissed ?? new Set());
        setSharedState(true);
      })
      .catch(() => {
        // Unreachable: keep this browser's copy until the next load.
      });
    return () => { current = false; };
  }, [userId]);

  const markRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev).add(id);
        if (!sharedState) saveReadIds(userId, next);
        return next;
      });
      if (sharedState) {
        setSeenIds((prev) => (prev?.has(id) ? prev : new Set([...(prev ?? []), id])));
        void markOpened([id]).catch(() => {});
      }
    },
    [userId, sharedState],
  );

  const markAllRead = useCallback(() => {
    if (sharedState) {
      // Seen, not opened: the per-post dots stay until each post is opened.
      const ids = announcements.map((a) => a.id).filter((id) => !seenIds?.has(id));
      if (ids.length === 0) return;
      setSeenIds((prev) => new Set([...(prev ?? []), ...ids]));
      void markSeen(ids).catch(() => {});
      return;
    }
    const ids = announcements.map((a) => a.id).filter((id) => !readIds.has(id));
    setReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      saveReadIds(userId, next);
      return next;
    });
  }, [announcements, readIds, seenIds, userId, sharedState]);

  const hide = useCallback(async (id: string) => {
    setHiddenIds((prev) => new Set(prev).add(id));
    try {
      await hideForMe(id);
    } catch (err) {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      throw err;
    }
  }, []);

  const unhide = useCallback(async (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await unhideForMe(id);
  }, []);

  const isUnread = useCallback((id: string) => !readIds.has(id), [readIds]);
  const unreadCount = useMemo(
    () => announcements.filter((a) => !(sharedState && seenIds ? seenIds.has(a.id) || readIds.has(a.id) : readIds.has(a.id))).length,
    [announcements, readIds, seenIds, sharedState],
  );

  const refresh = useCallback(async () => {
    try {
      const result = await fetchAnnouncements();
      const remotelyWritable = result.source === 'remote' && !result.error &&
        isBackendConfigured() && (await canPublishRemotely());
      if (activeUser.current !== userId) return;
      setFeedUserId(userId);
      setAnnouncements(sortAnnouncements(result.announcements));
      setError(result.error ?? null);
      // Live means a post will actually reach other people: the feed is
      // served remotely and this admin has real credentials behind it.
      setLive(remotelyWritable);
    } catch (err: any) {
      if (activeUser.current !== userId) return;
      setError(err?.message ?? 'Could not load announcements');
      setLive(false);
    } finally {
      if (activeUser.current === userId) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setFeedUserId(userId);
    setAnnouncements([]);
    setLoading(true);
    void refresh();
    // Every admin write anywhere lands here, which is what keeps a new post
    // visible on other people's screens without a reload.
    return subscribeToAnnouncements(() => {
      void refresh();
    });
  }, [refresh, userId]);

  const create = useCallback(
    async (draft: AnnouncementDraft) => {
      const created = await createAnnouncement(draft, {
        id: profile?.id,
        name: profile?.name ?? 'Summit Admin',
      });
      // Optimistic: realtime will confirm, but the author shouldn't wait for
      // a round trip to see their own post.
      setAnnouncements((prev) => sortAnnouncements([created, ...prev]));
    },
    [profile],
  );

  const update = useCallback(async (id: string, draft: AnnouncementDraft) => {
    const updated = await updateAnnouncement(id, draft);
    setAnnouncements((prev) =>
      sortAnnouncements(prev.map((a) => (a.id === id ? updated : a))),
    );
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteAnnouncement(id);
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const togglePinned = useCallback(async (id: string, pinned: boolean) => {
    setAnnouncements((prev) =>
      sortAnnouncements(prev.map((a) => (a.id === id ? { ...a, pinned } : a))),
    );
    await setAnnouncementPinned(id, pinned);
  }, []);

  const value = useMemo<AnnouncementsContextValue>(
    () => ({
      announcements,
      loading,
      error,
      canManage: profile?.role === 'admin',
      live,
      configured: isBackendConfigured(),
      refresh,
      create,
      update,
      remove,
      togglePinned,
      unreadCount,
      isUnread,
      markRead,
      markAllRead,
      hide,
      unhide,
    }),
    [
      announcements,
      loading,
      error,
      live,
      profile,
      refresh,
      create,
      update,
      remove,
      togglePinned,
      unreadCount,
      isUnread,
      markRead,
      markAllRead,
      hide,
      unhide,
    ],
  );

  return (
    <AnnouncementsContext.Provider value={value}>
      {children}
    </AnnouncementsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnnouncements(): AnnouncementsContextValue {
  const ctx = useContext(AnnouncementsContext);
  if (ctx === undefined) {
    throw new Error('useAnnouncements must be used within AnnouncementsProvider');
  }
  return ctx;
}
