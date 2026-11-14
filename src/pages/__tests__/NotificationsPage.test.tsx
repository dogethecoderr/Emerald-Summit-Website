import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NotificationsPage from '../NotificationsPage';
import type { AppNotification } from '../../models/notifications';
import { notificationFromRow, notificationFullTime, notificationLink, notificationStamp } from '../../models/notifications';

const state = vi.hoisted(() => ({
  notifications: [] as AppNotification[],
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  openPost: vi.fn(),
}));

vi.mock('../../components/AppShell', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../hooks/useRequireProfile', () => ({ useRequireProfile: () => ({ ready: true, redirect: null, roleName: 'participant' }) }));
vi.mock('../../context/AnnouncementsContext', () => ({ useAnnouncements: () => ({ markRead: state.openPost }) }));
vi.mock('../../context/NotificationsContext', () => ({
  useNotifications: () => ({
    notifications: state.notifications,
    loading: false,
    error: null,
    unreadCount: state.notifications.filter((n) => !n.readAt).length,
    reload: vi.fn(),
    markRead: state.markRead,
    markAllRead: state.markAllRead,
  }),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/notifications']}>
      <Routes>
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/announcements" element={<div>Announcements page</div>} />
        <Route path="/sessions/:id" element={<div>Session page</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  state.notifications = [
    { id: 'n1', kind: 'announcement', title: 'Summit Admin posted to TechVerse', body: 'Bring laptops', announcementId: 'post-1' },
    { id: 'n2', kind: 'reminder', title: 'Coming up at 10:30 AM: AI Playground', body: 'Your session starts within the hour.', sessionId: 's1' },
    { id: 'n3', kind: 'notice', title: 'Old note', body: '', readAt: '2026-11-11T00:00:00Z' },
  ];
});

describe('Notifications', () => {
  test('lists the notes with an unread count and Mark all as read', async () => {
    renderPage();
    expect(screen.getByText('Summit Admin posted to TechVerse')).toBeInTheDocument();
    expect(screen.getByText('2 unread')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Mark all as read/ }));
    expect(state.markAllRead).toHaveBeenCalled();
  });

  test('a note about a post marks it read, opens the post and goes to Announcements', async () => {
    renderPage();
    await userEvent.click(screen.getByText('Summit Admin posted to TechVerse'));
    expect(state.markRead).toHaveBeenCalledWith('n1');
    expect(state.openPost).toHaveBeenCalledWith('post-1');
    expect(screen.getByText('Announcements page')).toBeInTheDocument();
  });

  test('a reminder opens its session', async () => {
    renderPage();
    await userEvent.click(screen.getByText(/AI Playground/));
    expect(screen.getByText('Session page')).toBeInTheDocument();
  });

  test('with nothing unread there is no Mark all as read', () => {
    state.notifications = state.notifications.map((n) => ({ ...n, readAt: '2026-11-11T00:00:00Z' }));
    renderPage();
    expect(screen.getByText('All caught up')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark all as read/ })).toBeNull();
  });

  test('says what shows up when empty', () => {
    state.notifications = [];
    renderPage();
    expect(screen.getByText(/Session reminders, new posts for you/)).toBeInTheDocument();
  });
});

describe('notification rows', () => {
  test('read the shared table like the app', () => {
    const n = notificationFromRow({ id: 1, kind: 'weird', title: 'T', body: null, session_id: 's', read_at: null });
    expect(n).toMatchObject({ id: '1', kind: 'notice', title: 'T', body: '', sessionId: 's' });
    expect(n.readAt).toBeUndefined();
    expect(notificationLink(n)).toBe('/sessions/s');
    expect(notificationLink({ ...n, sessionId: undefined })).toBeNull();
  });

  test('the stamp is "5m ago" today and a date for earlier days', () => {
    const tz = 'America/Los_Angeles';
    const now = new Date('2026-11-12T20:00:00Z'); // Thu Nov 12, 12:00 PM Pacific
    expect(notificationStamp('2026-11-12T19:59:40Z', now, tz)).toBe('just now');
    expect(notificationStamp('2026-11-12T19:55:00Z', now, tz)).toBe('5m ago');
    expect(notificationStamp('2026-11-12T08:05:00Z', now, tz)).toBe('11h ago'); // 12:05 AM today
    // 13 hours ago, but the evening before in Pacific time: a date, not "13h ago".
    expect(notificationStamp('2026-11-12T07:00:00Z', now, tz)).toBe('Wed, Nov 11');
    expect(notificationStamp('2026-10-02T18:00:00Z', now, tz)).toBe('Fri, Oct 2');
    expect(notificationStamp('2025-12-30T18:00:00Z', now, tz)).toBe('Dec 30, 2025');
    expect(notificationStamp(undefined, now, tz)).toBe('');
    expect(notificationFullTime('2026-11-12T17:05:00Z', tz)).toBe('Thursday, November 12, 2026 at 9:05 AM');
  });
});
