import { createContext, useContext, useState, type ReactNode } from 'react';
import { MOCK_SESSIONS } from '../models/sessions';

type SessionCounts = Record<
  string,
  { enrolled: number; expertsEnrolled: number; spectators: number }
>;

const INITIAL_SESSION_COUNTS: SessionCounts = Object.fromEntries(
  MOCK_SESSIONS.map((session) => [
    session.id,
    {
      enrolled: session.enrolled,
      expertsEnrolled: session.expertsEnrolled,
      spectators: session.spectators,
    },
  ]),
);

/**
 * Local-only "my schedule" state (competing + spectating session ids).
 * Not persisted anywhere yet — mirrors the prototype's top-level App state,
 * lifted into context so both the Schedule page and the sidebar badge can
 * read it.
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
    count: keyof SessionCounts[string],
    delta: 1 | -1,
  ) => void;
}

const ScheduleContext = createContext<ScheduleContextValue | undefined>(
  undefined,
);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [mySchedule, setMySchedule] = useState<string[]>([]);
  const [expertSchedule, setExpertSchedule] = useState<string[]>([]);
  const [spectating, setSpectating] = useState<string[]>([]);
  const [sessionCounts, setSessionCounts] = useState<SessionCounts>(
    INITIAL_SESSION_COUNTS,
  );

  const updateSessionCount = (
    sessionId: string,
    count: keyof SessionCounts[string],
    delta: 1 | -1,
  ) => {
    setSessionCounts((current) => {
      const session = current[sessionId];
      if (!session) return current;
      return {
        ...current,
        [sessionId]: {
          ...session,
          [count]: Math.max(0, session[count] + delta),
        },
      };
    });
  };

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
