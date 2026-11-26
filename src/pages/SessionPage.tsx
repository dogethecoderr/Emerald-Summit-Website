import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import SessionView from '../components/session/SessionView';
import FlowingBorder from '../components/verse/FlowingBorder';
import SummitHomeLink from '../components/verse/SummitHomeLink';
import DisciplineWorld, { useFullWorldTargets } from '../components/verse/DisciplineWorld';
import { screenCenter, useCircleReveal, type Origin } from '../components/verse/useCircleReveal';
import { useTheme } from '../context/ThemeContext';
import { MOCK_SESSIONS } from '../models/sessions';
import { rgba, vibeFor } from '../models/verseVibes';
import { useSummitContent } from '../services/summitContent';
import BackButton from '../components/BackButton';

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
  const worldTargets = useFullWorldTargets();
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
      {/* Dimmed and set back: the session's own content leads here. */}
      <DisciplineWorld
        discipline={verse}
        vibe={vibe}
        theme={theme}
        targets={{ ...worldTargets, fy: worldTargets.fy - 0.12, fill: worldTargets.fill * 0.75 }}
        full
        className="absolute inset-0 opacity-45"
      />
      <div ref={content} className="absolute inset-0 overflow-y-auto">
        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-8 sm:px-10 sm:pt-10">
          <div className="mb-8 flex items-center justify-between gap-3">
            <BackButton onClick={() => close(onBack)} style={{ background: rgba(vibe.surface, 0.7), color: vibe.text, borderColor: rgba(vibe.accent, 0.35) }} />
            <SummitHomeLink vibe={vibe} />
          </div>
          {children}
        </div>
      </div>
      <FlowingBorder vibe={vibe} cornerRadius={0} />
    </div>
  );
}
