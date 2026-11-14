import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookUser,
  CalendarDays,
  ChevronRight,
  Clock,
  FolderOpen,
  Gavel,
  Megaphone,
  QrCode,
  Settings,
  type LucideIcon,
} from '@/components/icons';
import { useAuth } from '../context/AuthContext';
import { MOCK_SESSIONS, joinParts, type Session } from '../models/sessions';
import { needsProfileSetup } from '../services/auth';
import { missingGateField } from '../models/profileFields';
import { toMinutes, useSummitContent } from '../services/summitContent';
import { TBD, useSiteSwitches } from '../services/siteSwitches';
import {
  EVENT_DATE_FALLBACK,
  EVENT_VENUE,
  countdownParts,
  formatDay,
  summitStart,
  useSummitStatus,
} from '../services/summitStatus';
import { ownScheduleKind, useSchedule } from '../context/ScheduleContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import AppShell from '../components/AppShell';
import RolesPage from './RolesPage';
import AnnouncementsPanel from '../components/AnnouncementsPanel';
import PhotoSlideshow from '../components/home/PhotoSlideshow';
import QuoteCard from '../components/home/QuoteCard';
import LinksCard from '../components/home/LinksCard';
import { ExpertDeclinedDialog, ExpertPending, needsExpertApproval } from '../components/ExpertStatus';
import ExploreVerses, {
  trackCount,
  VersePortalProvider,
  VerseTracks,
} from '../components/verse/ExploreVerses';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface QuickAction {
  to: string;
  label: string;
  sub: string;
  icon: LucideIcon;
}

const QUICK_ACTIONS: Record<string, QuickAction[]> = {
  participant: [
    {
      to: '/schedule',
      label: 'Build your schedule',
      sub: 'Reserve participant or spectator seats',
      icon: CalendarDays,
    },
  ],
  expert: [
    {
      to: '/schedule',
      label: 'My schedule',
      sub: 'The sessions you serve as an expert',
      icon: Gavel,
    },
  ],
  attendee: [],
  volunteer: [
    {
      to: '/schedule',
      label: 'View assigned sessions',
      sub: 'Sessions assigned by an admin',
      icon: CalendarDays,
    },
    {
      to: '/volunteer',
      label: "Sessions I'm managing",
      sub: 'Take attendance for sessions you run',
      icon: BookUser,
    },
  ],
  admin: [
    {
      to: '/announcements',
      label: 'Post an announcement',
      sub: 'Share news, files, and media with every profile',
      icon: Megaphone,
    },
  ],
};

/** 'Session' is a plain listing for roles with no schedule of their own. */
type AgendaKind = 'Participating' | 'Expert' | 'Volunteering' | 'Spectating' | 'Session';

interface AgendaItem {
  session: Session;
  kind: AgendaKind;
}

const QUICK_LINKS: QuickAction[] = [
  { to: '/resources', label: 'Resources', sub: 'Rubrics, guides, files', icon: FolderOpen },
  { to: '/announcements', label: 'News', sub: 'Updates and schedule changes', icon: Megaphone },
  { to: '/account', label: 'Profile', sub: 'QR pass & preferences', icon: Settings },
];

/**
 * Counts down to summit day's first session, like the app's Home header.
 * Only shown once the summit date is set, and gone once the summit starts.
 */
function SummitCountdown({ date }: { date: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const start = summitStart(date, MOCK_SESSIONS.map((s) => toMinutes(s.time)));
  const left = countdownParts(start, now);
  if (!left) return null;
  const two = (n: number) => String(n).padStart(2, '0');
  const units: [string, string][] = [
    [String(left.days), left.days === 1 ? 'day' : 'days'],
    [two(left.hours), 'hr'],
    [two(left.minutes), 'min'],
    [two(left.seconds), 'sec'],
  ];
  return (
    <div
      role="timer"
      aria-label={`${left.days} days, ${left.hours} hours, ${left.minutes} minutes until the summit`}
      className="mt-3 flex gap-6"
    >
      {units.map(([value, label]) => (
        <div key={label} aria-hidden>
          <div className="font-display text-[30px] font-bold leading-none tabular-nums">{value}</div>
          <div className="mt-1 text-[12px] font-medium text-white/75">{label}</div>
        </div>
      ))}
    </div>
  );
}

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  children,
}: {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  /** Optional action rendered under the value (e.g. a button). */
  children?: ReactNode;
}) {
  return (
    <div className="glass flex flex-col rounded-2xl p-4 sm:p-[18px]">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent text-emerald">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-[28px]">
        {value}
      </div>
      <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{sub}</div>
      {children && <div className="mt-auto pt-3">{children}</div>}
    </div>
  );
}

