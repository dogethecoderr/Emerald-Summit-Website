import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({
  roster: vi.fn(),
  removals: vi.fn(),
  remove: vi.fn(),
  allowBack: vi.fn(),
}));

vi.mock('../../services/organizer', () => ({
  fetchSessionRoster: (...a: unknown[]) => api.roster(...a),
  markSessionAttendance: vi.fn(),
}));

vi.mock('../../services/sessionRemovals', () => ({
  fetchSessionRemovals: (...a: unknown[]) => api.removals(...a),
  removeFromSession: (...a: unknown[]) => api.remove(...a),
  allowBackToSession: (...a: unknown[]) => api.allowBack(...a),
}));

import SessionRoster from '../session/SessionRoster';
import type { Session } from '../../models/sessions';
import type { RosterEntry } from '../../services/organizer';

const session = { id: 's1', title: 'Robot Showcase', questions: [] } as unknown as Session;
const entry = (userId: string, name: string): RosterEntry => ({
  userId,
  name,
  email: `${userId}@x.org`,
  attended: false,
  type: 'participant',
  answers: {},
  projectName: null,
  isTeam: null,
  teamId: null,
  teamCode: null,
  isTeamOwner: false,
  details: {},
} as unknown as RosterEntry);

const show = () => render(
  <SessionRoster session={session} types={['participant', 'spectator']} canMarkAttendance={false} emptyMessage="Nobody yet." />,
);

beforeEach(() => {
  vi.clearAllMocks();
  api.roster.mockResolvedValue([entry('bot', 'Totally Real Person'), entry('ana', 'Ana Ruiz')]);
  api.removals.mockResolvedValue([]);
});

describe('removing someone from a session', () => {
  test('confirming removes them and refreshes the roster', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'Remove Totally Real Person from this session' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/can't sign up for it again/)).toBeInTheDocument();

    api.remove.mockResolvedValue('removed');
    api.roster.mockResolvedValue([entry('ana', 'Ana Ruiz')]);
    api.removals.mockResolvedValue([{
      userId: 'bot', name: 'Totally Real Person', email: 'bot@x.org', type: 'participant', removedBy: 'Sam Lee', removedAt: null,
    }]);
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('s1', 'bot'));
    expect(await screen.findByText('Removed')).toBeInTheDocument();
    expect(screen.getByText(/Removed by Sam Lee/)).toBeInTheDocument();
  });

  test('the last one on a team is told the team goes too', async () => {
    const team = { isTeam: true, teamId: 't1', teamCode: 'ABC', projectName: 'Rover' };
    api.roster.mockResolvedValue([
      { ...entry('solo', 'Lone Owner'), ...team, isTeamOwner: true },
      { ...entry('own', 'Pat Kim'), isTeam: true, teamId: 't2', teamCode: 'XYZ', projectName: 'Kite', isTeamOwner: true },
      { ...entry('mem', 'Lee Park'), isTeam: true, teamId: 't2', teamCode: 'XYZ', projectName: 'Kite' },
    ]);
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'Remove Lone Owner from this session' }));
    expect(await screen.findByText(/the team is deleted too/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(await screen.findByRole('button', { name: 'Remove Pat Kim from this session' }));
    expect(await screen.findByText(/passes to the teammate who joined first/)).toBeInTheDocument();
  });

  test('Allow back lifts the block', async () => {
    api.removals.mockResolvedValue([{
      userId: 'bot', name: 'Totally Real Person', email: 'bot@x.org', type: 'participant', removedBy: null, removedAt: null,
    }]);
    api.allowBack.mockResolvedValue(undefined);
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'Allow back' }));
    await waitFor(() => expect(api.allowBack).toHaveBeenCalledWith('s1', 'bot'));
  });

  test('before the SQL is run there are no Remove buttons', async () => {
    api.removals.mockResolvedValue(null);
    show();
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument();
  });
});
