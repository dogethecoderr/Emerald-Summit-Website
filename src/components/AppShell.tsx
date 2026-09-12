import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Settings,
  Megaphone,
  LogOut,
  FolderOpen,
  QrCode,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { signOut } from '../services/auth';
import { roleByName, USER_ROLES } from '../models/roles';
import BrandMark from './BrandMark';
import QrPassModal from './QrPassModal';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Roles that see this item; omit = everyone. */
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/home', label: 'Dashboard', icon: LayoutDashboard },
  {
    to: '/schedule',
    label: 'Schedule',
    icon: CalendarDays,
    roles: ['participant', 'expert'],
  },
  { to: '/volunteer', label: 'Volunteer Hub', icon: Users, roles: ['volunteer'] },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/directory', label: 'Directory', icon: Users },
  { to: '/resources', label: 'Resources', icon: FolderOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function navItemsForRole(roleName: string): NavItem[] {
  return NAV_ITEMS.filter((n) => !n.roles || n.roles.includes(roleName));
}

function NavBadge({ to }: { to: string }) {
  const { profile } = useAuth();
  const { mySchedule, expertSchedule, spectating } = useSchedule();
  const { announcements } = useAnnouncements();
  if (to === '/announcements') {
    const pinned = announcements.filter((a) => a.pinned).length;
    if (pinned === 0) return null;
    return (
      <span className="ml-auto rounded-full bg-emerald px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
        {pinned}
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
      <span className="ml-auto rounded-full border border-emerald-glow/50 px-1.5 py-0.5 text-[10px] font-bold leading-none text-emerald-mint">
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
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground',
          isActive &&
            'bg-emerald/15 text-emerald-mint ring-1 ring-inset ring-emerald-glow/30 hover:bg-emerald/20 hover:text-emerald-mint',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      <NavBadge to={to} />
    </NavLink>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const name = (profile?.name as string | undefined) ?? 'Signed in';
  const email = (profile?.email as string | undefined) ?? '';
  const roleName = (profile?.role as string | undefined) ?? 'participant';
  const role = roleByName(roleName) ?? USER_ROLES[0];
  const items = navItemsForRole(roleName);
  const settingsItem = items.find((n) => n.to === '/settings');
  const otherItems = items.filter((n) => n.to !== '/settings');
  const mobileItems = [
    ...otherItems.slice(0, 4),
    ...(settingsItem ? [settingsItem] : []),
  ];
  const isQrEligible = roleName === 'participant' || roleName === 'ambassador';
  const [qrPassOpen, setQrPassOpen] = useState(false);

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate('/home', { replace: true });
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border/70 bg-card/60 backdrop-blur-xl lg:flex">
        <div className="px-5 pb-6 pt-6">
          <BrandMark
            logoClassName="h-9 w-9"
            titleClassName="text-[15px] font-semibold tracking-tight"
            subtitleClassName="text-[11px] text-muted-foreground"
          />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>

        {isQrEligible && (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={() => setQrPassOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-glow/40 bg-emerald/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-mint hover:bg-emerald/20 transition-all shadow-sm"
            >
              <QrCode className="h-4 w-4 text-emerald shrink-0" />
              <span>My QR Pass</span>
            </button>
          </div>
        )}

        <div className="border-t border-border/70 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: role.color }}
              aria-hidden
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-semibold">{name}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {role.label}
                {email ? ` · ${email}` : ''}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border/70 bg-background/80 px-4 py-2.5 backdrop-blur-xl lg:hidden">
        <BrandMark
          logoClassName="h-7 w-7"
          titleClassName="text-sm font-semibold"
          showSubtitle={false}
          gap="gap-2"
        />
        <div className="flex items-center gap-2">
          {isQrEligible && (
            <button
              type="button"
              onClick={() => setQrPassOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-glow/40 bg-emerald/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-mint hover:bg-emerald/25 transition-colors"
            >
              <QrCode className="h-3.5 w-3.5 text-emerald" />
              <span>My QR Pass</span>
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>

      {/* Mobile bottom nav — Settings last */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border/70 bg-background/90 px-1 py-1.5 backdrop-blur-xl lg:hidden">
        {mobileItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground',
                isActive && 'text-emerald-mint',
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <main className="min-w-0 flex-1 px-4 pb-24 pt-16 sm:px-6 lg:ml-60 lg:px-12 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>

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
