import ThemeToggle from './ThemeToggle';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  House,
  Notepad,
  Compass,
  CalendarDays,
  Sparkles,
  UserRound,
  Megaphone,
  ArrowLeftRight,
  LogOut,
  QrCode,
  Search,
  Bell,
  ChevronRight,
  CornerDownLeft,
  Keynote,
  Team,
  Award,
  Mountains,
  Handshake,
  HeartHandshake,
  type LucideIcon,
} from '@/components/icons';
import { EAF_DONATE_URL } from './home/AboutSections';
import { SPONSOR_FORM_URL, SPONSOR_TIERS, SPONSORSHIP_DETAILS_URL } from '../models/sponsors';
import { USER_DISCIPLINES } from '../models/disciplines';
import { useSummitContent } from '../services/summitContent';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { useNotifications } from '../context/NotificationsContext';
import NotificationBell from './NotificationBell';
import { roleByName, roleLabelFor, USER_ROLES } from '../models/roles';
import { signOut } from '../services/auth';
import { MOCK_SESSIONS, joinParts, sessionPlace } from '../models/sessions';
import { useSiteSwitches } from '../services/siteSwitches';
import BrandMark from './BrandMark';
import QrPassModal from './QrPassModal';
import ChangeRoleDialog from './ChangeRoleDialog';
import { cn } from '@/lib/utils';
import BeamentorBanner from './BeamentorBanner';
import { openSummit27 } from './Summit27Intro';
import { useFadeInAfterSkeleton } from './ui/skeleton';

type NavGroup = 'My Summit' | 'Account';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Roles that see this item; omit = everyone. */
  roles?: string[];
  /** Where a click goes, when that differs from `to` (which sets the highlight). */
  opens?: string;
}

const NAV_ITEMS: NavItem[] = [
  // Same order as the app's tabs: Home · Schedule · Discover · Announcements · Archie.
  // The app still calls the fourth tab News (renamed on the website Nov 13, 2026).
  { to: '/home', label: 'Home', icon: House, group: 'My Summit' },
  {
    to: '/schedule',
    label: 'Schedule',
    icon: Notepad,
    group: 'My Summit',
    roles: ['participant', 'attendee', 'expert', 'volunteer', 'ambassador', 'admin'],
  },
  { to: '/disciplines', label: 'Explore', icon: Compass, group: 'My Summit' },
  { to: '/announcements', label: 'Announcements', icon: Megaphone, group: 'My Summit' },
  { to: '/archie', label: 'Ask Archie', icon: Sparkles, group: 'My Summit' },
  // Summit '27: signed-in only. One tab (Nov 22, 2026; it was three, Keynote,
  // Team and Sponsors, which are now tabs on the page). Clicking it plays the
  // Summit '27 intro (Summit27Intro.tsx).
  { to: '/summit-27', opens: '/summit-27/keynote', label: "Summit '27", icon: Mountains, group: 'My Summit' },
  { to: '/account', label: 'Profile', icon: UserRound, group: 'Account' },
];

const NAV_GROUPS: NavGroup[] = ['My Summit', 'Account'];

export function navItemsForRole(roleName: string): NavItem[] {
  return NAV_ITEMS.filter((n) => !n.roles || n.roles.includes(roleName));
}

function NavBadge({ to }: { to: string }) {
  const { profile } = useAuth();
  const { mySchedule, expertSchedule, spectating } = useSchedule();
  // Announcements has no count: the bell counts new posts, so a post isn't
  // counted twice. Each post keeps its own "New" label there.
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

/**
 * Where a nav item points, whether it's the current page (on `to` and
 * everything under it, so all of /summit-27/…), and its click: Summit '27
 * plays its intro when opened from another page. A modifier click still
 * opens a new tab as usual. Shared by the sidebar and the phone tab bar.
 */
function useNavItem({ to, opens }: NavItem) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const here = pathname === to || pathname.startsWith(`${to}/`);
  const onClick = (e: React.MouseEvent) => {
    if (!opens || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (!here) openSummit27(opens, navigate);
  };
  return { href: opens ?? to, here, onClick };
}

function SidebarLink(item: NavItem) {
  const { to, label, icon: Icon } = item;
  const { href, here, onClick } = useNavItem(item);
  return (
    <NavLink
      to={href}
      aria-current={here ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white',
        here && 'bg-white/[0.12] font-semibold text-white hover:bg-white/[0.12]',
      )}
    >
      <Icon
        className={cn('h-[18px] w-[18px] shrink-0', here && 'text-sky-300')}
        strokeWidth={1.9}
      />
      <span>{label}</span>
      <NavBadge to={to} />
    </NavLink>
  );
}

