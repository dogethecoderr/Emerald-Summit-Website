import { useEffect, useState, type KeyboardEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight, Check, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import NewDisciplineDialog from '../components/verse/NewDisciplineDialog';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import VerseMotif from '../components/verse/VerseMotif';
import {
  VerseBadge,
  VersePortalProvider,
  originOf,
  sessionsFor,
  useOpenVerse,
} from '../components/verse/ExploreVerses';
import { useAuth } from '../context/AuthContext';
import { ownScheduleKind, useSchedule } from '../context/ScheduleContext';
import { useTheme } from '../context/ThemeContext';
import { useRequireProfile } from '../hooks/useRequireProfile';
import { countWord, USER_DISCIPLINES, type DisciplineInfo } from '../models/disciplines';
import { tracksForUniverse } from '../models/tracks';
import { rgba, vibeFor, type VerseVibe } from '../models/verseVibes';
import { useSummitContent } from '../services/summitContent';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function useWideScreen(): boolean {
  const query = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => window.matchMedia?.(query).matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

/**
 * The Disciplines tab: every discipline (from the database) side by side, each a panel in its own
 * colors and live motif. On wide screens they sit in a row and the one under
 * the pointer (or keyboard focus) opens up to show its tracks; on phones they
 * stack. Each opens its discipline page, and each track chip opens that track's page.
 */
export default function VersesPage() {
  const { profile } = useAuth();
  const { listFor, spectating } = useSchedule();
  const kind = ownScheduleKind(profile?.role);
  // Every role can add sessions in the app; the session page offers the role's choices.
  const canAdd = profile != null;
  const canSchedule = kind != null || profile?.role === 'attendee';
  const mine = new Set([...(kind ? listFor(kind) : []), ...spectating]);
  return (
    <VersePortalProvider mine={mine} canSchedule={canSchedule} canAdd={canAdd}>
      <VersesBody mine={mine} />
    </VersePortalProvider>
  );
}

function VersesBody({ mine }: { mine: Set<string> }) {
  useSummitContent();
  const { profile } = useAuth();
  const { ready, redirect } = useRequireProfile();
  const wide = useWideScreen();
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const count = countWord(USER_DISCIPLINES.length);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  // Arrow keys walk the row; Home and End jump to the ends.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = USER_DISCIPLINES.length - 1;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? Math.min(active + 1, last)
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? Math.max(active - 1, 0)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next == null) return;
    e.preventDefault();
    setActive(next);
    document.getElementById(`verse-panel-${USER_DISCIPLINES[next].name}`)?.focus();
  };

  return (
    <AppShell>
      <PageHeader
        label="Emerald Summit 2027"
        title={`The ${count} disciplines`}
        sub={`Every track at the Summit lives in one of ${count} disciplines. Open one to see its tracks and sessions.`}
        actions={profile?.role === 'admin' ? (
          <Button onClick={() => setCreating(true)} className="bg-emerald-deep text-white hover:bg-emerald">
            <Plus className="h-4 w-4" /> New discipline
          </Button>
        ) : undefined}
      />
      {profile?.role === 'admin' && <NewDisciplineDialog open={creating} onOpenChange={setCreating} />}

      {wide ? (
        <div
          role="list"
          onKeyDown={onKeyDown}
          className="flex h-[min(76svh,720px)] min-h-[520px] gap-2.5"
        >
          {USER_DISCIPLINES.map((d, i) => (
            <VersePanel
              key={d.name}
              discipline={d}
              index={i}
              expanded={i === active}
              mine={mine}
              onActivate={() => setActive(i)}
            />
          ))}
        </div>
      ) : (
        <div role="list" className="space-y-3">
          {USER_DISCIPLINES.map((d, i) => (
            <VersePanel key={d.name} discipline={d} index={i} expanded stacked mine={mine} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function VersePanel({
  discipline,
  index,
  expanded,
  stacked,
  mine,
  onActivate,
}: {
  discipline: DisciplineInfo;
  index: number;
  expanded: boolean;
  /** Phone layout: a full-width card, always open. */
  stacked?: boolean;
  mine: Set<string>;
  onActivate?: () => void;
}) {
  const { theme } = useTheme();
  const openVerse = useOpenVerse();
  const vibe = vibeFor(discipline.name, theme);
  const sessions = sessionsFor(discipline.name);
  const tracks = tracksForUniverse(discipline.name);
  const seatsOpen = sessions.reduce((sum, s) => sum + Math.max(s.capacity - s.enrolled, 0), 0);
  const onDay = sessions.filter((s) => mine.has(s.id)).length;
  const number = String(index + 1).padStart(2, '0');

  return (
    <div
      role="listitem"
      id={`verse-panel-${discipline.name}`}
      tabIndex={stacked ? undefined : 0}
      aria-label={discipline.label}
      aria-expanded={stacked ? undefined : expanded}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={(e) => {
        // A collapsed panel opens on tap first (touch has no hover).
        if (!expanded) onActivate?.();
        else if (e.target === e.currentTarget) openVerse(discipline.name, originOf(e));
      }}
      className={cn(
        'group relative overflow-hidden rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        stacked
          ? 'min-h-[300px]'
          : 'min-w-0 cursor-pointer transition-[flex-grow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
        !stacked && (expanded ? 'flex-[4.2]' : 'flex-[1]'),
      )}
      style={{
        background: vibe.background,
        color: vibe.text,
        ['--tw-ring-color' as string]: vibe.accent,
        boxShadow: `inset 0 0 0 1px ${rgba(vibe.accent, expanded ? 0.45 : 0.22)}`,
      }}
    >
      <VerseMotif vibe={vibe} compact={!expanded} className="absolute inset-0" />
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${rgba(vibe.background, 0.15)} 0%, ${rgba(vibe.background, 0.55)} 45%, ${rgba(vibe.background, 0.94)} 100%)`,
        }}
        aria-hidden
      />

      {!stacked && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-6 transition-opacity duration-300',
            expanded ? 'opacity-0' : 'opacity-100 delay-150',
          )}
          aria-hidden={expanded}
        >
          <VerseBadge vibe={vibe} size={40} />
          <span
            className="font-display text-[26px] font-extrabold tracking-tight [writing-mode:vertical-rl] rotate-180 xl:text-[30px]"
            style={{ color: vibe.text }}
          >
            {discipline.label}
          </span>
          <span className="font-mono text-[12px] font-semibold" style={{ color: vibe.accent }}>
            {number}
          </span>
        </div>
      )}

      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 flex flex-col p-6 sm:p-8',
          stacked ? 'relative min-h-[300px] justify-end' : 'top-0 justify-end transition-opacity duration-300',
          !stacked && (expanded ? 'opacity-100 delay-200' : 'opacity-0'),
        )}
        aria-hidden={!stacked && !expanded}
      >
        <div className="flex items-center gap-3">
          <VerseBadge vibe={vibe} size={stacked ? 40 : 48} />
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: vibe.accent }}>
            {number} / {String(USER_DISCIPLINES.length).padStart(2, '0')}
          </span>
        </div>
        <h2
          className={cn(
            'mt-4 font-display font-extrabold leading-[1.02] tracking-tight',
            stacked ? 'text-4xl' : 'text-[clamp(2rem,3.4vw,3.75rem)]',
          )}
        >
          {discipline.label}
        </h2>
        <p className="mt-2 text-[15px]" style={{ color: vibe.textDim }}>
          {discipline.description}
        </p>
        <p className="mt-3 text-[14px]">
          <span className="font-bold">{tracks.length} tracks</span>
          {' · '}
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} · {seatsOpen} seats open
          {onDay > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 font-bold" style={{ color: vibe.accent }}>
              <Check className="h-3.5 w-3.5" /> {onDay} on your day
            </span>
          )}
        </p>

        <div className="pointer-events-auto mt-4 flex flex-wrap gap-2">
          {tracks.map((name) => (
            <button
              key={name}
              type="button"
              tabIndex={stacked || expanded ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation();
                openVerse(discipline.name, originOf(e), name);
              }}
              className="rounded-full px-3 py-1 text-[12.5px] font-semibold transition-transform hover:-translate-y-0.5"
              style={{
                background: rgba(vibe.surface, 0.78),
                color: vibe.text,
                border: `1px solid ${rgba(vibe.accent, 0.32)}`,
              }}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="pointer-events-auto mt-5">
          <EnterButton
            vibe={vibe}
            label={`Enter ${discipline.label}`}
            tabIndex={stacked || expanded ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              openVerse(discipline.name, originOf(e));
            }}
          />
        </div>
      </div>
    </div>
  );
}

function EnterButton({
  vibe,
  label,
  tabIndex,
  onClick,
}: {
  vibe: VerseVibe;
  label: string;
  tabIndex: number;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <button
      type="button"
      tabIndex={tabIndex}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform hover:translate-x-0.5"
      style={{ background: vibe.accent, color: vibe.background }}
    >
      {label} <ArrowRight className="h-4 w-4" />
    </button>
  );
}
