import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Pencil, Plus } from '@/components/icons';
import { USER_DISCIPLINES, type DisciplineInfo } from '../../models/disciplines';
import { MOCK_SESSIONS, joinParts, sessionPlace, type Session } from '../../models/sessions';
import { useTheme } from '../../context/ThemeContext';
import {
  mixHex,
  rgba,
  vibeFor,
  type VerseVibe,
} from '../../models/verseVibes';
import VerseMotif from './VerseMotif';
import EighthGradeBadge from './EighthGradeBadge';
import { EIGHTH_GRADE_BADGE, isEighthGradeParticipant } from '../../models/registration';
import { useAuth } from '../../context/AuthContext';
import { canEditVerse, useSummitContent } from '../../services/summitContent';
import { orderTracks } from '../../models/trackOrder';
import { SessionEditorDialog, type SessionEditorTarget } from './ContentEditors';
import FlowingBorder from './FlowingBorder';
import { growIn, useCircleReveal, type Origin } from './useCircleReveal';
import SessionView from '../session/SessionView';
import { toast } from 'sonner';
import { REGISTRATION_CLOSED_MESSAGE, TBD, useSiteSwitches } from '../../services/siteSwitches';

/** A discipline's tracks, grouped the way its description reads (see models/trackOrder.ts). */
export function sessionsFor(id: string): Session[] {
  return orderTracks(id, MOCK_SESSIONS.filter((s) => s.track === id));
}

/** A verse's mark on a tinted square in its colors (mobile: DisciplineBadge). */
export function VerseBadge({ vibe, size }: { vibe: VerseVibe; size: number }) {
  const Icon = vibe.icon;
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: mixHex(vibe.background, vibe.accent, 0.18),
        border: `1px solid ${rgba(vibe.accent, 0.45)}`,
        color: vibe.accent,
      }}
    >
      <Icon style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={1.9} />
    </span>
  );
}

/**
 * A session in a verse's colors. With onAdd, a + in the top right adds it to
 * the viewer's schedule.
 */
