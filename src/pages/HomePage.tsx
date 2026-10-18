import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookUser,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderOpen,
  Gavel,
  Megaphone,
  QrCode,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SIGN_IN_ROLES } from '../models/roles';
import { MOCK_SESSIONS, TIME_SLOTS, type Session } from '../models/sessions';
import { needsProfileSetup } from '../services/auth';
import { useSchedule } from '../context/ScheduleContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import BrandMark from '../components/BrandMark';
import AppShell from '../components/AppShell';
import AnnouncementsPanel from '../components/AnnouncementsPanel';
import QrPassModal from '../components/QrPassModal';
import { disciplineByName } from '../models/disciplines';
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
      sub: 'Reserve competitor or spectator seats',
      icon: CalendarDays,
    },
  ],
  expert: [
    {
      to: '/judging',
      label: 'View judging schedule',
      sub: 'Rooms, times, and walking routes',
      icon: Gavel,
    },
  ],
  attendee: [],
  volunteer: [
    {
      to: '/volunteer',
      label: 'Open Volunteer Hub',
      sub: 'Track roster, check-ins, and attendee support',
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

function RolePicker() {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(ellipse, #0C7A55 0%, transparent 65%)' }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-[1440px] px-6 pb-12 pt-16 lg:px-14 lg:pb-16 lg:pt-20">
        <header className="flex items-center justify-between pb-6 lg:pb-10">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <BrandMark
            logoClassName="h-14 w-14 lg:h-[4.5rem] lg:w-[4.5rem]"
            titleClassName="text-lg font-semibold lg:text-2xl"
            subtitleClassName="text-xs text-muted-foreground lg:text-sm"
            gap="gap-4"
          />
          <span className="w-14" aria-hidden />
        </header>

        <div className="mt-14 pt-4 lg:mt-24 lg:flex lg:items-start lg:gap-16 lg:pt-8 xl:gap-24">
          <div className="lg:sticky lg:top-12 lg:w-[min(100%,420px)] lg:shrink-0">
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl lg:text-[2.75rem] lg:leading-tight">
              Who are you at the Summit?
            </h1>
          </div>

          <div className="mt-10 grid flex-1 gap-3 sm:gap-4 lg:mt-0 xl:gap-5">
            {SIGN_IN_ROLES.map((r, i) => (
              <button
                key={r.name}
                onClick={() => navigate(`/login/${r.name}`)}
                className="glass animate-fade-up group flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all hover:translate-x-1 hover:border-emerald-glow/40 sm:p-5 lg:hover:translate-x-0 lg:hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset lg:h-12 lg:w-12"
                  style={{
                    background: `${r.color}1e`,
                    color: r.color,
                    boxShadow: `inset 0 0 0 1px ${r.color}44`,
                  }}
                >
                  <r.icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-semibold lg:text-base">
                    {r.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground lg:text-sm">
                    {r.description}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-emerald-mint" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type AgendaKind = 'Competing' | 'Judging' | 'Spectating';

interface AgendaItem {
  session: Session;
  kind: AgendaKind;
}

const QUICK_LINKS: QuickAction[] = [
  { to: '/directory', label: 'Directory', sub: 'Find experts & teams', icon: Users },
  { to: '/resources', label: 'Resources', sub: 'Rubrics, guides, files', icon: FolderOpen },
  { to: '/announcements', label: 'Announcements', sub: 'News & schedule changes', icon: Megaphone },
  { to: '/settings', label: 'Settings', sub: 'Profile & preferences', icon: Settings },
];

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
        <div className="text-[14px] font-semibold tabular-nums">{s.time}</div>
        <div className="text-[12px] text-muted-foreground">{s.duration}</div>
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
          {s.location} · {kind}
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
        {first ? 'Up next' : 'Reserved'}
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

/** Tinted session card: discipline-colored panel inside a white frame. */
function FeaturedCard({
  session: s,
  onDetails,
}: {
  session: Session;
  onDetails: () => void;
}) {
  const discipline = disciplineByName(s.track);
  const color = discipline?.color ?? '#0C7A55';
  const trackLabel = discipline?.label ?? 'Keynote';
  const seatsLeft = Math.max(s.capacity - s.enrolled, 0);
  const tags = [s.duration, trackLabel, seatsLeft === 0 ? 'Full' : `${seatsLeft} seats left`];
  return (
    <article className="flex flex-col rounded-[22px] border border-border bg-card p-1.5">
      <div
        className="flex flex-1 flex-col rounded-[18px] p-4"
        style={{ background: `${color}1c` }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-card px-3 py-1 text-[12px] font-semibold tabular-nums">
            {s.time}
          </span>
          <span
            className="h-7 w-7 rounded-full ring-4 ring-card"
            style={{ background: color }}
            aria-hidden
          />
        </div>
        <div className="mt-4 text-[12.5px] font-medium text-muted-foreground">
          {s.speaker}
        </div>
        <h3 className="mt-0.5 font-display text-[19px] font-bold leading-snug tracking-tight">
          {s.title}
        </h3>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-foreground/15 px-2.5 py-0.5 text-[11px] font-medium text-foreground/75"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 px-3 pb-2 pt-3">
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[14px] font-bold tabular-nums">
            {s.enrolled}/{s.capacity}
            <span className="ml-1 text-[12px] font-medium text-muted-foreground">
              seats
            </span>
          </div>
          <div className="truncate text-[12px] text-muted-foreground">{s.location}</div>
        </div>
        <button
          type="button"
          onClick={onDetails}
          className="shrink-0 rounded-full bg-navy px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-navy-bright"
        >
          Details
        </button>
      </div>
    </article>
  );
}

export default function HomePage() {
  const { session, profile, loadingProfile } = useAuth();
  const navigate = useNavigate();
  const { mySchedule, expertSchedule, spectating } = useSchedule();
  const { announcements, canManage } = useAnnouncements();
  const [qrPassOpen, setQrPassOpen] = useState(false);

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

  if (isSignedIn && needsProfileSetup(profile)) {
    return <Navigate to="/profile" replace />;
  }

  if (!isSignedIn) {
    return <RolePicker />;
  }

  const name = (profile?.name as string | undefined) ?? 'User';
  const firstName = name.split(/\s+/)[0];
  const roleName = (profile?.role as string | undefined) ?? 'participant';
  const isExpert = roleName === 'expert';
  const canSchedule = roleName === 'participant' || isExpert;
  const isQrEligible = roleName === 'participant' || roleName === 'ambassador';
  const checkedInAt = profile?.checked_in_at as string | undefined;

  const ownIds = (isExpert ? expertSchedule : mySchedule) ?? [];
  const agenda: AgendaItem[] = MOCK_SESSIONS.filter(
    (s) => ownIds.includes(s.id) || spectating.includes(s.id),
  )
    .map((s) => ({
      session: s,
      kind: (ownIds.includes(s.id)
        ? isExpert
          ? 'Judging'
          : 'Competing'
        : 'Spectating') as AgendaKind,
    }))
    .sort(
      (a, b) =>
        TIME_SLOTS.indexOf(a.session.time) - TIME_SLOTS.indexOf(b.session.time),
    );
  const next = agenda[0];
  const slotIndex = next ? TIME_SLOTS.indexOf(next.session.time) : -1;

  const actions = QUICK_ACTIONS[roleName] ?? [];
  const primaryAction = actions[0];

  const heroSub = next
    ? `You have ${agenda.length} session${agenda.length === 1 ? '' : 's'} on your schedule. First up: ${next.session.title} at ${next.session.time}.`
    : null;

  const stats = [
    {
      label: 'Next up',
      value: next ? next.session.time : '—',
      sub: next ? next.session.location : 'Nothing scheduled yet',
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
      {/* hero */}
      <section className="relative mb-5 animate-gradient-pan overflow-hidden rounded-3xl bg-[linear-gradient(115deg,#0B2E22_0%,#0A5F43_25%,#0F8C62_50%,#0A5F43_75%,#0B2E22_100%)] bg-[length:300%_300%] p-6 text-white motion-reduce:animate-none sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-40 h-[420px] w-[420px] rounded-full bg-emerald-300/30 blur-[110px]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-emerald-300">
              Emerald Summit 2027 · Dublin, CA
            </div>
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
                Latest announcements <ArrowRight className="h-4 w-4" />
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
                      {next.session.time}
                    </span>
                  </div>
                  <div className="mt-2.5 font-display text-[21px] font-bold leading-snug">
                    {next.session.title}
                  </div>
                  <div className="mt-1 text-[13px] text-white/75">
                    {next.session.location} · {next.session.duration}
                  </div>
                  <div className="mt-4 flex gap-1" aria-hidden>
                    {TIME_SLOTS.map((t, i) => (
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
                    Time slot {slotIndex + 1} of {TIME_SLOTS.length}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-emerald-300">
                    Your day
                  </div>
                  <div className="mt-2.5 font-display text-[21px] font-bold leading-snug">
                    Nothing reserved yet
                  </div>
                  <div className="mt-1 text-[13px] text-white/75">
                    {MOCK_SESSIONS.length} sessions across {TIME_SLOTS.length} time slots are open.
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* your day */}
        <section className="glass flex flex-col rounded-3xl p-4 sm:p-6 xl:min-h-[560px]">
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
                Edit schedule <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {canSchedule && agenda.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-emerald">
                <CalendarDays className="h-6 w-6" />
              </span>
              <div className="mt-3 text-[17px] font-semibold">No sessions yet</div>
              <button
                type="button"
                onClick={() => navigate('/schedule')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-emerald px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-deep"
              >
                Build your schedule <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {(canSchedule
                ? agenda
                : MOCK_SESSIONS.slice(0, 5).map((s) => ({
                    session: s,
                    kind: 'Spectating' as AgendaKind,
                  }))
              ).map((item, i) => (
                <AgendaRow key={item.session.id} item={item} first={canSchedule && i === 0} />
              ))}
            </div>
          )}
        </section>

        {/* right rail — on xl, sized by Your day (h-0 + min-h-full) so it never adds empty space */}
        <div className="flex flex-col gap-6 xl:h-0 xl:min-h-full">
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <StatTile key={s.label} {...s}>
                {s.label === 'Check-in' && isQrEligible && (
                  <button
                    type="button"
                    onClick={() => setQrPassOpen(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full bg-sky-200 px-3 py-2 text-[12.5px] font-semibold text-navy transition-colors hover:bg-sky-100"
                  >
                    <QrCode className="h-4 w-4 shrink-0" />
                    <span>My QR Pass</span>
                  </button>
                )}
              </StatTile>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl">
            <AnnouncementsPanel
              announcements={announcements}
              variant="compact"
              onViewAll={() => navigate('/announcements')}
              canManage={canManage}
              onCompose={() => navigate('/announcements')}
            />
          </div>
        </div>
      </div>

      <hr className="my-8 border-t border-border/80" aria-hidden />

      {/* quick access — one full-width row */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold tracking-tight sm:text-2xl">
          Quick access
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {QUICK_LINKS.map(({ to, label, sub, icon: Icon }) => (
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

      {/* featured */}
      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="flex flex-1 items-center gap-2.5 font-display text-xl font-bold tracking-tight sm:text-2xl">
            Featured sessions
            <CountChip count={MOCK_SESSIONS.length} />
          </h2>
          {canSchedule && (
            <button
              type="button"
              onClick={() => navigate('/schedule')}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-deep hover:underline"
            >
              Browse all sessions <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MOCK_SESSIONS.slice(0, 6).map((s) => (
            <FeaturedCard key={s.id} session={s} onDetails={() => navigate(canSchedule ? '/schedule' : '/home')} />
          ))}
        </div>
      </section>
      {isQrEligible && (
        <QrPassModal open={qrPassOpen} onOpenChange={setQrPassOpen} profile={profile} />
      )}
    </AppShell>
  );
}
