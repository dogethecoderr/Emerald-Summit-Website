import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookUser,
  CalendarDays,
  Gavel,
  Megaphone,
  Plus,
  QrCode,
  type LucideIcon,
} from '@/components/icons';
import { useAuth } from '../context/AuthContext';
import { MOCK_SESSIONS, joinParts, sessionPlace, type Session } from '../models/sessions';
import { needsProfileSetup } from '../services/auth';
import { missingGateField } from '../models/profileFields';
import { needsCodeOfConduct } from '../models/codeOfConduct';
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
import { pickGreeting } from '../models/greetings';
import LinksCard from '../components/home/LinksCard';
import DisciplinesCard from '../components/home/DisciplinesCard';
import { ExpertDeclinedDialog, ExpertPending, needsExpertApproval } from '../components/ExpertStatus';
import { needsBeamentor } from '../models/beamentor';
import { AboutAppCard, SupportEafCard } from '../components/home/AboutSections';
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
      sub: 'The tracks you serve as an expert',
      icon: Gavel,
    },
  ],
  attendee: [
    {
      to: '/disciplines',
      label: 'Explore',
      sub: 'Add the tracks you want to watch',
      icon: CalendarDays,
    },
  ],
  volunteer: [
    {
      to: '/schedule',
      label: 'View assigned tracks',
      sub: 'Tracks assigned by an organizer',
      icon: CalendarDays,
    },
    {
      to: '/volunteer',
      label: "Tracks I'm managing",
      sub: 'Take attendance for tracks you run',
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

type AgendaKind = 'Participating' | 'Expert' | 'Volunteering' | 'Spectating';

interface AgendaItem {
  session: Session;
  kind: AgendaKind;
}

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
      aria-label={`${left.days} days, ${left.hours} hours, ${left.minutes} minutes until the Summit`}
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
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-emerald">
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
          {joinParts(sessionPlace(s), kind)}
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
  // Picked once per visit to Home, like the app, so it doesn't change on every re-render.
  const [greeting] = useState(() => pickGreeting(new Date()));

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
  if (isSignedIn && (needsProfileSetup(profile) || missingGateField(profile as Parameters<typeof missingGateField>[0])
    || needsCodeOfConduct(profile))) {
    return <Navigate to="/profile" replace />;
  }
  if (isSignedIn && needsBeamentor(profile)) {
    return <Navigate to="/expert/beamentor" replace />;
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
  // Spectators have no reservation kind of their own, but every session they
  // add is a spectating seat, so their day is their spectating list.
  const canSchedule = ownKind != null || roleName === 'attendee';
  const isQrEligible = roleName === 'participant' || roleName === 'ambassador';
  const checkedInAt = profile?.checked_in_at as string | undefined;

  const ownIds = ownKind ? listFor(ownKind) : [];
  const scheduleLabel =
    ownKind === 'volunteering' ? 'View assigned tracks' : 'Explore';
  const ownLabel: AgendaKind =
    ownKind === 'judging' ? 'Expert' : ownKind === 'volunteering' ? 'Volunteering' : 'Participating';
  // Every way a session can be on someone's day, whatever their role (an admin
  // can spectate or manage, a volunteer can also spectate), like My Day.
  const managing = listFor('volunteering');
  const serving = listFor('judging');
  const competing = listFor('competing');
  const kindOf = (id: string): AgendaKind | null =>
    ownIds.includes(id) ? ownLabel
      : managing.includes(id) ? 'Volunteering'
        : serving.includes(id) ? 'Expert'
          : competing.includes(id) ? 'Participating'
            : spectating.includes(id) ? 'Spectating' : null;
  const agenda: AgendaItem[] = MOCK_SESSIONS.flatMap((s) => {
    const kind = kindOf(s.id);
    return kind ? [{ session: s, kind }] : [];
  })
    .sort(
      (a, b) =>
        toMinutes(a.session.time) - toMinutes(b.session.time),
    );
  // The next session that hasn't started: on Summit day that goes by the clock;
  // before it (or while times are hidden) it's simply the first one of the day.
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = showTimes && summitDate === todayIso
    ? agenda.filter((a) => toMinutes(a.session.time) >= nowMinutes)
    : agenda;
  const next = upcoming[0];
  const daySlots = [...new Set(MOCK_SESSIONS.map((s) => s.time))].sort((a, b) => toMinutes(a) - toMinutes(b));
  const slotIndex = next ? daySlots.indexOf(next.session.time) : -1;

  const actions = QUICK_ACTIONS[roleName] ?? [];
  const primaryAction = actions[0];

  const heroSub = agenda.length
    ? `You have ${agenda.length} track${agenda.length === 1 ? '' : 's'} on your schedule.`
    : null;

  const stats = [
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
      {/* hero */}
      <section className="relative mb-5 overflow-hidden rounded-3xl bg-[#0A5F43] p-6 text-white sm:p-8">
        {/* The emerald gradient, three cards wide, slides under the card on
            transform alone so the browser never repaints it. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[300%] animate-gradient-pan bg-[linear-gradient(115deg,#0B2E22_0%,#0A5F43_25%,#0F8C62_50%,#0A5F43_75%,#0B2E22_100%)] will-change-transform motion-reduce:animate-none"
          aria-hidden
        />
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
              {greeting}, {firstName}.
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
                  className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-emerald-deep transition-colors hover:bg-emerald-50"
                >
                  <primaryAction.icon className="h-4 w-4" />
                  {primaryAction.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/announcements')}
                className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                Latest announcements <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Up next, inside the greeting card, for every role. */}
          <section aria-label="Up next" className="w-full rounded-xl border border-white/30 bg-white/[0.14] p-5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.45)] sm:p-6 lg:max-w-[440px] lg:flex-1">
              {next ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                      Up next · {next.kind}
                    </span>
                    <span className="rounded-full bg-emerald-300 px-3 py-1 text-[13px] font-bold text-[#0B2E22]">
                      {showTimes ? next.session.time : `Time ${TBD}`}
                    </span>
                  </div>
                  <div className="mt-2.5 font-display text-[22px] font-bold leading-snug sm:text-[24px]">
                    {next.session.title}
                  </div>
                  <div className="mt-1 text-[13.5px] text-white/80">
                    {joinParts(sessionPlace(next.session), showTimes ? next.session.duration : undefined)}
                  </div>
                  <div className="mt-4 flex gap-1" aria-hidden>
                    {daySlots.map((t, i) => (
                      <span
                        key={t}
                        className={cn(
                          'h-[6px] flex-1 rounded-full',
                          i <= slotIndex ? 'bg-emerald-300' : 'bg-white/20',
                        )}
                      />
                    ))}
                  </div>
                  <div className="mt-2 text-[12.5px] text-white/65">
                    Time slot {slotIndex + 1} of {daySlots.length}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                    Up next
                  </div>
                  <div className="mt-2.5 font-display text-[22px] font-bold leading-snug sm:text-[24px]">
                    {ownKind === 'volunteering' ? 'No shifts yet' : 'Nothing on your day yet'}
                  </div>
                  <div className="mt-1 text-[13.5px] text-white/80">
                    {ownKind === 'volunteering' ? 'An organizer will assign your tracks.' : 'Browse the disciplines to add a track.'}
                  </div>
                </>
              )}
          </section>
        </div>
      </section>

      {/* The app's slideshow and quote, under its header. */}
      <div className="mb-6 flex flex-col gap-5 lg:flex-row">
        <PhotoSlideshow className="lg:flex-[1.25]" />
        <QuoteCard className="lg:flex-1" />
      </div>

      <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-6', showYourDay && 'xl:grid-cols-[minmax(0,1fr)_380px]')}>
        {showYourDay && (
          <section className="glass flex flex-col rounded-3xl p-4 sm:p-6 xl:min-h-[480px]">
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
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-[13px] font-semibold transition-colors hover:border-emerald/40"
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
                    {ownKind === 'volunteering' ? 'No volunteer shifts yet' : 'No tracks yet'}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(ownKind === 'volunteering' ? '/schedule' : '/disciplines')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-emerald px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-deep"
                  >
                    {scheduleLabel} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {agenda.map((item) => (
                    <AgendaRow key={item.session.id} item={item} first={item === next} />
                  ))}
                  {canSchedule && ownKind !== 'volunteering' && (
                    <button
                      type="button"
                      onClick={() => navigate('/disciplines')}
                      className="!mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald/40 px-4 py-3.5 text-[15px] font-semibold text-emerald transition-colors hover:border-emerald hover:bg-emerald/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald"
                    >
                      <Plus className="h-5 w-5" /> Add a track
                    </button>
                  )}
                </div>
              )}
          </section>
        )}

        <div className={cn('flex flex-col gap-6', showYourDay && 'xl:h-0 xl:min-h-full')}>
          {showYourDay && (
            <div className="grid gap-3">
              {stats.map((s) => (
                <StatTile key={s.label} {...s}>
                  {s.label === 'Check-in' && isQrEligible && (
                    <button
                      type="button"
                      onClick={() => navigate('/account')}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-200 px-3 py-2 text-[12.5px] font-semibold text-navy transition-colors hover:bg-sky-100"
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

      <DisciplinesCard />

      <hr className="my-8 border-t border-border/80" aria-hidden />

      <SupportEafCard />

      <hr className="my-8 border-t border-border/80" aria-hidden />

      <LinksCard />

      <hr className="my-8 border-t border-border/80" aria-hidden />

      <AboutAppCard />
    </AppShell>
  );
}
