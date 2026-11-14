import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  all: vi.fn(),
  assign: vi.fn(),
  preview: vi.fn(),
  replace: vi.fn(),
  roster: vi.fn(),
}));

vi.mock('../../services/organizer', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/organizer')>(),
  fetchSessionVolunteers: (...a: unknown[]) => api.list(...a),
  fetchVolunteers: () => api.all(),
  fetchSessionRoster: (...a: unknown[]) => api.roster(...a),
  assignVolunteer: (...a: unknown[]) => api.assign(...a),
  previewManagerAssignment: (...a: unknown[]) => api.preview(...a),
  assignManagerReplacingConflicts: (...a: unknown[]) => api.replace(...a),
  unassignVolunteer: vi.fn(),
}));

import SessionVolunteers from '../session/SessionVolunteers';
import { describeReplacement, type ReplacedItem } from '../../services/organizer';
import type { Session } from '../../models/sessions';

const session = { id: 's1', title: 'Robot Showcase' } as Session;
const sam = { id: 'sam', name: 'Sam Lee', email: 'sam@x.org', subtype: null, phone: null, role: 'volunteer' };
const item = (over: Partial<ReplacedItem>): ReplacedItem => ({
  sessionId: 's2', title: 'Bio Lab', kind: 'registered', participationType: 'participant',
  teamName: null, teamOwner: false, teammates: 0, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue([]);
  api.all.mockResolvedValue([sam]);
  api.roster.mockResolvedValue([]);
});

async function pickSam() {
  const user = userEvent.setup();
  render(<SessionVolunteers session={session} canAssign />);
  await user.click(await screen.findByRole('button', { name: /Assign volunteer/ }));
  await user.click(await screen.findByRole('button', { name: /Sam Lee/ }));
  return user;
}