function VerseSessionCard({
  session: s,
  vibe,
  mine,
  eighthGrade,
  onOpen,
  onAdd,
  onEdit,
}: {
  session: Session;
  vibe: VerseVibe;
  mine: Set<string>;
  /** The viewer is an 8th-grade participant: mark the sessions open to them. */
  eighthGrade?: boolean;
  /** Opens the session inside this world instead of following the link. */
  onOpen?: (id: string, from: Origin) => void;
  onAdd?: (id: string, from: Origin) => void;
  /** Opens the session editor; only for people who can edit this verse. */
  onEdit?: (session: Session) => void;
}) {
  const left = Math.max(s.capacity - s.enrolled, 0);
  const { showTimes } = useSiteSwitches();
  return (
    <article
      className="rounded-2xl p-4"
      style={{
        background: rgba(vibe.surface, 0.88),
        border: `1px solid ${rgba(vibe.accent, 0.22)}`,
      }}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: vibe.accent }}>
        {showTimes ? (
          <>
            <span>{s.time}</span>
            <span style={{ color: vibe.textDim }}>· {s.duration}</span>
          </>
        ) : (
          <span>Time {TBD}</span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {onEdit && (
            <button
              type="button"
              aria-label={`Edit ${s.title}`}
              onClick={() => onEdit(s)}
              className="-my-1 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              style={{ color: vibe.textDim }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {mine.has(s.id) ? (
            <span className="inline-flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> On your day
            </span>
          ) : (
            onAdd && <AddToScheduleButton vibe={vibe} full={left === 0} onClick={(e) => onAdd(s.id, originOf(e))} />
          )}
        </span>
      </div>
      <h3 className="mt-1.5 font-display text-[17px] font-bold leading-snug">
        <Link
          to={`/sessions/${s.id}`}
          className="hover:underline"
          onClick={(e) => {
            if (!onOpen || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            onOpen(s.id, originOf(e));
          }}
        >
          {s.title}
        </Link>
      </h3>
      {joinParts(s.speaker, sessionPlace(s)) && (
        <div className="mt-0.5 text-[13px]" style={{ color: vibe.textDim }}>
          {joinParts(s.speaker, sessionPlace(s))}
        </div>
      )}
      {eighthGrade && s.allowEighthGraders && (
        <div className="mt-2">
          <EighthGradeBadge color={vibe.accent} />
        </div>
      )}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-sm" style={{ background: vibe.meter }}>
        <div
          className="h-full"
          style={{ width: `${Math.min(s.enrolled / s.capacity, 1) * 100}%`, background: vibe.accent }}
        />
      </div>
      <div className="mt-1.5 text-[12px]" style={{ color: vibe.textDim }}>
        {left === 0 ? 'Full' : `${left} of ${s.capacity} seats left`}
      </div>
    </article>
  );
}

/** A small pill for editors' actions (add track, edit track, add session). */
function EditChip({
  vibe,
  icon: Icon,
  label,
  onClick,
  dashed,
}: {
  vibe: VerseVibe;
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  dashed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-transform hover:translate-x-0.5"
      style={{
        background: rgba(vibe.surface, 0.6),
        color: vibe.accent,
        border: `1px ${dashed ? 'dashed' : 'solid'} ${rgba(vibe.accent, 0.5)}`,
      }}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

/**
 * A verse's own page, opened as a circle of its color growing out of the
 * point that was clicked (mobile: DisciplinePortalRoute + DisciplineScreen).
 */
function VersePage({
  discipline,
  origin,
  mine,
  canSchedule,
  canAdd,
  onClosed,
}: {
  discipline: DisciplineInfo;
  origin: Origin;
  mine: Set<string>;
  canSchedule: boolean;
  /** Shows the + on session cards, which opens the session with its chooser. */
  canAdd: boolean;
  onClosed: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  useSummitContent();
  const { profile } = useAuth();
  const canEdit = canEditVerse(profile, discipline.name);
  const eighthGrade = isEighthGradeParticipant(profile as Parameters<typeof isEighthGradeParticipant>[0]);
  const [sessionEditor, setSessionEditor] = useState<SessionEditorTarget | null>(null);
  const { theme } = useTheme();
  const vibe = vibeFor(discipline.name, theme);
  const sessions = sessionsFor(discipline.name);
  const seatsOpen = sessions.reduce((sum, s) => sum + Math.max(s.capacity - s.enrolled, 0), 0);
  const onDay = sessions.filter((s) => mine.has(s.id)).length;
  const { shell, content, close } = useCircleReveal(origin);
  const backButton = useRef<HTMLButtonElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sessionPane = useRef<HTMLDivElement>(null);

  // A session opens inside this world (?session=id) instead of on a page of
  // its own, so the background, motif and border carry on untouched and only
  // the content changes, growing out of the click point.
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('session');
  const shown = sessionId ? MOCK_SESSIONS.find((s) => s.id === sessionId) : undefined;
  const [addFor, setAddFor] = useState<string | null>(null);
  const clickPoint = useRef<Origin | null>(null);
  const listScroll = useRef(0);
  const firstPaint = useRef(true);

  const openSession = useCallback(
    (id: string, opts?: { add?: boolean; from?: Origin }) => {
      if (!sessionId) listScroll.current = scroller.current?.scrollTop ?? 0;
      clickPoint.current = opts?.from ?? null;
      setAddFor(opts?.add ? id : null);
      setParams(
        (cur) => {
          const next = new URLSearchParams(cur);
          next.set('session', id);
          return next;
        },
        { state: { sessionPushed: true } },
      );
    },
    [sessionId, setParams],
  );
  const backToList = useCallback(() => {
    // Opened from this page: step back in history, so the browser's Back
    // agrees. Opened straight from a Discover chip: just drop the session.
    if ((location.state as { sessionPushed?: boolean } | null)?.sessionPushed) navigate(-1);
    else
      setParams(
        (cur) => {
          const next = new URLSearchParams(cur);
          next.delete('session');
          return next;
        },
        { replace: true },
      );
  }, [location.state, navigate, setParams]);
  const back = useCallback(() => (sessionId ? backToList() : close(onClosed)), [sessionId, backToList, close, onClosed]);

  // Switching between the list and a session: a session starts at the top
  // and grows in; the list comes back where it was left.
  useLayoutEffect(() => {
    const first = firstPaint.current;
    firstPaint.current = false;
    const el = scroller.current;
    if (!el) return;
    if (sessionId) {
      el.scrollTop = 0;
      if (!first) growIn(sessionPane.current, clickPoint.current);
    } else {
      el.scrollTop = listScroll.current;
    }
  }, [sessionId]);

  useEffect(() => {
    backButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape in an open editor (or its menus) closes that, not the verse:
      // Radix handles it first and marks it handled.
      if (e.key === 'Escape' && !e.defaultPrevented) back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back]);

  return createPortal(
    <div
      ref={shell}
      role="dialog"
      aria-modal="true"
      aria-label={shown ? shown.title : discipline.label}
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ background: vibe.background, color: vibe.text }}
    >
      <VerseMotif vibe={vibe} className="absolute inset-0" />
      <div ref={content} className="absolute inset-0">
        <div ref={scroller} className="h-full overflow-y-auto">
          <div className="mx-auto max-w-4xl px-6 pb-16 pt-8 sm:px-10 sm:pt-10">
            <button
              ref={backButton}
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
              style={{ background: rgba(vibe.surface, 0.7), color: vibe.text }}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            {sessionId ? (
              <div ref={sessionPane} key={sessionId} className="mt-8">
                <SessionView
                  id={sessionId}
                  wantsAdd={addFor === sessionId}
                  onAddHandled={() => setAddFor(null)}
                  onOpenSession={(id, opts) => openSession(id, opts)}
                />
              </div>
            ) : (
              <>
                <header className="mt-10">
                  <VerseBadge vibe={vibe} size={52} />
                  <h2 className="mt-4 font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
                    {discipline.label}
                  </h2>
                  <p className="mt-2 text-[15px] leading-relaxed" style={{ color: vibe.textDim }}>
                    {discipline.description}
                  </p>
                  <p className="mt-4 text-[15px]">
                    <span className="font-bold">
                      {sessions.length} {sessions.length === 1 ? 'track' : 'tracks'}
                    </span>
                    , {seatsOpen} seats open
                    {onDay > 0 && (
                      <span className="font-bold" style={{ color: vibe.accent }}>
                        . {onDay} on your day
                      </span>
                    )}
                  </p>
                  {canSchedule && <ScheduleButton vibe={vibe} onClick={() => navigate('/schedule')} />}
                </header>

                <div className="mt-8 mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: vibe.textDim }}>
                    Tracks
                  </h3>
                  {canEdit && (
                    <EditChip
                      vibe={vibe}
                      icon={Plus}
                      label="Add track"
                      onClick={() => setSessionEditor({ verse: discipline.name })}
                      dashed
                    />
                  )}
                </div>
                {eighthGrade && (
                  <p className="mb-3 text-[13px]" style={{ color: vibe.textDim }}>
                    Tracks marked "{EIGHTH_GRADE_BADGE}" are the ones you can participate in. You can spectate any of them.
                  </p>
                )}
                {/* Fills down the first column, then the second, so each group reads as a column (TechVerse: tech, then engineering). */}
                <div
                  className="grid gap-3 sm:grid-flow-col sm:grid-cols-2 sm:[grid-template-rows:repeat(var(--rows),auto)]"
                  style={{ '--rows': Math.max(1, Math.ceil(sessions.length / 2)) } as React.CSSProperties}
                >
                  {sessions.length === 0 && (
                    <p style={{ color: vibe.textDim }}>No tracks in this discipline yet.</p>
                  )}
                  {sessions.map((s) => (
                    <VerseSessionCard
                      key={s.id}
                      session={s}
                      vibe={vibe}
                      mine={mine}
                      eighthGrade={eighthGrade}
                      onOpen={(id, from) => openSession(id, { from })}
                      onAdd={canAdd ? (id, from) => openSession(id, { add: true, from }) : undefined}
                      onEdit={canEdit ? (session) => setSessionEditor({ verse: discipline.name, session }) : undefined}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <FlowingBorder vibe={vibe} cornerRadius={0} />
      <SessionEditorDialog target={sessionEditor} onClose={() => setSessionEditor(null)} />
    </div>,
    document.body,
  );
}

function ScheduleButton({ vibe, onClick }: { vibe: VerseVibe; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-transform hover:translate-x-0.5"
      style={{ background: vibe.accent, color: vibe.background }}
    >
      Build your schedule <ChevronRight className="h-4 w-4" />
    </button>
  );
}

/**
 * The session card's +, with an "Add to schedule" label above it on hover.
 * Dark green with a white + in every verse, like the Schedule page's +.
 */
function AddToScheduleButton({
  vibe,
  full,
  onClick,
}: {
  vibe: VerseVibe;
  full: boolean;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  // Greyed out until website_registration_open is set on the backend.
  // aria-disabled (not disabled) so a tap still explains why.
  const { registrationOpen } = useSiteSwitches();
  const closed = !registrationOpen;
  const label = closed ? REGISTRATION_CLOSED_MESSAGE : full ? 'Track full' : 'Add to schedule';
  return (
    <span className="group relative -my-1">
      <button
        type="button"
        aria-label={label}
        aria-disabled={closed || undefined}
        disabled={full && !closed}
        onClick={closed ? () => toast(REGISTRATION_CLOSED_MESSAGE) : onClick}
        className={
          closed
            ? 'flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full bg-neutral-400 text-white opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2'
            : 'flex h-8 w-8 items-center justify-center rounded-full bg-emerald-deep text-white shadow-sm transition-all hover:scale-110 hover:bg-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-emerald-deep'
        }
      >
        <Plus className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg px-2.5 py-1 text-[12px] font-semibold opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        style={{ background: vibe.text, color: vibe.surface }}
      >
        {label}
      </span>
    </span>
  );
}

/** Opens a discipline's page, or one of its sessions inside it. */
type OpenVerse = (verse: string, origin: Origin, sessionId?: string) => void;

const VersePortalContext = createContext<OpenVerse | null>(null);

/** Click point for an element: the pointer, or its center for keyboard. */
export function originOf(e: React.MouseEvent<HTMLElement>): Origin {
  const rect = e.currentTarget.getBoundingClientRect();
  const fromPointer = e.clientX !== 0 || e.clientY !== 0;
  return {
    x: fromPointer ? e.clientX : rect.left + rect.width / 2,
    y: fromPointer ? e.clientY : rect.top + rect.height / 2,
  };
}

/**
 * Owns the open verse page, so anything on the dashboard (the verse cards,
 * the Enter buttons) can open one with useOpenVerse().
 */
export function VersePortalProvider({
  mine,
  canSchedule,
  canAdd = canSchedule,
  children,
}: {
  /** Session ids on the viewer's day (competing or spectating). */
  mine: Set<string>;
  /** Shows the "Build your schedule" link on verse pages. */
  canSchedule: boolean;
  /** Shows the + on session cards. Defaults to canSchedule. */
  canAdd?: boolean;
  children: React.ReactNode;
}) {
  const content = useSummitContent();
  const [opened, setOpened] = useState<{ discipline: DisciplineInfo; origin: Origin } | null>(null);
  // The open discipline lives in the URL (?verse=techverse), so Back from one
  // of its session pages comes back to the discipline page, not the grid.
  const [params, setParams] = useSearchParams();
  const verseInUrl = params.get('verse');
  // The ?verse= already shown, so closing it doesn't open it again before
  // the URL catches up.
  const shownFromUrl = useRef<string | null>(null);
  const setVerseInUrl = useCallback(
    (verse: string | null, sessionId?: string) =>
      setParams(
        (cur) => {
          const next = new URLSearchParams(cur);
          if (verse) next.set('verse', verse);
          else next.delete('verse');
          if (sessionId) next.set('session', sessionId);
          else next.delete('session');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const open = useCallback<OpenVerse>(
    (verse, origin, sessionId) => {
      const discipline = USER_DISCIPLINES.find((d) => d.name === verse);
      if (!discipline) return;
      shownFromUrl.current = verse;
      setOpened({ discipline, origin });
      setVerseInUrl(verse, sessionId);
    },
    [setVerseInUrl],
  );
  // Coming back with ?verse=: open it from the middle of the screen. Waits
  // for the disciplines to load from the database if they haven't yet.
  useEffect(() => {
    if (!verseInUrl) {
      shownFromUrl.current = null;
      return;
    }
    if (shownFromUrl.current === verseInUrl) return;
    const discipline = USER_DISCIPLINES.find((d) => d.name === verseInUrl);
    if (!discipline) return;
    shownFromUrl.current = verseInUrl;
    setOpened({ discipline, origin: { x: window.innerWidth / 2, y: window.innerHeight / 2 } });
  }, [verseInUrl, content]);

  return (
    <VersePortalContext.Provider value={open}>
      {children}
      {opened && (
        <VersePage
          key={opened.discipline.name}
          discipline={opened.discipline}
          origin={opened.origin}
          mine={mine}
          canSchedule={canSchedule}
          // The + opens the session in place with the app's "Add to my
          // day" choices and checks.
          canAdd={canAdd}
          // Only clear this verse: a page still closing must not close the
          // next one opened in the meantime.
          onClosed={() => {
            setOpened((cur) => (cur?.discipline.name === opened.discipline.name ? null : cur));
            if (verseInUrl === opened.discipline.name) setVerseInUrl(null);
          }}
        />
      )}
    </VersePortalContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOpenVerse(): OpenVerse {
  const open = useContext(VersePortalContext);
  if (!open) throw new Error('useOpenVerse must be used inside VersePortalProvider');
  return open;
}
