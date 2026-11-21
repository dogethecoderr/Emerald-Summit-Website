import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import SessionView from '../components/session/SessionView';
import { screenCenter, useCircleReveal, type Origin } from '../components/verse/useCircleReveal';
import { useTheme } from '../context/ThemeContext';
import { MOCK_SESSIONS } from '../models/sessions';
import { rgba, vibeFor } from '../models/verseVibes';
import { useSummitContent } from '../services/summitContent';

type SessionRouteState = { add?: boolean; origin?: Origin } | null;

/**
 * `/sessions/:id` on its own (from the schedule, Home, a link): the session
 * in its discipline's world, full screen with no sidebar, growing out of the
 * click point like the discipline page does. Opened from a discipline page,
 * a session shows inside that page's world instead (see VersePage).
 */
export default function SessionPage() {
  useSummitContent();
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const session = MOCK_SESSIONS.find((s) => s.id === id);

  if (!session) {
    // The catalog may still be loading from the database.
    return MOCK_SESSIONS.length === 0
      ? <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
      : <Navigate to="/disciplines" replace />;
  }
  const state = location.state as SessionRouteState;
  return (
    <SessionWorld
      key={session.id}
      verse={session.track === 'keynote' ? null : session.track}
      label={session.title}
      origin={state?.origin}
      onBack={() => navigate(-1)}
    >
      <SessionView
        id={session.id}
        wantsAdd={state?.add === true}
        onAddHandled={() => navigate(location.pathname, { replace: true, state: null })}
        onOpenSession={(next, opts) => navigate(`/sessions/${next}`, { state: { add: opts?.add } })}
      />
    </SessionWorld>
  );
}

function SessionWorld({
  verse,
  label,
  origin: from,
  onBack,
  children,
}: {
  verse: string | null;
  label: string;
  origin?: Origin;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const vibe = vibeFor(verse, theme);
  // Fixed for the page's life, so the grow-in runs once.
  const [origin] = useState<Origin>(() => from ?? screenCenter());
  const { shell, content, close } = useCircleReveal(origin);
  return (
    <div
      ref={shell}
      role="main"
      aria-label={label}
      className="fixed inset-0 z-40 overflow-hidden"
      style={{ background: vibe.background, color: vibe.text }}
    >
      <div ref={content} className="absolute inset-0 overflow-y-auto">
        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-8 sm:px-10 sm:pt-10">
          <button
            type="button"
            onClick={() => close(onBack)}
            className="mb-8 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
            style={{ background: rgba(vibe.surface, 0.7), color: vibe.text }}
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}
