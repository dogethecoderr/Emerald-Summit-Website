import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Settings,
  Megaphone,
  ArrowLeftRight,
  FolderOpen,
  QrCode,
  Search,
  Bell,
  ChevronRight,
  CornerDownLeft,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { roleByName, roleLabelFor, USER_ROLES } from '../models/roles';
import { MOCK_SESSIONS } from '../models/sessions';
import BrandMark from './BrandMark';
import QrPassModal from './QrPassModal';
import { cn } from '@/lib/utils';

type NavGroup = 'My Summit' | 'Event' | 'Account';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Roles that see this item; omit = everyone. */
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/home', label: 'Dashboard', icon: LayoutDashboard, group: 'My Summit' },
  {
    to: '/schedule',
    label: 'Schedule',
    icon: CalendarDays,
    group: 'My Summit',
    roles: ['participant', 'expert'],
  },
  {
    to: '/volunteer',
    label: 'Volunteer Hub',
    icon: Users,
    group: 'My Summit',
    roles: ['volunteer'],
  },
  { to: '/announcements', label: 'Announcements', icon: Megaphone, group: 'Event' },
  { to: '/directory', label: 'Directory', icon: Users, group: 'Event' },
  { to: '/resources', label: 'Resources', icon: FolderOpen, group: 'Event' },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'Account' },
];

const NAV_GROUPS: NavGroup[] = ['My Summit', 'Event', 'Account'];

export function navItemsForRole(roleName: string): NavItem[] {
  return NAV_ITEMS.filter((n) => !n.roles || n.roles.includes(roleName));
}

function NavBadge({ to }: { to: string }) {
  const { profile } = useAuth();
  const { mySchedule, expertSchedule, spectating } = useSchedule();
  const { unreadCount = 0 } = useAnnouncements();
  if (to === '/announcements') {
    if (unreadCount === 0) return null;
    return (
      <span
        className="ml-auto rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
        aria-label={`${unreadCount} unread`}
      >
        {unreadCount}
      </span>
    );
  }
  if (to === '/schedule') {
    const scheduleCount =
      profile?.role === 'expert'
        ? (expertSchedule?.length ?? 0)
        : mySchedule.length;
    const count = scheduleCount + spectating.length;
    if (count === 0) return null;
    return (
      <span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white/80">
        {count}
      </span>
    );
  }
  return null;
}

function SidebarLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white',
          isActive &&
            'bg-white/[0.12] font-semibold text-white hover:bg-white/[0.12]',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-sky-300')}
            strokeWidth={1.9}
          />
          <span>{label}</span>
          <NavBadge to={to} />
        </>
      )}
    </NavLink>
  );
}

interface SearchHit {
  key: string;
  label: string;
  sub: string;
  to: string;
  icon: LucideIcon;
}

/**
 * Portal-wide jump bar: matches pages the viewer can open plus session
 * titles, speakers, and rooms. ⌘K / Ctrl+K focuses it from anywhere.
 */
