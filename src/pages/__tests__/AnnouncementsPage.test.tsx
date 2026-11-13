import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AnnouncementsPage from '../AnnouncementsPage';
import type { Announcement } from '../../models/announcements';

const state = vi.hoisted(() => ({ hide: vi.fn(), unhide: vi.fn(), remove: vi.fn(), canManage: false }));

const post: Announcement = {
  id: 'p1', title: 'Parking', body: 'Use lot B.', category: 'General', date: 'Nov 12',
  pinned: false, author: 'Admin', audience: 'Everyone',
};

vi.mock('../../components/AppShell', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../hooks/useRequireProfile', () => ({ useRequireProfile: () => ({ ready: true, redirect: null, roleName: 'participant' }) }));
vi.mock('../../components/AnnouncementComposer', () => ({ default: () => null }));
vi.mock('../../context/AnnouncementsContext', () => ({
  useAnnouncements: () => ({
    announcements: [post], canManage: state.canManage, canPost: false, error: null, live: true, configured: true,
    remove: state.remove, isUnread: () => false, markRead: vi.fn(), markAllRead: vi.fn(),
    hide: state.hide, unhide: state.unhide,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.hide.mockResolvedValue(undefined);
  state.canManage = false;
});

describe('Remove from my feed', () => {
  test('is not shown on the post; it is in the ⋯ menu', async () => {
    render(<MemoryRouter><AnnouncementsPage /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /remove from my feed/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'More options for Parking' }));
    expect(await screen.findByRole('menuitem', { name: 'Remove this announcement from my feed' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete for everyone/ })).toBeNull();
  });

  test('warns that it can’t be undone, and only removes after Remove', async () => {
    render(<MemoryRouter><AnnouncementsPage /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'More options for Parking' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove this announcement from my feed' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent("you can't get it back in your feed");
    expect(state.hide).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(state.hide).toHaveBeenCalledWith('p1');
    expect(state.unhide).not.toHaveBeenCalled();
  });

  test('Cancel keeps the post', async () => {
    render(<MemoryRouter><AnnouncementsPage /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'More options for Parking' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove this announcement from my feed' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(state.hide).not.toHaveBeenCalled();
  });

  test('admins also get Delete for everyone in the same menu', async () => {
    state.canManage = true;
    render(<MemoryRouter><AnnouncementsPage /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'More options for Parking' }));
    expect(await screen.findByRole('menuitem', { name: /Delete for everyone/ })).toBeInTheDocument();
  });
});
