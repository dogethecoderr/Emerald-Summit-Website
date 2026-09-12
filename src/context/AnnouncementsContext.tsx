import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  createAnnouncement,
  deleteAnnouncement,
  canPublishRemotely,
  fetchAnnouncements,
  isBackendConfigured,
  setAnnouncementPinned,
  sortAnnouncements,
  subscribeToAnnouncements,
  updateAnnouncement,
  type AnnouncementDraft,
} from '../services/announcements';
import { MOCK_ANNOUNCEMENTS, type Announcement } from '../models/announcements';

interface AnnouncementsContextValue {
  announcements: Announcement[];
  loading: boolean;
  error: string | null;
  /** True for admins — gates every composer and edit control in the UI. */
  canManage: boolean;
  /** False when posts can't leave this browser (bypass sign-in, or no backend). */
  live: boolean;
  /** Whether a Supabase client exists at all — separates "no backend" from
   *  "signed in locally", which need different advice. */
  configured: boolean;
  refresh: () => Promise<void>;
  create: (draft: AnnouncementDraft) => Promise<void>;
  update: (id: string, draft: AnnouncementDraft) => Promise<void>;
  remove: (id: string) => Promise<void>;
  togglePinned: (id: string, pinned: boolean) => Promise<void>;
}

const AnnouncementsContext = createContext<AnnouncementsContextValue | undefined>(
  undefined,
);

export function AnnouncementsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  // Seeded with the mock feed so the dashboard renders content on first paint
  // instead of an empty panel that fills in a moment later.
  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    sortAnnouncements(MOCK_ANNOUNCEMENTS),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchAnnouncements();
      setAnnouncements(sortAnnouncements(result.announcements));
      setError(result.error ?? null);
      // Live means a post will actually reach other people: the feed is
      // served remotely and this admin has real credentials behind it.
      setLive(
        result.source === 'remote' &&
          isBackendConfigured() &&
          (await canPublishRemotely()),
      );
    } catch (err: any) {
      setError(err?.message ?? 'Could not load announcements');
      setLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Every admin write anywhere lands here, which is what keeps a new post
    // visible on other people's screens without a reload.
    return subscribeToAnnouncements(() => {
      void refresh();
    });
  }, [refresh]);

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