function GlobalSearch({ items }: { items: NavItem[] }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const pages = items
      .filter((n) => n.label.toLowerCase().includes(q))
      .map((n) => ({
        key: n.to,
        label: n.label,
        sub: 'Page',
        to: n.to,
        icon: n.icon,
      }));
    const canSchedule = items.some((n) => n.to === '/schedule');
    const sessions = MOCK_SESSIONS.filter((s) =>
      [s.title, s.speaker, s.location].some((f) => f.toLowerCase().includes(q)),
    ).map((s) => ({
      key: s.id,
      label: s.title,
      sub: `${s.time} · ${s.location}`,
      to: canSchedule ? '/schedule' : '/home',
      icon: CalendarDays,
    }));
    return [...pages, ...sessions].slice(0, 7);
  }, [items, query]);

  const go = (hit: SearchHit) => {
    navigate(hit.to);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full max-w-[440px]">
      <label className="flex items-center gap-2.5 rounded-[10px] border border-border bg-secondary/70 px-3 py-2 transition-colors focus-within:border-emerald/40 focus-within:bg-card">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && hits[active]) {
              go(hits[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Search sessions, pages, rooms…"
          aria-label="Search the portal"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground sm:block">
          ⌘K
        </kbd>
      </label>
      {open && query.trim() && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-xl shadow-emerald-deep/10">
          {hits.length === 0 ? (
            <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">
              No matches for “{query.trim()}”
            </div>
          ) : (
            hits.map((hit, i) => (
              <button
                key={hit.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(hit)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left',
                  i === active && 'bg-accent',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-emerald">
                  <hit.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {hit.label}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {hit.sub}
                  </span>
                </span>
                {i === active && (
                  <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { unreadCount } = useAnnouncements();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const name = (profile?.name as string | undefined) ?? 'Signed in';
  const roleName = (profile?.role as string | undefined) ?? 'participant';
  const role = roleByName(roleName) ?? USER_ROLES[0];
  const roleLabel = roleLabelFor(roleName, profile?.volunteer_subtype);
  const items = navItemsForRole(roleName);
  const settingsItem = items.find((n) => n.to === '/settings');
  const otherItems = items.filter((n) => n.to !== '/settings');
  const mobileItems = [
    ...otherItems.slice(0, 4),
    ...(settingsItem ? [settingsItem] : []),
  ];
  const isQrEligible = roleName === 'participant' || roleName === 'ambassador';
  const [qrPassOpen, setQrPassOpen] = useState(false);
  const hasUnread = (unreadCount ?? 0) > 0;
  const currentPage =
    items.find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`))
      ?.label ?? 'Dashboard';

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-5 bg-navy px-4 pb-4 pt-5 text-white lg:flex">
        <BrandMark
          className="px-2"
          logoClassName="h-10 w-10"
          titleClassName="text-[16px] font-bold tracking-tight text-white"
          subtitleClassName="text-[11px] text-white/55"
          gap="gap-3"
        />

        <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-inset ring-white/10">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: role.color }}
            aria-hidden
          />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[12.5px] font-semibold">
              Summit 2027 · {roleLabel}
            </div>
            <div className="truncate text-[11.5px] text-white/55">
              Emerald High School · Dublin, CA
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto">
          {NAV_GROUPS.map((group) => {
            const groupItems = items.filter((n) => n.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group} className="space-y-0.5">
                <div className="px-3 pb-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/40">
                  {group}
                </div>
                {groupItems.map((item) => (
                  <SidebarLink key={item.to} {...item} />
                ))}
              </div>
            );
          })}
        </nav>

        {isQrEligible && (
          <div className="relative overflow-hidden rounded-2xl bg-[#0b1428] p-4 ring-1 ring-inset ring-white/10">
            {/* concentric arcs, echoing the gem-cut facets */}
            <svg
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 text-white/[0.07]"
              viewBox="0 0 160 160"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <circle cx="120" cy="40" r="30" />
              <circle cx="120" cy="40" r="55" />
              <circle cx="120" cy="40" r="80" />
            </svg>
            <div className="relative font-display text-[17px] font-bold leading-snug">
              Your Summit pass, one tap away
            </div>
            <button
              type="button"
              onClick={() => setQrPassOpen(true)}
              className="relative mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-sky-200 px-3.5 py-2 text-[13px] font-semibold text-navy transition-colors hover:bg-sky-100"
            >
              <QrCode className="h-4 w-4 shrink-0" />
              <span>My QR Pass</span>
            </button>
          </div>
        )}

        {/* Back to the roles page, still signed in. Sign out lives in Settings. */}
        <button
          type="button"
          onClick={() => navigate('/roles')}
          title="Switch role"
          className="group flex w-full items-center gap-2.5 rounded-xl border border-white/10 p-2.5 text-left transition-colors hover:border-white/25 hover:bg-white/[0.06]"
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
            style={{ background: role.color }}
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-semibold">{name}</div>
            <div className="truncate text-[11.5px] text-white/55">{roleLabel}</div>
          </div>
          <span className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-white/55 transition-colors group-hover:text-white">
            <ArrowLeftRight className="h-4 w-4" />
            <span className="sr-only">Switch role</span>
          </span>
        </button>
      </aside>

      <div className="lg:pl-64">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-20 hidden items-center gap-4 border-b border-border/80 bg-card/85 px-8 py-3 backdrop-blur-xl lg:flex">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
            <span className="text-muted-foreground">Portal</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate font-semibold">{currentPage}</span>
          </div>
          <GlobalSearch items={items} />
          <div className="flex flex-1 items-center justify-end gap-3">
            <span
              className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold xl:inline-flex"
              style={{ background: `${role.color}14`, color: role.color }}
            >
              <role.icon className="h-3.5 w-3.5" />
              {roleLabel}
            </span>
            <NavLink
              to="/announcements"
              aria-label="Announcements"
              className="relative rounded-[10px] border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Bell className="h-[18px] w-[18px]" />
              {hasUnread && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-600 ring-2 ring-card" />
              )}
            </NavLink>
          </div>
        </header>

        {/* Mobile top bar */}
        <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between bg-navy px-4 py-2.5 text-white lg:hidden">
          <BrandMark
            logoClassName="h-8 w-8"
            titleClassName="text-[15px] font-bold text-white"
            showSubtitle={false}
            gap="gap-2"
          />
          <div className="flex items-center gap-2">
            {isQrEligible && (
              <button
                type="button"
                onClick={() => setQrPassOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-sky-200 px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-sky-100"
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>My QR Pass</span>
              </button>
            )}
            <NavLink
              to="/announcements"
              aria-label="Announcements"
              className="relative rounded-lg border border-white/15 p-1.5 text-white/70"
            >
              <Bell className="h-4 w-4" />
              {hasUnread && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
              )}
            </NavLink>
            <button
              type="button"
              onClick={() => navigate('/roles')}
              aria-label="Switch role"
              className="rounded-lg border border-white/15 p-1.5 text-white/70 hover:text-white"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <main className="min-w-0 px-4 pb-24 pt-[4.5rem] sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav — Settings last */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around bg-navy px-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden">
        {mobileItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-medium text-white/60',
                isActive && 'bg-white/10 font-bold text-white',
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {isQrEligible && (
        <QrPassModal
          open={qrPassOpen}
          onOpenChange={setQrPassOpen}
          profile={profile}
        />
      )}
    </div>
  );
}
