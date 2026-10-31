import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { USER_DISCIPLINES, type DisciplineInfo } from '../../models/disciplines';
import { MOCK_SESSIONS, TIME_SLOTS, type Session } from '../../models/sessions';
import {
  VERSE_TEXT,
  VERSE_TEXT_DIM,
  mixHex,
  rgba,
  vibeFor,
  type VerseVibe,
} from '../../models/verseVibes';
import VerseMotif from './VerseMotif';
import FlowingBorder from './FlowingBorder';
import { cn } from '@/lib/utils';

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
  const vibe = vibeFor(discipline.name);
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
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const fromPointer = e.clientX !== 0 || e.clientY !== 0;
        onOpen({
          x: fromPointer ? e.clientX : rect.left + rect.width / 2,
          y: fromPointer ? e.clientY : rect.top + rect.height / 2,
        });
      }}
      className="group relative overflow-hidden rounded-[18px] text-left shadow-[0_5px_14px_rgba(0,0,0,0.2)] transition-transform duration-150 ease-out active:scale-[0.97]"
      style={{ background: vibe.background, color: VERSE_TEXT }}
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
            style={{ color: VERSE_TEXT_DIM }}
          />
        </span>
        <span className="mt-3 line-clamp-2 text-[14px] leading-snug">{preview}</span>
        <span className="mt-1 truncate text-[12.5px]" style={{ color: VERSE_TEXT_DIM }}>
          {discipline.description}
        </span>
        <span className="mt-auto flex items-center gap-2 pt-3 text-[12px] font-medium">
          <span className="min-w-0 flex-1 truncate" style={{ color: VERSE_TEXT_DIM }}>
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

/**
 * A verse's own page, opened as a circle of its color growing out of the
 * point that was clicked (mobile: DisciplinePortalRoute + DisciplineScreen).
 */
function VersePage({
  discipline,
  origin,
  mine,
  canSchedule,
  onClosed,
}: {
  discipline: DisciplineInfo;
  origin: { x: number; y: number };
  mine: Set<string>;
  canSchedule: boolean;
  onClosed: () => void;
}) {
  const navigate = useNavigate();
  const vibe = vibeFor(discipline.name);
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
      style={{ background: vibe.background, color: VERSE_TEXT }}
    >
      <VerseMotif vibe={vibe} className="absolute inset-0" />
      <div ref={content} className="absolute inset-0 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 pb-16 pt-8 sm:px-10 sm:pt-10">
          <button
            ref={backButton}
            type="button"
            onClick={close}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
            style={{ background: rgba(vibe.surface, 0.7), color: VERSE_TEXT }}
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <header className="mt-10">
            <VerseBadge vibe={vibe} size={52} />
            <h2 className="mt-4 font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              {discipline.label}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed" style={{ color: VERSE_TEXT_DIM }}>
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
            {canSchedule && (
              <button
                type="button"
                onClick={() => navigate('/schedule')}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-transform hover:translate-x-0.5"
                style={{ background: vibe.accent, color: vibe.background }}
              >
                Build your schedule <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </header>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {sessions.length === 0 && (
              <p style={{ color: VERSE_TEXT_DIM }}>No sessions in this discipline yet.</p>
            )}
            {sessions.map((s) => {
              const left = Math.max(s.capacity - s.enrolled, 0);
              return (
                <article
                  key={s.id}
                  className="rounded-2xl p-4"
                  style={{
                    background: rgba(vibe.surface, 0.88),
                    border: `1px solid ${rgba(vibe.accent, 0.22)}`,
                  }}
                >
                  <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: vibe.accent }}>
                    <span>{s.time}</span>
                    <span style={{ color: VERSE_TEXT_DIM }}>· {s.duration}</span>
                    {mine.has(s.id) && (
                      <span className="ml-auto inline-flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> On your day
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1.5 font-display text-[17px] font-bold leading-snug">{s.title}</h3>
                  <div className="mt-0.5 text-[13px]" style={{ color: VERSE_TEXT_DIM }}>
                    {s.speaker} · {s.location}
                  </div>
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-sm" style={{ background: 'rgba(255,255,255,0.14)' }}>
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(s.enrolled / s.capacity, 1) * 100}%`,
                        background: vibe.accent,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 text-[12px]" style={{ color: VERSE_TEXT_DIM }}>
                    {left === 0 ? 'Full' : `${left} of ${s.capacity} seats left`}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
      <FlowingBorder vibe={vibe} cornerRadius={0} />
    </div>,
    document.body,
  );
}

/** "Explore the verses": the six disciplines, each opening its own world. */
export default function ExploreVerses({
  mine,
  canSchedule,
}: {
  /** Session ids on the viewer's day (competing or spectating). */
  mine: Set<string>;
  canSchedule: boolean;
}) {
  const [opened, setOpened] = useState<{ discipline: DisciplineInfo; origin: { x: number; y: number } } | null>(null);

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2.5 font-display text-xl font-bold tracking-tight sm:text-2xl">
        Explore the verses
        <span className="rounded-full border border-border bg-card px-2.5 py-0.5 font-sans text-[13px] font-semibold tabular-nums text-muted-foreground">
          {USER_DISCIPLINES.length}
        </span>
      </h2>
      <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3')}>
        {USER_DISCIPLINES.map((d) => (
          <VerseCard
            key={d.name}
            discipline={d}
            mine={mine}
            onOpen={(origin) => setOpened({ discipline: d, origin })}
          />
        ))}
      </div>
      {opened && (
        <VersePage
          key={opened.discipline.name}
          discipline={opened.discipline}
          origin={opened.origin}
          mine={mine}
          canSchedule={canSchedule}
          // Only clear this verse: a page still closing must not close the
          // next one opened in the meantime.
          onClosed={() =>
            setOpened((cur) => (cur?.discipline.name === opened.discipline.name ? null : cur))
          }
        />
      )}
    </section>
  );
}