describe('assigning someone who is busy at that time', () => {
  test('the admin sees what gets replaced, then assigns and replaces', async () => {
    api.assign.mockResolvedValue({ outcome: 'conflict', conflictingTitle: 'Bio Lab', conflictKind: 'registered' });
    const items = [
      item({ kind: 'registered_this', sessionId: 's1', title: 'Robot Showcase', teamName: 'Rover', teamOwner: true, teammates: 2 }),
      item({ kind: 'managing', sessionId: 's3', title: 'Drone Lab', participationType: null }),
    ];
    api.preview.mockResolvedValue(items);
    api.replace.mockResolvedValue(items);
    const user = await pickSam();

    expect(await screen.findByText('Replace what they’re doing?')).toBeInTheDocument();
    expect(screen.getByText(/Sam Lee can only do one thing at a time/)).toBeInTheDocument();
    expect(screen.getByText(/Their sign-up to participate in this session. They'll manage it instead. They own "Rover"; it passes to the teammate who joined first./)).toBeInTheDocument();
    expect(screen.getByText(/"Drone Lab", which they manage. They'll stop managing it./)).toBeInTheDocument();
    expect(screen.getByText(/They'll get a notice/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Assign and replace' }));
    await waitFor(() => expect(api.replace).toHaveBeenCalledWith('s1', 'sam'));
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  test('cancel changes nothing', async () => {
    api.assign.mockResolvedValue({ outcome: 'conflict', conflictingTitle: 'Bio Lab', conflictKind: 'registered' });
    api.preview.mockResolvedValue([item({})]);
    const user = await pickSam();
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(api.replace).not.toHaveBeenCalled();
  });

  test('before the SQL is run, the old refusal stays', async () => {
    api.assign.mockResolvedValue({ outcome: 'conflict', conflictingTitle: 'Bio Lab', conflictKind: 'registered' });
    api.preview.mockResolvedValue(null);
    await pickSam();
    expect(await screen.findByText(/can't be added to this session/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign and replace' })).not.toBeInTheDocument();
  });

  test('someone free is assigned straight away', async () => {
    api.assign.mockResolvedValue({ outcome: 'assigned' });
    await pickSam();
    await waitFor(() => expect(api.assign).toHaveBeenCalledWith('s1', 'sam'));
    expect(api.preview).not.toHaveBeenCalled();
  });
});

describe('volunteers signed up for this session', () => {
  const samOnRoster = (type = 'participant') => ({
    userId: 'sam', name: 'Sam Lee', email: 'sam@x.org', attended: false, type, answers: {},
    isTeam: null, projectName: null, teamId: null, teamCode: null, isTeamOwner: false, role: 'volunteer', details: {},
  });
  const here = (over: Partial<ReplacedItem> = {}) =>
    item({ kind: 'registered_this', sessionId: 's1', title: 'Robot Showcase', ...over });

  test('admins see them listed and can make one a manager', async () => {
    api.roster.mockResolvedValue([
      samOnRoster(),
      { ...samOnRoster(), userId: 'kid', name: 'Kid Student', role: 'participant' },
    ]);
    api.preview.mockResolvedValue([here({ teamName: 'Rover', teamOwner: true, teammates: 2 })]);
    api.replace.mockResolvedValue([here()]);
    const user = userEvent.setup();
    render(<SessionVolunteers session={session} canAssign />);

    expect(await screen.findByText('Volunteers signed up for this session')).toBeInTheDocument();
    expect(screen.getByText(/Signed up as participant/)).toBeInTheDocument();
    expect(screen.queryByText('Kid Student')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Make Sam Lee a manager' }));
    expect(await screen.findByText('Make Sam Lee a manager?')).toBeInTheDocument();
    expect(screen.getByText(
      'This will make them a manager of this session, and they will no longer be a participant of this session.',
    )).toBeInTheDocument();
    expect(screen.getByText(/They own "Rover"; it passes to the teammate who joined first./)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Make manager' }));
    await waitFor(() => expect(api.replace).toHaveBeenCalledWith('s1', 'sam'));
    expect(api.assign).not.toHaveBeenCalled();
  });

  test('a spectator is told they will no longer be a spectator', async () => {
    api.roster.mockResolvedValue([samOnRoster('spectator')]);
    api.preview.mockResolvedValue([here({ participationType: 'spectator' })]);
    const user = userEvent.setup();
    render(<SessionVolunteers session={session} canAssign />);
    await user.click(await screen.findByRole('button', { name: 'Make Sam Lee a manager' }));
    expect(await screen.findByText(/they will no longer be a spectator of this session/)).toBeInTheDocument();
  });

  test('the picker tags them and goes straight to Make manager', async () => {
    api.roster.mockResolvedValue([samOnRoster()]);
    api.preview.mockResolvedValue([here()]);
    const user = userEvent.setup();
    render(<SessionVolunteers session={session} canAssign />);
    await screen.findByText('Volunteers signed up for this session');
    await user.click(screen.getByRole('button', { name: /Assign volunteer/ }));
    const row = await screen.findByRole('button', { name: /Sam Lee.*Signed up as participant/ });
    await user.click(row);
    expect(await screen.findByText('Make Sam Lee a manager?')).toBeInTheDocument();
    expect(api.assign).not.toHaveBeenCalled();
  });

  test('people who only view the tab never load the roster', async () => {
    render(<SessionVolunteers session={session} canAssign={false} />);
    await screen.findByText(/No one has been assigned/);
    expect(api.roster).not.toHaveBeenCalled();
  });
});

describe('describeReplacement', () => {
  test('a registration elsewhere, solo', () => {
    expect(describeReplacement(item({ participationType: 'spectator' }), 'they'))
      .toBe('"Bio Lab", where they\'re signed up to spectate.');
  });

  test('a team member who is not the owner, said to the admin themself', () => {
    expect(describeReplacement(item({ teamName: 'Rover', teammates: 1 }), 'you'))
      .toBe('"Bio Lab", where you\'re signed up to participate. Your teammates on "Rover" are told.');
  });

  test('the last person on a team', () => {
    expect(describeReplacement(item({ teamName: 'Rover', teamOwner: true, teammates: 0 }), 'they'))
      .toContain('Their team "Rover" has no one else, so it\'s deleted.');
  });
});
