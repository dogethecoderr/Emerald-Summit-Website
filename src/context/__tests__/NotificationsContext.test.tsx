import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { NotificationsProvider, useNotifications } from '../NotificationsContext';

const svc = vi.hoisted(() => ({
  fetch: vi.fn(),
  markRead: vi.fn(),
  remind: vi.fn(),
  unsubscribe: vi.fn(),
  session: { user: { id: 'me' } } as { user: { id: string } } | null,
}));

vi.mock('../AuthContext', () => ({ useAuth: () => ({ session: svc.session }) }));
vi.mock('../../services/notifications', () => ({
  fetchNotifications: () => svc.fetch(),
  markNotificationsRead: (ids?: string[]) => svc.markRead(ids),
  queueMyReminders: () => svc.remind(),
  subscribeToNotifications: () => svc.unsubscribe,
}));

let api: ReturnType<typeof useNotifications>;
function Probe() {
  api = useNotifications();
  return <p>{api.unreadCount} unread</p>;
}

beforeEach(() => {
  vi.clearAllMocks();
  svc.session = { user: { id: 'me' } };
  svc.fetch.mockResolvedValue([
    { id: 'a', kind: 'notice', title: 'A', body: '' },
    { id: 'b', kind: 'notice', title: 'B', body: '' },
  ]);
  svc.remind.mockResolvedValue(undefined);
});

describe('NotificationsProvider', () => {
  test('loads on sign-in and asks for due reminders', async () => {
    render(<NotificationsProvider><Probe /></NotificationsProvider>);
    expect(await screen.findByText('2 unread')).toBeInTheDocument();
    expect(svc.remind).toHaveBeenCalled();
  });

  test('marking one read sends it once; Mark all as read sends the rest once', async () => {
    render(<NotificationsProvider><Probe /></NotificationsProvider>);
    await screen.findByText('2 unread');
    act(() => api.markRead('a'));
    expect(await screen.findByText('1 unread')).toBeInTheDocument();
    act(() => api.markRead('a'));
    expect(svc.markRead).toHaveBeenCalledTimes(1);
    expect(svc.markRead).toHaveBeenCalledWith(['a']);
    act(() => api.markAllRead());
    expect(await screen.findByText('0 unread')).toBeInTheDocument();
    act(() => api.markAllRead());
    expect(svc.markRead).toHaveBeenCalledTimes(2);
    expect(svc.markRead).toHaveBeenLastCalledWith(undefined);
  });

  test('signed out: nothing is loaded', async () => {
    svc.session = null;
    render(<NotificationsProvider><Probe /></NotificationsProvider>);
    await waitFor(() => expect(screen.getByText('0 unread')).toBeInTheDocument());
    expect(svc.fetch).not.toHaveBeenCalled();
  });
});
