import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Gavel,
  BookUser,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SIGN_IN_ROLES } from '../models/roles';
import { MOCK_SESSIONS, TIME_SLOTS } from '../models/sessions';
import { MOCK_ANNOUNCEMENTS } from '../models/announcements';
import type { PersonStatus } from '../models/personStatus';
import { needsProfileSetup, profileToPerson } from '../services/auth';
import { useSchedule } from '../context/ScheduleContext';
import BrandMark from '../components/BrandMark';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import FeaturedSessionsCard from '../components/FeaturedSessionsCard';
import PersonCard from '../components/PersonCard';
import AnnouncementsPanel from '../components/AnnouncementsPanel';
import { Skeleton } from '@/components/ui/skeleton';

// PLACEHOLDER: no backend field for validation/check-in status yet (see
// src/models/personStatus.ts) — hardcoded until that flow is designed.
const MOCK_STATUS: PersonStatus = 'validated';

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
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground md:text-[15px] lg:text-base">
              Your role shapes what you see — pick the one that fits and sign in.
            </p>
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

export default function HomePage() {
  const { session, profile, loadingProfile } = useAuth();
  const navigate = useNavigate();
  const { mySchedule, spectating } = useSchedule();

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

  const myCount = mySchedule.length;
  const nextSession = MOCK_SESSIONS.filter(
    (s) => mySchedule.includes(s.id) || spectating.includes(s.id),
  ).sort((a, b) => TIME_SLOTS.indexOf(a.time) - TIME_SLOTS.indexOf(b.time))[0];

  const actions = QUICK_ACTIONS[roleName] ?? [];
  const selfPerson = profile
    ? { ...profileToPerson(profile), status: MOCK_STATUS }
    : null;

  const stats = [
    { label: 'My sessions', value: String(myCount) },
    { label: 'Spectating', value: String(spectating.length), icon: Eye },
    {
      label: 'Next up',
      value: nextSession ? nextSession.time : '—',
      sub: nextSession?.location,
    },
    { label: 'Tracks open', value: '20+' },
  ];

  return (
    <AppShell>
      <PageHeader
        label="Emerald High School · Dublin, CA"
        title={`Welcome back, ${firstName}.`}
        sub="Everything about your Summit day — schedule, people, and live updates — in one place."
      />

      {/* stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-2xl px-4 py-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {s.label}
            </div>
            <div className="mt-1 font-display text-2xl font-semibold text-emerald-mint">
              {s.value}
            </div>
            {s.sub && (
              <div className="truncate text-[11px] text-muted-foreground">
                {s.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* role quick actions */}
      {actions.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {actions.map(({ to, label, sub, icon: Icon }) => (
            <button
              key={to + label}
              onClick={() => navigate(to)}
              className="group flex items-center gap-4 rounded-2xl border border-emerald-glow/25 bg-gradient-to-br from-emerald/20 to-emerald-deep/10 p-4 text-left transition-all hover:border-emerald-glow/50 hover:from-emerald/25"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald/25 text-emerald-mint">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{label}</span>
                <span className="block text-xs text-muted-foreground">{sub}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-emerald-mint transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <FeaturedSessionsCard sessions={MOCK_SESSIONS.slice(0, 6)} />
        <div className="space-y-6">
          {selfPerson && (
            <PersonCard
              person={selfPerson}
              viewerRoleName={roleName}
              revealPrivate
              headerAction={
                <button
                  type="button"
                  onClick={() => navigate('/settings/profile')}
                  className="rounded-full border border-border/80 bg-secondary/50 px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-emerald-glow/50 hover:bg-accent"
                >
                  Edit profile
                </button>
              }
            />
          )}
          <AnnouncementsPanel
            announcements={MOCK_ANNOUNCEMENTS}
            variant="compact"
            onViewAll={() => navigate('/announcements')}
          />
        </div>
      </div>
    </AppShell>
  );
}
