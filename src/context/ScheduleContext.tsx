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
import { MOCK_SESSIONS } from '../models/sessions';
import { useAuth } from './AuthContext';
import { loadSummitContent, useSummitContent } from '../services/summitContent';
import {
  fetchMyReservations,
  release,
  reserve,
  type ReservationKind,
} from '../services/reservations';

type SessionCount = { enrolled: number; expertsEnrolled: number; spectators: number };
type SessionCounts = Record<string, SessionCount>;

const COUNT_FOR: Record<ReservationKind, keyof SessionCount> = {
  competing: 'enrolled',
  spectating: 'spectators',
  judging: 'expertsEnrolled',
};

/**
 * The viewer's schedule: competing, judging (experts), and spectating
 * session ids, plus every session's seat counts.
 *
 * Signed in with Google, it's saved in session_reservations and the counts are
 * the database's (README: Saved schedules). Demo and expert sessions have no
 * database credentials, so their schedule lives in this tab and the counts
 * move locally.
 */
interface ScheduleContextValue {
  mySchedule: string[];
  setMySchedule: (ids: string[]) => void;
  expertSchedule: string[];
  setExpertSchedule: (ids: string[]) => void;
  spectating: string[];
  setSpectating: (ids: string[]) => void;
  sessionCounts: SessionCounts;
  updateSessionCount: (
    sessionId: string,
    count: keyof SessionCount,
    delta: 1 | -1,
  ) => void;
  /** Puts a session on the schedule as `kind`, replacing any other kind. */
  reserveSession: (sessionId: string, kind: ReservationKind) => Promise<void>;
  /** Takes a session off the schedule. */
  releaseSession: (sessionId: string) => Promise<void>;
  /** True when the schedule is saved to the database. */
  saved: boolean;
}

const ScheduleContext = createContext<ScheduleContextValue | undefined>(
  undefined,
);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const version = useSummitContent();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [mySchedule, setMySchedule] = useState<string[]>([]);
  const [expertSchedule, setExpertSchedule] = useState<string[]>([]);
  const [spectating, setSpectating] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  // Local seat-count changes, on top of the loaded counts (local mode only).
  const [deltas, setDeltas] = useState<SessionCounts>({});
  const lists = useRef({ mySchedule, expertSchedule, spectating });
  lists.current = { mySchedule, expertSchedule, spectating };

  // A new account (or signing out) starts from that account's saved schedule.
  useEffect(() => {
    let live = true;
    setMySchedule([]);
    setExpertSchedule([]);
    setSpectating([]);
    setDeltas({});
    setSaved(false);
    if (!userId) return;
    fetchMyReservations().then((list) => {
      if (!live || list == null) return;
      setSaved(true);
      setMySchedule(list.filter((r) => r.kind === 'competing').map((r) => r.sessionId));
      setExpertSchedule(list.filter((r) => r.kind === 'judging').map((r) => r.sessionId));
      setSpectating(list.filter((r) => r.kind === 'spectating').map((r) => r.sessionId));
    });
    return () => {
      live = false;
    };
  }, [userId]);

  const sessionCounts = useMemo<SessionCounts>(
    () =>
      Object.fromEntries(
        MOCK_SESSIONS.map((s) => {
          const d = deltas[s.id];
          return [
            s.id,
            {
              enrolled: Math.max(0, s.enrolled + (d?.enrolled ?? 0)),
              expertsEnrolled: Math.max(0, s.expertsEnrolled + (d?.expertsEnrolled ?? 0)),
              spectators: Math.max(0, s.spectators + (d?.spectators ?? 0)),
            },
          ];
        }),
      ),
    // MOCK_SESSIONS is the live store; `version` says it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, deltas],
  );

  const updateSessionCount = useCallback(
    (sessionId: string, count: keyof SessionCount, delta: 1 | -1) => {
      if (saved) return; // the database keeps the counts
      setDeltas((current) => {
        const d = current[sessionId] ?? { enrolled: 0, expertsEnrolled: 0, spectators: 0 };
        return { ...current, [sessionId]: { ...d, [count]: d[count] + delta } };
      });
    },
    [saved],
  );

  const kindOf = (id: string): ReservationKind | null => {
    const l = lists.current;
    if (l.mySchedule.includes(id)) return 'competing';
    if (l.expertSchedule.includes(id)) return 'judging';
    if (l.spectating.includes(id)) return 'spectating';
    return null;
  };

  const setKind = (id: string, kind: ReservationKind | null) => {
    const without = (ids: string[]) => ids.filter((x) => x !== id);
    setMySchedule((ids) => (kind === 'competing' ? [...without(ids), id] : without(ids)));
    setExpertSchedule((ids) => (kind === 'judging' ? [...without(ids), id] : without(ids)));
    setSpectating((ids) => (kind === 'spectating' ? [...without(ids), id] : without(ids)));
  };

  const reserveSession = useCallback(
    async (id: string, kind: ReservationKind) => {
      const previous = kindOf(id);
      if (previous === kind) return;
      setKind(id, kind);
      if (!saved) {
        if (previous) updateSessionCount(id, COUNT_FOR[previous], -1);
        updateSessionCount(id, COUNT_FOR[kind], 1);
        return;
      }
      let released = false;
      try {
        if (previous) {
          await release(id);
          released = true;
        }
        await reserve(id, kind);
      } catch (error) {
        // Refused (full, time conflict): put back the seat that was given up.
        if (released && previous) await reserve(id, previous).catch(() => {});
        setKind(id, previous);
        throw error;
      } finally {
        await loadSummitContent();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saved, updateSessionCount],
  );

  const releaseSession = useCallback(
    async (id: string) => {
      const previous = kindOf(id);
      if (!previous) return;
      setKind(id, null);
      if (!saved) {
        updateSessionCount(id, COUNT_FOR[previous], -1);
        return;
      }
      try {
        await release(id);
      } catch (error) {
        setKind(id, previous);
        throw error;
      } finally {
        await loadSummitContent();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saved, updateSessionCount],
  );

  return (
    <ScheduleContext.Provider
      value={{
        mySchedule,
        setMySchedule,
        expertSchedule,
        setExpertSchedule,
        spectating,
        setSpectating,
        sessionCounts,
        updateSessionCount,
        reserveSession,
        releaseSession,
        saved,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSchedule(): ScheduleContextValue {
  const ctx = useContext(ScheduleContext);
  if (ctx === undefined) {
    throw new Error('useSchedule must be used within ScheduleProvider');
  }
  return ctx;
}