function AgendaRow({ item, first }: { item: AgendaItem; first: boolean }) {
  const { session: s, kind } = item;
  const { showTimes } = useSiteSwitches();
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3 py-4 sm:gap-5 sm:px-5',
        first
          ? 'border border-emerald/60 bg-card shadow-[0_6px_18px_-6px_rgba(12,90,64,0.18)]'
          : 'border border-transparent',
      )}
    >
      <div className="w-16 shrink-0 sm:w-20">
        <div className="text-[14px] font-semibold tabular-nums">{showTimes ? s.time : TBD}</div>
        {showTimes && <div className="text-[12px] text-muted-foreground">{s.duration}</div>}
      </div>
      <span
        className={cn(
          'h-3 w-3 shrink-0 rounded-full',
          first ? 'bg-emerald ring-4 ring-emerald/20' : 'bg-border',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-semibold">{s.title}</div>
        <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {joinParts(s.location, kind === 'Session' ? (showTimes ? s.duration : undefined) : kind)}
        </div>
      </div>
      <span
        className={cn(
          'shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold',
          first
            ? 'bg-accent text-emerald-deep'
            : 'border border-border text-muted-foreground',
        )}
      >
        {first ? 'Up next' : showTimes ? s.time : TBD}
      </span>
    </div>
  );
}

function CountChip({ count }: { count: number }) {
  return (
    <span className="rounded-full border border-border bg-card px-2.5 py-0.5 font-sans text-[13px] font-semibold tabular-nums text-muted-foreground">
      {count}
    </span>
  );
}

