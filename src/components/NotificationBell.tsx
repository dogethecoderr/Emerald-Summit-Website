import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowRight, Bell } from '@/components/icons';
import { useNotifications } from '../context/NotificationsContext';
import NotificationList from './NotificationList';

const PREVIEW_COUNT = 5;

/**
 * The top bar's bell on laptops: hovering (or keyboard focus) shows the newest
 * notes in a panel under it, and clicking opens the full Notifications page.
 */
export default function NotificationBell() {
  const { unreadCount, markAllRead } = useNotifications();
  const hasUnread = unreadCount > 0;
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number>();
  const bell = useRef<HTMLAnchorElement>(null);

  const show = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  // A short grace period so the pointer can cross the gap into the panel.
  const hide = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setOpen(false);
          bell.current?.focus();
        }
      }}
    >
      <NavLink
        ref={bell}
        to="/notifications"
        onClick={() => setOpen(false)}
        aria-label={hasUnread ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls="bell-preview"
        className="relative block rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="h-[18px] w-[18px]" />
        {hasUnread && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-card">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </NavLink>
      {open && (
        <div id="bell-preview" className="absolute right-0 top-full z-50 pt-2">
          <div
            role="region"
            aria-label="Latest notifications"
            className="w-[400px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_18px_50px_-12px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <div className="text-[15px] font-semibold">Notifications</div>
                <div className="text-xs text-muted-foreground">{hasUnread ? `${unreadCount} unread` : 'All caught up'}</div>
              </div>
              {hasUnread && (
                <button type="button" onClick={markAllRead} className="rounded-md px-2 py-1 text-[13px] font-semibold text-emerald hover:bg-emerald/10">
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
              <NotificationList limit={PREVIEW_COUNT} onOpen={() => setOpen(false)} />
            </div>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 border-t border-border px-4 py-3 text-[13px] font-semibold text-emerald hover:bg-emerald/5"
            >
              See all notifications <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
