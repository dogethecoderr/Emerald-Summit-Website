import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';
import { USER_DISCIPLINES, type DisciplineInfo } from '../../models/disciplines';
import { MOCK_SESSIONS, TIME_SLOTS, type Session } from '../../models/sessions';
import { FORMAT_NOTES, TRACKS, tracksForUniverse, type TrackInfo } from '../../models/tracks';
import { useTheme } from '../../context/ThemeContext';
import {
  mixHex,
  rgba,
  vibeFor,
  type VerseVibe,
} from '../../models/verseVibes';
import VerseMotif from './VerseMotif';
import FlowingBorder from './FlowingBorder';

function sessionsFor(id: string): Session[] {
  return MOCK_SESSIONS.filter((s) => s.track === id).sort(
    (a, b) => TIME_SLOTS.indexOf(a.time) - TIME_SLOTS.indexOf(b.time),
  );
}

/** A verse's mark on a tinted square in its colors (mobile: DisciplineBadge). */
function VerseBadge({ vibe, size }: { vibe: VerseVibe; size: number }) {
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

/** One verse on the dashboard (mobile: Discover's _DisciplineListing). */
function VerseCard({
  discipline,
  mine,
  onOpen,
}: {
  discipline: DisciplineInfo;
  mine: Set<string>;
  onOpen: (origin: { x: number; y: number }) => void;
}) {
  const { theme } = useTheme();
  const vibe = vibeFor(discipline.name, theme);
  const sessions = sessionsFor(discipline.name);
  const open = sessions.filter((s) => s.enrolled < s.capacity).length;
  const onDay = sessions.filter((s) => mine.has(s.id)).length;
  const titles = [...new Set(sessions.map((s) => s.title))];
  const preview =
    titles.length === 0
      ? 'No sessions yet.'
      : titles.length === 1
        ? titles[0]
        : titles.length === 2
          ? `${titles[0]} and ${titles[1]}`
          : `${titles[0]}, ${titles[1]} and ${titles.length - 2} more`;
  const facts = sessions.length
    ? `From ${sessions[0].time}  ·  ${open} of ${sessions.length} open`
    : '';

  return (
    <button
      type="button"
      onClick={(e) => onOpen(originOf(e))}
      className="group relative overflow-hidden rounded-[18px] text-left shadow-[0_5px_14px_rgba(0,0,0,0.2)] transition-transform duration-150 ease-out active:scale-[0.97]"
      style={{ background: vibe.background, color: vibe.text }}
    >
      <VerseMotif vibe={vibe} compact className="absolute inset-0" />
      {/* Keep the text side calm so it always reads. */}
      <span
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, ${rgba(vibe.background, 0.9)}, ${rgba(vibe.background, 0.62)})`,
        }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-0 rounded-[18px] transition-colors"
        style={{ border: `1px solid ${rgba(vibe.accent, 0.28)}` }}
        aria-hidden
      />
      <span className="relative flex min-h-[176px] flex-col p-4 pr-3">
        <span className="flex items-center gap-3">
          <VerseBadge vibe={vibe} size={40} />
          <span className="min-w-0 flex-1 truncate font-display text-xl font-extrabold tracking-tight">
            {discipline.label}
          </span>
          <ChevronRight
            className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5"
            style={{ color: vibe.textDim }}
          />
        </span>
        <span className="mt-3 line-clamp-2 text-[14px] leading-snug">{preview}</span>
        <span className="mt-1 truncate text-[12.5px]" style={{ color: vibe.textDim }}>
          {discipline.description}
        </span>
        <span className="mt-auto flex items-center gap-2 pt-3 text-[12px] font-medium">
          <span className="min-w-0 flex-1 truncate" style={{ color: vibe.textDim }}>
            {facts}
          </span>
          {onDay > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 font-bold" style={{ color: vibe.accent }}>
              <Check className="h-3.5 w-3.5" /> {onDay} on your day
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A session in a verse's colors, with its track as a link. */
function VerseSessionCard({
  session: s,
  vibe,
  mine,
  onTrack,
}: {
  session: Session;
  vibe: VerseVibe;
  mine: Set<string>;
  onTrack?: (name: string) => void;
}) {
  const left = Math.max(s.capacity - s.enrolled, 0);
  return (
    <article
      className="rounded-2xl p-4"
      style={{
        background: rgba(vibe.surface, 0.88),
        border: `1px solid ${rgba(vibe.accent, 0.22)}`,
      }}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: vibe.accent }}>
        <span>{s.time}</span>
        <span style={{ color: vibe.textDim }}>· {s.duration}</span>
        {mine.has(s.id) && (
          <span className="ml-auto inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> On your day
          </span>
        )}
      </div>
      <h3 className="mt-1.5 font-display text-[17px] font-bold leading-snug">{s.title}</h3>
      <div className="mt-0.5 text-[13px]" style={{ color: vibe.textDim }}>
        {s.speaker} · {s.location}
      </div>
      {s.trackName && onTrack && (
        <button
          type="button"
          onClick={() => onTrack(s.trackName!)}
          className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold transition-transform hover:translate-x-0.5"
          style={{ background: rgba(vibe.accent, 0.16), color: vibe.accent }}
        >
          {s.trackName} <ChevronRight className="h-3 w-3" />
        </button>
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

/** A row of a verse's tracks as chips; the current one is filled. */
function TrackChips({
  verse,
  vibe,
  current,
  onPick,
}: {
  verse: string;
  vibe: VerseVibe;
  current?: string;
  onPick: (name: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tracksForUniverse(verse).map((name) => {
        const active = name === current;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onPick(name)}
            aria-current={active || undefined}
            className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
            style={
              active
                ? { background: vibe.accent, color: vibe.background }
                : { background: rgba(vibe.surface, 0.8), color: vibe.text, border: `1px solid ${rgba(vibe.accent, 0.3)}` }
            }
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A verse's own page, opened as a circle of its color growing out of the
 * point that was clicked (mobile: DisciplinePortalRoute + DisciplineScreen).
 * With `track`, it opens on that track's page instead; the chips switch
 * between the verse and its tracks without leaving the verse's world.
 */
function VersePage({
  discipline,
  origin,
  track: initialTrack,
  mine,
  canSchedule,
  onClosed,
}: {
  discipline: DisciplineInfo;
  origin: { x: number; y: number };
  track?: string;
  mine: Set<string>;
  canSchedule: boolean;
  onClosed: () => void;
}) {
  const navigate = useNavigate();
  const [trackName, setTrackName] = useState(initialTrack);
  const track = TRACKS.find((t) => t.verse === discipline.name && t.name === trackName);
  const scroller = useRef<HTMLDivElement>(null);
  const show = (name: string | undefined) => {
    setTrackName(name);
    scroller.current?.scrollTo({ top: 0 });
  };
  const { theme } = useTheme();
  const vibe = vibeFor(discipline.name, theme);
  const sessions = sessionsFor(discipline.name);
  const seatsOpen = sessions.reduce((sum, s) => sum + Math.max(s.capacity - s.enrolled, 0), 0);
  const onDay = sessions.filter((s) => mine.has(s.id)).length;
  const shell = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);

  const farthest = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return Math.max(
      Math.hypot(origin.x, origin.y),
      Math.hypot(w - origin.x, origin.y),
      Math.hypot(origin.x, h - origin.y),
      Math.hypot(w - origin.x, h - origin.y),
    );
  }, [origin]);

  // Grow in: the circle eases out to the farthest corner, then the content
  // fades in over the last two thirds (mobile timings: 620ms in, 420ms out).
  useLayoutEffect(() => {
    const el = shell.current;
    const inner = content.current;
    if (!el || !inner) return;
    if (reducedMotion() || typeof el.animate !== 'function') {
      el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' });
      return;
    }
    const at = `at ${origin.x}px ${origin.y}px`;
    el.animate([{ clipPath: `circle(0px ${at})` }, { clipPath: `circle(${farthest()}px ${at})` }], {
      duration: 620,
      easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
      fill: 'forwards',
    });
    inner.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 400,
      delay: 220,
      easing: 'ease-out',
      fill: 'backwards',
    });
  }, [origin, farthest]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const el = shell.current;
    if (!el || reducedMotion() || typeof el.animate !== 'function') {
      onClosed();
      return;
    }
    const at = `at ${origin.x}px ${origin.y}px`;
    const anim = el.animate(
      [{ clipPath: `circle(${farthest()}px ${at})` }, { clipPath: `circle(0px ${at})` }],
      { duration: 420, easing: 'cubic-bezier(0.32, 0, 0.67, 0)', fill: 'forwards' },
    );
    anim.onfinish = onClosed;
  }, [origin, farthest, onClosed]);

  useEffect(() => {
    backButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [close]);

  return createPortal(
    <div
      ref={shell}
      role="dialog"
      aria-modal="true"
      aria-label={discipline.label}
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
              onClick={close}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
              style={{ background: rgba(vibe.surface, 0.7), color: vibe.text }}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            {track ? (
              <TrackView
                track={track}
                discipline={discipline}
                vibe={vibe}
                mine={mine}
                canSchedule={canSchedule}
                onVerse={() => show(undefined)}
                onTrack={show}
              />
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
                      {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
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

                <section className="mt-8">
                  <h3 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: vibe.textDim }}>
                    Tracks
                  </h3>
                  <TrackChips verse={discipline.name} vibe={vibe} onPick={show} />
                </section>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {sessions.length === 0 && (
                    <p style={{ color: vibe.textDim }}>No sessions in this discipline yet.</p>
                  )}
                  {sessions.map((s) => (
                    <VerseSessionCard key={s.id} session={s} vibe={vibe} mine={mine} onTrack={show} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <FlowingBorder vibe={vibe} cornerRadius={0} />
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

/** One track's page, inside its verse's world. */
function TrackView({
  track,
  discipline,
  vibe,
  mine,
  canSchedule,
  onVerse,
  onTrack,
}: {
  track: TrackInfo;
  discipline: DisciplineInfo;
  vibe: VerseVibe;
  mine: Set<string>;
  canSchedule: boolean;
  onVerse: () => void;
  onTrack: (name: string) => void;
}) {
  const navigate = useNavigate();
  const sessions = sessionsFor(discipline.name).filter((s) => s.trackName === track.name);
  return (
    <>
      <header className="mt-10">
        <button
          type="button"
          onClick={onVerse}
          className="inline-flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 text-[13px] font-semibold transition-transform hover:translate-x-0.5"
          style={{ background: rgba(vibe.surface, 0.8), border: `1px solid ${rgba(vibe.accent, 0.3)}` }}
        >
          <VerseBadge vibe={vibe} size={26} />
          {discipline.label}
          <ChevronRight className="h-3.5 w-3.5" style={{ color: vibe.textDim }} />
        </button>
        <div className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: vibe.accent }}>
          Track · Summit '26
        </div>
        <h2 className="mt-2 font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          {track.name}
        </h2>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed" style={{ color: vibe.textDim }}>
          {track.about}
        </p>
        {canSchedule && <ScheduleButton vibe={vibe} onClick={() => navigate('/schedule')} />}
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <section
          className="rounded-2xl p-5"
          style={{ background: rgba(vibe.surface, 0.88), border: `1px solid ${rgba(vibe.accent, 0.22)}` }}
        >
          <h3 className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: vibe.textDim }}>
            Format
          </h3>
          <ul className="mt-3 space-y-3">
            {track.formats.map((f) => (
              <li key={f}>
                <div className="font-display text-[16px] font-bold" style={{ color: vibe.accent }}>
                  {f}
                </div>
                <div className="text-[13.5px]" style={{ color: vibe.textDim }}>
                  {FORMAT_NOTES[f]}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section
          className="rounded-2xl p-5"
          style={{ background: rgba(vibe.surface, 0.88), border: `1px solid ${rgba(vibe.accent, 0.22)}` }}
        >
          <h3 className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: vibe.textDim }}>
            What you can do
          </h3>
          <ul className="mt-3 space-y-2.5">
            {track.ideas.map((idea) => (
              <li key={idea} className="flex gap-2.5 text-[14px] leading-snug">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" style={{ color: vibe.accent }} />
                {idea}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-8">
        <h3 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: vibe.textDim }}>
          Sessions
        </h3>
        {sessions.length === 0 ? (
          <p className="text-[14px]" style={{ color: vibe.textDim }}>
            No sessions announced for this track yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sessions.map((s) => (
              <VerseSessionCard key={s.id} session={s} vibe={vibe} mine={mine} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h3 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: vibe.textDim }}>
          More in {discipline.label}
        </h3>
        <TrackChips verse={discipline.name} vibe={vibe} current={track.name} onPick={onTrack} />
      </section>
    </>
  );
}

type Origin = { x: number; y: number };
type OpenVerse = (verse: string, origin: Origin, track?: string) => void;

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
 * the Tracks row) can open one with useOpenVerse().
 */
export function VersePortalProvider({
  mine,
  canSchedule,
  children,
}: {
  /** Session ids on the viewer's day (competing or spectating). */
  mine: Set<string>;
  canSchedule: boolean;
  children: React.ReactNode;
}) {
  const [opened, setOpened] = useState<{ discipline: DisciplineInfo; origin: Origin; track?: string } | null>(
    null,
  );
  const open = useCallback<OpenVerse>((verse, origin, track) => {
    const discipline = USER_DISCIPLINES.find((d) => d.name === verse);
    if (discipline) setOpened({ discipline, origin, track });
  }, []);

  return (
    <VersePortalContext.Provider value={open}>
      {children}
      {opened && (
        <VersePage
          key={opened.discipline.name}
          discipline={opened.discipline}
          origin={opened.origin}
          track={opened.track}
          mine={mine}
          canSchedule={canSchedule}
          // Only clear this verse: a page still closing must not close the
          // next one opened in the meantime.
          onClosed={() =>
            setOpened((cur) => (cur?.discipline.name === opened.discipline.name ? null : cur))
          }
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

/** "Explore the verses": the six disciplines, each opening its own world. */
export default function ExploreVerses({ mine }: { mine: Set<string> }) {
  const open = useOpenVerse();
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2.5 font-display text-xl font-bold tracking-tight sm:text-2xl">
        Explore the verses
        <span className="rounded-full border border-border bg-card px-2.5 py-0.5 font-sans text-[13px] font-semibold tabular-nums text-muted-foreground">
          {USER_DISCIPLINES.length}
        </span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {USER_DISCIPLINES.map((d) => (
          <VerseCard key={d.name} discipline={d} mine={mine} onOpen={(origin) => open(d.name, origin)} />
        ))}
      </div>
    </section>
  );
}

/**
 * The summit's tracks (areas within each verse, as in the app: Genetics, Mock
 * Trial, CADathon...), each in its verse's colors. Opens that verse's page.
 */
export function VerseTracks() {
  const open = useOpenVerse();
  const { theme } = useTheme();
  const tracks = USER_DISCIPLINES.flatMap((d) =>
    tracksForUniverse(d.name).map((name) => ({ name, verse: d })),
  );
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [mask-image:linear-gradient(to_right,black_90%,transparent)]">
      {tracks.map(({ name, verse }) => {
        const vibe = vibeFor(verse.name, theme);
        const Icon = vibe.icon;
        return (
          <button
            key={`${verse.name}-${name}`}
            type="button"
            onClick={(e) => open(verse.name, originOf(e), name)}
            className="group relative flex h-[118px] w-[200px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl p-3.5 text-left transition-transform duration-150 active:scale-[0.97]"
            style={{
              background: `radial-gradient(120% 90% at 100% 0%, ${rgba(vibe.accent, 0.22)}, transparent 60%), ${vibe.background}`,
              border: `1px solid ${rgba(vibe.accent, 0.28)}`,
              color: vibe.text,
            }}
          >
            <span className="flex items-center justify-between">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: vibe.accent, boxShadow: `0 0 10px ${rgba(vibe.accent, 0.7)}` }}
                aria-hidden
              />
              <Icon className="h-4 w-4 opacity-70" style={{ color: vibe.accent }} />
            </span>
            <span className="mt-auto font-display text-[16px] font-bold leading-tight tracking-tight">
              {name}
            </span>
            <span className="mt-1 flex items-center gap-1 text-[12px]" style={{ color: vibe.textDim }}>
              {verse.label}
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * A session's track as a tag in its verse's colors (the verse's icon, then
 * the track). Opens the track's page, or the verse's when there's no track.
 */
export function TrackTag({ verse, track }: { verse: string; track?: string }) {
  const open = useOpenVerse();
  const { theme } = useTheme();
  const vibe = vibeFor(verse, theme);
  const Icon = vibe.icon;
  const label = track ?? USER_DISCIPLINES.find((d) => d.name === verse)?.label ?? verse;
  return (
    <button
      type="button"
      onClick={(e) => open(verse, originOf(e), track)}
      title={track ? `About ${track}` : undefined}
      className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors"
      style={{
        background: rgba(vibe.accent, 0.13),
        color: vibe.accent,
        boxShadow: `inset 0 0 0 1px ${rgba(vibe.accent, 0.35)}`,
      }}
    >
      <Icon className="h-3 w-3" strokeWidth={2.2} />
      {label}
      <ChevronRight className="-ml-0.5 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

/** Count of every track across the verses, for headings. */
// eslint-disable-next-line react-refresh/only-export-components
export const TRACK_COUNT = USER_DISCIPLINES.reduce((n, d) => n + tracksForUniverse(d.name).length, 0);
