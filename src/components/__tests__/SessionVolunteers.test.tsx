import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  all: vi.fn(),
  assign: vi.fn(),
  override: vi.fn(),
  overrides: vi.fn(),
}));

vi.mock('../../services/organizer', () => ({
  fetchSessionVolunteers: (...a: unknown[]) => api.list(...a),
  fetchVolunteers: () => api.all(),
  assignVolunteer: (...a: unknown[]) => api.assign(...a),
  assignVolunteerOverridingConflict: (...a: unknown[]) => api.override(...a),
  fetchConflictOverrides: (...a: unknown[]) => api.overrides(...a),
  unassignVolunteer: vi.fn(),
}));

import SessionVolunteers from '../session/SessionVolunteers';
import type { Session } from '../../models/sessions';

const session = { id: 's1', title: 'Robot Showcase' } as Session;
const sam = { id: 'sam', name: 'Sam Lee', email: 'sam@x.org', subtype: null, phone: null, role: 'volunteer' };

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue([]);
  api.all.mockResolvedValue([sam]);
  api.overrides.mockResolvedValue(new Set());
});

async function pickSam() {
  const user = userEvent.setup();
  render(<SessionVolunteers session={session} canAssign />);
  await user.click(await screen.findByRole('button', { name: /Assign volunteer/ }));
  await user.click(await screen.findByRole('button', { name: /Sam Lee/ }));
  return user;
}

describe('assigning over a schedule clash', () => {
  test('an admin can assign anyway, and the row is marked', async () => {
    api.assign.mockResolvedValue({ outcome: 'conflict', conflictingTitle: 'Bio Lab', conflictKind: 'registered' });
    api.override.mockResolvedValue({ outcome: 'assigned' });
    const user = await pickSam();
    expect(await screen.findByText(/already on "Bio Lab" at the same time/)).toBeInTheDocument();

    api.list.mockResolvedValue([sam]);
    api.overrides.mockResolvedValue(new Set(['sam']));
    await user.click(screen.getByRole('button', { name: 'Assign anyway' }));
    await waitFor(() => expect(api.override).toHaveBeenCalledWith('s1', 'sam'));
    expect(await screen.findByText('Overlap approved')).toBeInTheDocument();
  });

  test('before the SQL is run, the old refusal stays', async () => {
    api.overrides.mockResolvedValue(null);
    api.assign.mockResolvedValue({ outcome: 'conflict', conflictingTitle: 'Bio Lab', conflictKind: 'registered' });
    await pickSam();
    expect(await screen.findByText(/can't be added to this session/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign anyway' })).not.toBeInTheDocument();
  });

  test("a sign-up for this same session offers no override", async () => {
    api.assign.mockResolvedValue({ outcome: 'conflict', conflictingTitle: 'Robot Showcase', conflictKind: 'registered_this' });
    await pickSam();
    expect(await screen.findByText(/signed up for this session/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign anyway' })).not.toBeInTheDocument();
  });

  test('organizers who can\'t assign never ask for overrides', async () => {
    render(<SessionVolunteers session={session} canAssign={false} />);
    await screen.findByText(/No one has been assigned/);
    expect(api.overrides).not.toHaveBeenCalled();
  });
});
