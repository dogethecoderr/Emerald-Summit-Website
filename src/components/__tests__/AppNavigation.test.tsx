import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Link, MemoryRouter } from 'react-router-dom';
import { useState } from 'react';

const loads = vi.hoisted(() => {
  let finishSchedule!: () => void;
  let finishNotifications!: () => void;
  let failAnnouncements!: (error: Error) => void;
  return {
    schedule: new Promise<void>((resolve) => { finishSchedule = resolve; }),
    notifications: new Promise<void>((resolve) => { finishNotifications = resolve; }),
    announcements: new Promise<void>((_, reject) => { failAnnouncements = reject; }),
    finishSchedule: () => finishSchedule(),
    finishNotifications: () => finishNotifications(),
    failAnnouncements: (error: Error) => failAnnouncements(error),
  };
});

vi.mock('../ScrollToTop', () => ({ default: () => null }));
vi.mock('../GetTheAppBanner', () => ({ default: () => null }));
vi.mock('../../pages/WelcomePage', () => ({ default: () => <h1>Welcome</h1> }));
vi.mock('../../pages/HomePage', () => ({
  default: function Home() {
    const [count, setCount] = useState(0);
    return (
      <>
        <h1>Summit home</h1>
        <nav aria-label="Sidebar">
          <Link to="/schedule">Schedule</Link>
          <Link to="/announcements">Announcements</Link>
          <Link to="/notifications">Notifications</Link>
          <Link to="/account">Profile</Link>
        </nav>
        <button onClick={() => setCount(count + 1)}>Selected {count}</button>
        <Link to="?view=alternate">Change view</Link>
      </>
    );
  },
}));
vi.mock('../../pages/SchedulePage', async () => {
  await loads.schedule;
  return { default: () => <h1>Your schedule</h1> };
});
vi.mock('../../pages/AnnouncementsPage', async () => {
  await loads.announcements;
  return { default: () => <h1>Announcements</h1> };
});
vi.mock('../../pages/NotificationsPage', async () => {
  await loads.notifications;
  return { default: () => <h1>Your notifications</h1> };
});
vi.mock('../../pages/SettingsPage', () => ({
  default: () => { throw new Error('Unexpected page render failure'); },
}));

import App from '../../App';

afterEach(() => vi.restoreAllMocks());

function renderPage(path = '/home') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </MemoryRouter>,
  );
}

describe('sidebar route navigation', () => {
  test('shows progress on a direct route while its chunk loads, then opens that page', async () => {
    renderPage('/schedule');
    expect(screen.getByRole('status')).toHaveTextContent('Opening page');
    await act(async () => loads.finishSchedule());
    expect(await screen.findByRole('heading', { name: 'Your schedule' })).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('a failed route download shows recovery actions and Home still works', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Summit home' });
    await user.click(screen.getByRole('link', { name: 'Announcements' }));
    await act(async () => loads.failAnnouncements(new Error('Failed to fetch dynamically imported module')));

    expect(await screen.findByRole('alert')).toHaveTextContent('This page couldn’t open');
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeEnabled();
    await user.click(screen.getByRole('link', { name: 'Back to Home' }));
    expect(await screen.findByRole('heading', { name: 'Summit home' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('keeps the current page visible while a sidebar destination loads', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Summit home' });
    await user.click(screen.getByRole('link', { name: 'Notifications' }));
    expect(screen.getByRole('heading', { name: 'Summit home' })).toBeVisible();
    await act(async () => loads.finishNotifications());
    expect(await screen.findByRole('heading', { name: 'Your notifications' })).toBeVisible();
  });

  test('a page render exception is contained instead of emptying the app', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Summit home' });
    await user.click(screen.getByRole('link', { name: 'Profile' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This page couldn’t open');
    await user.click(screen.getByRole('link', { name: 'Back to Home' }));
    expect(await screen.findByRole('heading', { name: 'Summit home' })).toBeVisible();
  });

  test('query-string navigation preserves the current page’s local state', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Summit home' });
    await user.click(screen.getByRole('button', { name: 'Selected 0' }));
    await user.click(screen.getByRole('link', { name: 'Change view' }));
    expect(screen.getByRole('button', { name: 'Selected 1' })).toBeVisible();
  });
});