export default function HomePage() {
  useSummitContent();
  const { date: summitDate } = useSummitStatus();
  // While session times are hidden there's no countdown (it counts to the first session).
  const { showTimes } = useSiteSwitches();
  const { session, profile, loadingProfile } = useAuth();
  const navigate = useNavigate();
  const { listFor, spectating } = useSchedule();
  const { announcements, canPost, isUnread, markRead } = useAnnouncements();

  const isSignedIn = session != null;

  if (isSignedIn && loadingProfile) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  // Like the app's auth gate: finish sign-up, then add a missing number or grade.
  if (isSignedIn && (needsProfileSetup(profile) || missingGateField(profile as Parameters<typeof missingGateField>[0]))) {
    return <Navigate to="/profile" replace />;
  }

  if (!isSignedIn) {
    return <RolesPage />;
  }

  if (needsExpertApproval(profile)) {
    return (
      <AppShell>
        <ExpertPending />
      </AppShell>
    );
  }

  const name = (profile?.name as string | undefined) ?? 'User';
  const firstName = name.split(/\s+/)[0];
  const roleName = (profile?.role as string | undefined) ?? 'participant';
  const ownKind = ownScheduleKind(roleName);
  const showYourDay = roleName !== 'admin';
  const canSchedule = ownKind != null;
  const isQrEligible = roleName === 'participant' || roleName === 'ambassador';
  const checkedInAt = profile?.checked_in_at as string | undefined;

  const ownIds = ownKind ? listFor(ownKind) : [];
  const scheduleLabel =
    ownKind === 'volunteering' ? 'View assigned sessions' : 'Browse sessions';
  const ownLabel: AgendaKind =
    ownKind === 'judging' ? 'Expert' : ownKind === 'volunteering' ? 'Volunteering' : 'Participating';
  const agenda: AgendaItem[] = MOCK_SESSIONS.filter(
    (s) => ownIds.includes(s.id) || spectating.includes(s.id),
  )
    .map((s) => ({
      session: s,
      kind: (ownIds.includes(s.id) ? ownLabel : 'Spectating') as AgendaKind,
    }))
    .sort(
      (a, b) =>
        toMinutes(a.session.time) - toMinutes(b.session.time),
    );
  const mine = new Set([...ownIds, ...spectating]);
  const next = agenda[0];
  const daySlots = [...new Set(MOCK_SESSIONS.map((s) => s.time))].sort((a, b) => toMinutes(a) - toMinutes(b));
  const slotIndex = next ? daySlots.indexOf(next.session.time) : -1;

  const actions = QUICK_ACTIONS[roleName] ?? [];
  const primaryAction = actions[0];

  const heroSub = next
    ? `You have ${agenda.length} session${agenda.length === 1 ? '' : 's'} on your schedule. First up: ${next.session.title}${showTimes ? ` at ${next.session.time}` : ''}.`
    : null;

  const stats = [
    {
      label: 'Next up',
      value: next ? (showTimes ? next.session.time : `Time ${TBD}`) : 'None yet',
      sub: next ? joinParts(next.session.location, showTimes ? next.session.duration : undefined) : 'Nothing scheduled yet',
      icon: Clock,
    },
    {
      label: 'Check-in',
      value: checkedInAt ? 'Checked in' : 'Not yet',
      sub: checkedInAt
        ? `Scanned ${new Date(checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : isQrEligible
          ? 'Show your pass at the door'
          : 'Check in at the front desk',
      icon: QrCode,
    },
  ];

  return (
    <AppShell>
      <ExpertDeclinedDialog />
      <VersePortalProvider mine={mine} canSchedule={canSchedule} canAdd>
      {/* hero */}
      <section className="relative mb-5 animate-gradient-pan overflow-hidden rounded-3xl bg-[linear-gradient(115deg,#0B2E22_0%,#0A5F43_25%,#0F8C62_50%,#0A5F43_75%,#0B2E22_100%)] bg-[length:300%_300%] p-6 text-white motion-reduce:animate-none sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-40 h-[420px] w-[420px] rounded-full bg-emerald-300/30 blur-[110px]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-emerald-300">
              {summitDate ? formatDay(summitDate) : EVENT_DATE_FALLBACK} · {EVENT_VENUE}
            </div>
            {summitDate && showTimes && <SummitCountdown date={summitDate} />}
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-[40px] sm:leading-[1.12]">
              {greetingFor(new Date())}, {firstName}.
            </h1>
            {heroSub && (
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/75">
                {heroSub}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2.5">
              {primaryAction && (
                <button
                  type="button"
                  onClick={() => navigate(primaryAction.to)}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-white px-4 py-2.5 text-sm font-semibold text-emerald-deep transition-colors hover:bg-emerald-50"
                >
                  <primaryAction.icon className="h-4 w-4" />
                  {primaryAction.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/announcements')}
                className="inline-flex items-center gap-2 rounded-[10px] border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                Latest news <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {canSchedule && (
            <div className="w-full rounded-[18px] border border-white/20 bg-white/10 p-5 backdrop-blur-sm lg:w-[360px] lg:shrink-0">
              {next ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-emerald-300">
                      Up next · {next.kind}
                    </span>
                    <span className="rounded-full bg-emerald-300 px-2.5 py-0.5 text-[11.5px] font-bold text-[#0B2E22]">
                      {showTimes ? next.session.time : `Time ${TBD}`}
                    </span>
                  </div>
                  <div className="mt-2.5 font-display text-[21px] font-bold leading-snug">
                    {next.session.title}
                  </div>
                  <div className="mt-1 text-[13px] text-white/75">
                    {joinParts(next.session.location, showTimes ? next.session.duration : undefined)}
                  </div>
                  <div className="mt-4 flex gap-1" aria-hidden>
                    {daySlots.map((t, i) => (
                      <span
                        key={t}
                        className={cn(
                          'h-[5px] flex-1 rounded-full',
                          i <= slotIndex ? 'bg-emerald-300' : 'bg-white/20',
                        )}
                      />
                    ))}
                  </div>
                  <div className="mt-2 text-[11.5px] text-white/60">
                    Time slot {slotIndex + 1} of {daySlots.length}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-emerald-300">
                    Your day
                  </div>
                  <div className="mt-2.5 font-display text-[21px] font-bold leading-snug">
                    {ownKind === 'volunteering' ? 'No shifts yet' : 'Nothing on your day yet'}
                  </div>
                  <div className="mt-1 text-[13px] text-white/75">
                    {ownKind === 'volunteering' ? 'An admin will assign your sessions.' : 'Browse the disciplines to add a session.'}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* The app's slideshow and quote, under its header. */}
      <div className="mb-6 flex flex-col gap-5 lg:flex-row">
        <PhotoSlideshow className="lg:flex-[1.6]" />
        <QuoteCard className="lg:flex-1" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="glass flex flex-col rounded-3xl p-4 sm:p-6 xl:min-h-[560px]">
          {showYourDay && (
            <>
              <div className="mb-4 flex items-start gap-3 px-1">
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight sm:text-[28px]">
                    Your day
                    {canSchedule && <CountChip count={agenda.length} />}
                  </h2>
                </div>
                {canSchedule && (
                  <button
                    type="button"
                    onClick={() => navigate('/schedule')}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-2 text-[13px] font-semibold transition-colors hover:border-emerald/40"
                  >
                    View schedule <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {canSchedule && agenda.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-emerald">
                    <CalendarDays className="h-6 w-6" />
                  </span>
                  <div className="mt-3 text-[17px] font-semibold">
                    {ownKind === 'volunteering' ? 'No volunteer shifts yet' : 'No sessions yet'}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(ownKind === 'volunteering' ? '/schedule' : '/disciplines')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-emerald px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-deep"
                  >
                    {scheduleLabel} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(canSchedule
                    ? agenda
                    : MOCK_SESSIONS.slice(0, 5).map((s) => ({
                        session: s,
                        kind: 'Session' as AgendaKind,
                      }))
                  ).map((item, i) => (
                    <AgendaRow key={item.session.id} item={item} first={canSchedule && i === 0} />
                  ))}
                </div>
              )}
            </>
          )}

          <div className={cn(showYourDay && 'mt-6 border-t border-border/70 pt-5')}>
            <div className="mb-3 flex flex-wrap items-center gap-3 px-1">
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight sm:text-xl">
                  Tracks
                  <CountChip count={trackCount()} />
                </h3>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  Explore this year's tracks and sessions.
                </p>
              </div>
              {canSchedule && agenda.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate(ownKind === 'volunteering' ? '/schedule' : '/disciplines')}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-emerald px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-deep"
                >
                  {scheduleLabel} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <VerseTracks />
          </div>
        </section>

        <div className="flex flex-col gap-6 xl:h-0 xl:min-h-full">
          {showYourDay && (
            <div className="grid grid-cols-2 gap-3">
              {stats.map((s) => (
                <StatTile key={s.label} {...s}>
                  {s.label === 'Check-in' && isQrEligible && (
                    <button
                      type="button"
                      onClick={() => navigate('/account')}
                      className="flex w-full items-center justify-center gap-1.5 rounded-full bg-sky-200 px-3 py-2 text-[12.5px] font-semibold text-navy transition-colors hover:bg-sky-100"
                    >
                      <QrCode className="h-4 w-4 shrink-0" />
                      <span>My QR Pass</span>
                    </button>
                  )}
                </StatTile>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl">
            <AnnouncementsPanel
              announcements={announcements}
              isUnread={isUnread}
              onMarkRead={markRead}
              variant="compact"
              onViewAll={() => navigate('/announcements')}
              onCompose={canPost ? () => navigate('/announcements') : undefined}
            />
          </div>
        </div>
      </div>

      <hr className="my-8 border-t border-border/80" aria-hidden />

      <ExploreVerses mine={mine} />

      <hr className="my-8 border-t border-border/80" aria-hidden />

      <section>
        <h2 className="mb-3 font-display text-xl font-bold tracking-tight sm:text-2xl">
          Quick access
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[...QUICK_LINKS, ...(['volunteer', 'admin', 'ambassador'].includes(roleName) ? [{ to: '/volunteer/contacts', label: 'Volunteer hub', sub: 'Volunteers, admins, and how to reach them', icon: BookUser }] : [])].map(({ to, label, sub, icon: Icon }) => (
            <button
              key={to}
              type="button"
              onClick={() => navigate(to)}
              className="glass group flex items-center gap-3 rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 hover:border-emerald/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-emerald">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">{sub}</span>
              </span>
              <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
            </button>
          ))}
        </div>
      </section>

      <hr className="my-8 border-t border-border/80" aria-hidden />

      <LinksCard />
      </VersePortalProvider>
    </AppShell>
  );
}
