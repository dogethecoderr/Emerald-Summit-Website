import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NotificationsPage from '../NotificationsPage';
import type { AppNotification } from '../../models/notifications';
import { notificationFromRow, notificationLink, timeAgo } from '../../models/notifications';

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
        <Route path="/announcements" element={<div>News page</div>} />
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

  test('a note about a post marks it read, opens the post and goes to News', async () => {
    renderPage();
    await userEvent.click(screen.getByText('Summit Admin posted to TechVerse'));
    expect(state.markRead).toHaveBeenCalledWith('n1');
    expect(state.openPost).toHaveBeenCalledWith('post-1');
    expect(screen.getByText('News page')).toBeInTheDocument();
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

  test('time ago matches the app', () => {
    const now = Date.parse('2026-11-12T12:00:00Z');
    expect(timeAgo('2026-11-12T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-11-12T11:55:00Z', now)).toBe('5m ago');
    expect(timeAgo('2026-11-12T09:00:00Z', now)).toBe('3h ago');
    expect(timeAgo('2026-11-10T12:00:00Z', now)).toBe('2d ago');
  });
});