function TabBarLink(item: NavItem) {
  const { label, icon: Icon } = item;
  const { href, here, onClick } = useNavItem(item);
  return (
    <NavLink
      to={href}
      aria-current={here ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[10.5px] font-medium tracking-tight text-white/60',
        here && 'bg-white/10 font-bold text-white',
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="max-w-full truncate">{label}</span>
    </NavLink>
  );
}

interface SearchHit {
  key: string;
  label: string;
  sub: string;
  /** A portal route, or an outside link (http… opens a new tab, mailto: opens email). */
  to: string;
  icon: LucideIcon;
}

/**
 * The Summit '27 tabs and the Support EAF and sponsor links, so typing
 * "keynote", "donate" or "sponsor" finds them without opening Home or Summit '27 first. Matched on the label and
 * the extra words.
 */
const LINK_HITS: (SearchHit & { words: string[] })[] = [
  // The Summit '27 tabs, findable by name now the sidebar has one Summit '27 tab.
  {
    key: 'summit-27-keynote',
    label: 'Keynote',
    sub: "Summit '27",
    to: '/summit-27/keynote',
    icon: Keynote,
    words: ['keynote', 'speaker'],
  },
  {
    key: 'summit-27-team',
    label: 'Team',
    sub: "Summit '27",
    to: '/summit-27/team',
    icon: Team,
    words: ['team', 'organizers', 'about me'],
  },
  {
    key: 'summit-27-experts',
    label: 'Experts',
    sub: "Summit '27",
    to: '/summit-27/experts',
    icon: Award,
    words: ['experts', 'mentors', 'judges', 'speakers'],
  },
  {
    key: 'summit-27-sponsors',
    label: 'Sponsors',
    sub: "Summit '27",
    to: '/summit-27/sponsors',
    icon: Handshake,
    words: ['sponsors', 'sponsor tiers'],
  },
  {
    key: 'donate',
    label: 'Donate to EAF',
    sub: 'Zeffy donation form · opens in a new tab',
    to: EAF_DONATE_URL,
    icon: HeartHandshake,
    words: ['donate', 'donation', 'give', 'support eaf', 'zeffy', 'tax-deductible'],
  },
  {
    key: 'become-sponsor',
    label: 'Become a sponsor',
    sub: 'Zeffy sponsorship form · opens in a new tab',
    to: SPONSOR_FORM_URL,
    icon: Handshake,
    words: ['sponsor', 'sponsorship', 'support eaf'],
  },
  {
    key: 'sponsorship-details',
    label: 'Sponsorship details',
    sub: 'Tiers and perks on ehsacademics.org · opens in a new tab',
    to: SPONSORSHIP_DETAILS_URL,
    icon: Handshake,
    words: ['sponsor', 'sponsorship', 'tiers', ...SPONSOR_TIERS.map((t) => t.name.toLowerCase())],
  },
];

/**
 * Portal-wide jump bar: matches pages the viewer can open, the donate and
 * sponsor links, disciplines, and session titles, tracks and rooms.
 * ⌘K / Ctrl+K focuses it from anywhere.
 */
function GlobalSearch({ items }: { items: NavItem[] }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { showTimes } = useSiteSwitches();
  // Re-run the search once the disciplines and sessions load from the database.
  const content = useSummitContent();

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
    const links = LINK_HITS.filter((l) =>
      [l.label.toLowerCase(), ...l.words].some((w) => w.includes(q)),
    ).map(({ words: _words, ...hit }) => hit);
    // Opens the discipline's page on Explore (/disciplines?verse=…).
    const disciplines = USER_DISCIPLINES.filter((d) =>
      [d.label, d.description, d.name].some((f) => f.toLowerCase().includes(q)),
    ).map((d) => ({
      key: `discipline-${d.name}`,
      label: d.label,
      sub: d.description ? `Discipline · ${d.description}` : 'Discipline',
      to: `/disciplines?verse=${encodeURIComponent(d.name)}`,
      icon: Compass,
    }));
    // The same fields as the search on the app's Discover tab: title, track,
    // room and discipline.
    const sessions = MOCK_SESSIONS.filter((s) =>
      [s.title, s.trackName, s.location, s.room, s.disciplineName].some((f) => (f ?? '').toLowerCase().includes(q)),
    ).map((s) => ({
      key: s.id,
      label: s.title,
      sub: joinParts(showTimes ? s.time : undefined, sessionPlace(s)),
      to: `/sessions/${s.id}`,
      icon: CalendarDays,
    }));
    return [...pages, ...links, ...disciplines, ...sessions].slice(0, 7);
    // content: the disciplines and sessions arrays change in place when they load.
  },[items, query, showTimes, content]);

  const go = (hit: SearchHit) => {
    if (hit.to.startsWith('mailto:')) window.location.href = hit.to;
    else if (/^https?:/.test(hit.to)) window.open(hit.to, '_blank', 'noopener,noreferrer');
    else navigate(hit.to);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full max-w-[440px]">
      <label className="flex items-center gap-2.5 rounded-md border border-border bg-secondary/70 px-3 py-2 transition-colors focus-within:border-emerald/40 focus-within:bg-card">
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
          placeholder="Search disciplines, tracks, donate…"
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
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useFadeInAfterSkeleton(mainRef);
  const name = (profile?.name as string | undefined) ?? 'Signed in';
  const roleName = (profile?.role as string | undefined) ?? 'participant';
  const role = roleByName(roleName) ?? USER_ROLES[0];
  const roleLabel = roleLabelFor(roleName, profile?.volunteer_subtype);
  const items = navItemsForRole(roleName);
  // On a phone, the bottom bar is the app's tab bar: Home · Schedule ·
  // Discover · Announcements · Archie, then Summit '27 (website only, since
  // Nov 22, 2026). Profile is the avatar in the top bar, as on the app's Home.
  const MOBILE_TABS = ['/home', '/schedule', '/disciplines', '/announcements', '/archie', '/summit-27'];
  const mobileItems = MOBILE_TABS
    .map((to) => items.find((n) => n.to === to))
    .filter((n): n is NavItem => n != null);
  const isQrEligible = roleName === 'participant' || roleName === 'ambassador';
  const [qrPassOpen, setQrPassOpen] = useState(false);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const hasUnread = (unreadCount ?? 0) > 0;
  const currentPage =
    items.find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`))
      ?.label ?? 'Home';

  const handleSignOut = async () => {
    await signOut();
    navigate('/roles', { replace: true });
  };

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-5 bg-navy px-4 pb-4 pt-5 text-white dark:border-r dark:border-white/10 lg:flex">
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
              Emerald High School, Dublin, CA
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
              className="relative mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-sky-200 px-3.5 py-2 text-[13px] font-semibold text-navy transition-colors hover:bg-sky-100"
            >
              <QrCode className="h-4 w-4 shrink-0" />
              <span>My QR Pass</span>
            </button>
          </div>
        )}

        <div className="relative">
          {/* The card itself opens the profile (same as the phone's top-bar
              avatar). Switch role and Sign out are their own buttons on top. */}
          <NavLink
            to="/account"
            aria-label={`Profile: ${name}, ${roleLabel}`}
            className={({ isActive }) =>
              cn(
                'flex w-full items-center gap-2.5 rounded-xl border p-2.5 pr-[94px] text-left transition-colors hover:border-white/25 hover:bg-white/[0.06]',
                isActive ? 'border-white/25 bg-white/[0.06]' : 'border-white/10',
              )
            }
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
              style={{ background: role.color }}
              aria-hidden
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              {/* One line, cut off with "…" when long; hover shows the whole name. */}
              <div className="truncate text-[13px] font-semibold" title={name}>{name}</div>
              <div className="truncate text-[11.5px] text-white/55">{roleLabel}</div>
            </div>
          </NavLink>
          <button
            type="button"
            onClick={() => setChangeRoleOpen(true)}
            aria-label="Switch role"
            className="group/switch absolute right-[54px] top-1/2 flex -translate-y-1/2 items-center rounded-md px-1.5 py-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11.5px] font-semibold text-navy opacity-0 shadow-lg transition-[opacity,transform] duration-150 group-hover/switch:translate-y-0 group-hover/switch:opacity-100 group-focus-visible/switch:translate-y-0 group-focus-visible/switch:opacity-100"
            >
              Switch role
            </span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="group/signout absolute inset-y-1.5 right-1.5 z-10 flex items-center justify-center gap-0 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 text-rose-300 transition-[gap,color,background-color,border-color] hover:gap-1.5 hover:border-rose-500 hover:bg-rose-600 hover:text-white focus-visible:gap-1.5 focus-visible:bg-rose-600 focus-visible:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-[12px] font-semibold transition-[max-width] duration-200 group-hover/signout:max-w-[64px] group-focus-visible/signout:max-w-[64px]">
              Sign out
            </span>
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 hidden items-center gap-4 border-b border-border/80 bg-card/85 px-8 py-3 backdrop-blur-xl lg:flex">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
            <span className="text-muted-foreground">Portal</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate font-semibold">{currentPage}</span>
          </div>
          <GlobalSearch items={items} />
          <div className="flex flex-1 items-center justify-end gap-3">
            <ThemeToggle />
            <span
              className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold xl:inline-flex"
              style={{ background: `${role.color}14`, color: role.color }}
            >
              <role.icon className="h-3.5 w-3.5" />
              {roleLabel}
            </span>
            <NotificationBell />
          </div>
        </header>

        <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between bg-navy px-4 py-2.5 text-white dark:border-b dark:border-white/10 lg:hidden">
          <BrandMark
            logoClassName="h-8 w-8"
            titleClassName="text-[15px] font-bold text-white"
            showSubtitle={false}
            gap="gap-2"
          />
          <div className="flex items-center gap-2">
            <ThemeToggle tone="onDark" />
            {isQrEligible && (
              <button
                type="button"
                onClick={() => setQrPassOpen(true)}
                className="flex items-center gap-1.5 rounded-md bg-sky-200 px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-sky-100"
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>My QR Pass</span>
              </button>
            )}
            <NavLink
              to="/notifications"
              aria-label={hasUnread ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              className="relative rounded-lg border border-white/15 p-1.5 text-white/70"
            >
              <Bell className="h-4 w-4" />
              {hasUnread && (
                <span className="absolute -right-1.5 -top-1.5 min-w-[16px] rounded-full bg-rose-500 px-1 text-center text-[9.5px] font-bold leading-4 text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
            <NavLink
              to="/account"
              aria-label={`Profile: ${name}`}
              className={({ isActive }) =>
                cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-bold text-white',
                  isActive ? 'border-white' : 'border-white/40',
                )
              }
              style={{ background: role.color }}
            >
              {initials || <UserRound className="h-4 w-4" />}
            </NavLink>
          </div>
        </div>

        <main ref={mainRef} className="min-w-0 px-4 pb-28 pt-[4.5rem] sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          <div className="mx-auto max-w-[1400px]"><BeamentorBanner />{children}</div>
        </main>
      </div>

      <nav className="portal-tabbar fixed inset-x-0 bottom-0 z-30 flex justify-around bg-navy px-1 dark:border-t dark:border-white/10 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden">
        {mobileItems.map((item) => (
          <TabBarLink key={item.to} {...item} />
        ))}
      </nav>

      <ChangeRoleDialog open={changeRoleOpen} onOpenChange={setChangeRoleOpen} />
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
