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
  fetchMyVolunteerAssignments,
  release,
  reserve,
  type ReservationKind,
} from '../services/reservations';

type SessionCount = {
  enrolled: number;
  expertsEnrolled: number;
  spectators: number;
  volunteersEnrolled: number;
};
type SessionCounts = Record<string, SessionCount>;

const COUNT_FOR: Record<ReservationKind, keyof SessionCount> = {
  competing: 'enrolled',
  spectating: 'spectators',
  judging: 'expertsEnrolled',
  volunteering: 'volunteersEnrolled',
};

/**
 * The viewer's schedule: competing, judging (experts), volunteering
 * (volunteers), and spectating session ids, plus every session's seat counts.
 *
 * Signed in, registrations and admin-assigned session_volunteers come from
 * the shared backend. With no backend configured, the schedule lives in this
 * tab and the counts move locally.
 */
interface ScheduleContextValue {
  mySchedule: string[];
  setMySchedule: (ids: string[]) => void;
  expertSchedule: string[];
  setExpertSchedule: (ids: string[]) => void;
  /** Sessions assigned to this volunteer by an admin. */
  volunteerSchedule: string[];
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
  /** Wait for the account's saved schedule before handling an add request. */
  loading: boolean;
  scheduleError: string | null;
  /** The session ids held as this kind of seat. */
  listFor: (kind: ReservationKind) => string[];
}

/**
 * The kind of seat a role takes on its own schedule: participants compete,
 * experts judge, volunteers (and ambassadors) volunteer. Other roles have no
 * schedule of their own.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function ownScheduleKind(role: string | undefined): ReservationKind | null {
  if (role === 'participant') return 'competing';
  if (role === 'expert') return 'judging';
  if (role === 'volunteer' || role === 'ambassador') return 'volunteering';
  return null;
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
  const [volunteerSchedule, setVolunteerSchedule] = useState<string[]>([]);
  const [spectating, setSpectating] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(Boolean(userId));
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  // Local seat-count changes, on top of the loaded counts (local mode only).
  const [deltas, setDeltas] = useState<SessionCounts>({});
  const lists = useRef({ mySchedule, expertSchedule, volunteerSchedule, spectating });
  lists.current = { mySchedule, expertSchedule, volunteerSchedule, spectating };

  // A new account (or signing out) starts from that account's saved schedule.
  useEffect(() => {
    let live = true;
    setMySchedule([]);
    setExpertSchedule([]);
    setVolunteerSchedule([]);
    setSpectating([]);
    setDeltas({});
    setSaved(false);
    setScheduleError(null);
    setLoading(Boolean(userId));
    if (!userId) return;
    const refresh = () => {
      void Promise.all([fetchMyReservations(), fetchMyVolunteerAssignments()]).then(([list, assignments]) => {
        if (!live) return;
        if (list != null) {
          setSaved(true);
          setMySchedule(list.filter((r) => r.kind === 'competing').map((r) => r.sessionId));
          setExpertSchedule(list.filter((r) => r.kind === 'judging').map((r) => r.sessionId));
          setSpectating(list.filter((r) => r.kind === 'spectating').map((r) => r.sessionId));
        }
        if (assignments != null) setVolunteerSchedule(assignments);
        setScheduleError(null);
        setLoading(false);
      }).catch((error: Error) => {
        if (!live) return;
        setScheduleError(error.message || 'We could not load your schedule.');
        setLoading(false);
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      live = false;
      window.removeEventListener('focus', refresh);
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
              volunteersEnrolled: Math.max(0, s.volunteersEnrolled + (d?.volunteersEnrolled ?? 0)),
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
        const d = current[sessionId] ?? { enrolled: 0, expertsEnrolled: 0, spectators: 0, volunteersEnrolled: 0 };
        return { ...current, [sessionId]: { ...d, [count]: d[count] + delta } };
      });
    },
    [saved],
  );

  const kindOf = (id: string): ReservationKind | null => {
    const l = lists.current;
    if (l.mySchedule.includes(id)) return 'competing';
    if (l.expertSchedule.includes(id)) return 'judging';
    if (l.volunteerSchedule.includes(id)) return 'volunteering';
    if (l.spectating.includes(id)) return 'spectating';
    return null;
  };

  const setKind = (id: string, kind: ReservationKind | null) => {
    const without = (ids: string[]) => ids.filter((x) => x !== id);
    setMySchedule((ids) => (kind === 'competing' ? [...without(ids), id] : without(ids)));
    setExpertSchedule((ids) => (kind === 'judging' ? [...without(ids), id] : without(ids)));
    setVolunteerSchedule((ids) => (kind === 'volunteering' ? [...without(ids), id] : without(ids)));
    setSpectating((ids) => (kind === 'spectating' ? [...without(ids), id] : without(ids)));
  };

  const reserveSession = useCallback(
    async (id: string, kind: ReservationKind) => {
      if (scheduleError) throw new Error('We could not load your saved schedule. Refresh the page before making changes.');
      if (kind === 'volunteering' || lists.current.volunteerSchedule.includes(id)) {
        throw new Error('Volunteer sessions are assigned by an admin.');
      }
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
    [saved, updateSessionCount, scheduleError],
  );

  const releaseSession = useCallback(
    async (id: string) => {
      if (scheduleError) throw new Error('We could not load your saved schedule. Refresh the page before making changes.');
      if (lists.current.volunteerSchedule.includes(id)) {
        throw new Error('Only an admin can remove a volunteer assignment.');
      }
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
    [saved, updateSessionCount, scheduleError],
  );

  return (
    <ScheduleContext.Provider
      value={{
        mySchedule,
        setMySchedule,
        expertSchedule,
        setExpertSchedule,
        volunteerSchedule,
        spectating,
        setSpectating,
        sessionCounts,
        updateSessionCount,
        reserveSession,
        releaseSession,
        saved,
        loading,
        scheduleError,
        listFor: (kind) =>
          kind === 'competing'
            ? mySchedule
            : kind === 'judging'
              ? expertSchedule
              : kind === 'volunteering'
                ? volunteerSchedule
                : spectating,
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
