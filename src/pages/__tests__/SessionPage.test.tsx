import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const state = vi.hoisted(() => ({
  role: 'participant',
  schedule: {
    mySchedule: [] as string[],
    expertSchedule: [] as string[],
    volunteerSchedule: [] as string[],
    spectating: [] as string[],
    loading: false,
    scheduleError: null as string | null,
    reload: vi.fn().mockResolvedValue(undefined),
  },
  toggle: vi.fn(),
  project: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({
  session: { user: { id: 'me' } },
  profile: { id: 'me', role: state.role, profile_setup_complete: true, expert_status: 'approved' },
  loadingProfile: false,
}) }));
vi.mock('../../context/ScheduleContext', () => ({ useSchedule: () => state.schedule }));
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('../../components/AppShell', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('../../components/session/SessionRoster', () => ({ default: () => <p>Roster</p> }));
vi.mock('../../components/session/SessionVolunteers', () => ({ default: () => <p>Volunteers list</p> }));
vi.mock('../../components/session/SessionMetrics', () => ({ default: () => <p>Metrics view</p> }));
vi.mock('../../components/verse/ContentEditors', () => ({ SessionEditorDialog: () => null }));
vi.mock('../../services/summitContent', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/summitContent')>(),
  useSummitContent: () => 0,
  loadSummitContent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/sessionRegistration', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/sessionRegistration')>(),
  toggleRegistration: (...args: unknown[]) => state.toggle(...args),
  fetchMyProject: () => state.project(),
  fetchSessionExperts: vi.fn().mockResolvedValue([]),
  fetchMyAnswers: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../models/sessions', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../models/sessions')>();
  return {
    ...real,
    MOCK_SESSIONS: [{
      id: 's1', title: 'Robot Showcase', track: 'techverse', trackName: 'Robots', speaker: '', time: '10:00 AM',
      start: '10:00', end: '11:00', location: 'Lab', room: 'Lab', duration: '60 min', description: 'Build robots.',
      capacity: 30, enrolled: 3, expertCapacity: 30, expertsEnrolled: 3, spectatorCap: 30, spectators: 3,
      volunteerCapacity: 0, volunteersEnrolled: 0, disciplineName: 'TechVerse', maxTeamSize: 4,
      questions: [{ id: 'q1', prompt: 'What will you bring?' }],
    }],
  };
});

import SessionPage from '../SessionPage';

function page() {
  return render(<MemoryRouter initialEntries={['/sessions/s1']}><Routes><Route path="/sessions/:id" element={<SessionPage />} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.role = 'participant';
  state.schedule.mySchedule = [];
  state.schedule.volunteerSchedule = [];
  state.schedule.expertSchedule = [];
  state.schedule.spectating = [];
  state.project.mockResolvedValue(null);
  state.toggle.mockResolvedValue({ outcome: 'added', teamCode: null });
});

describe('session page', () => {
  test('participating asks the project question and the session\'s questions first', async () => {
    const user = userEvent.setup();
    page();
    await user.click(screen.getByRole('button', { name: /Add to my day/ }));
    await user.click(screen.getByRole('button', { name: /Participate/ }));
    await user.click(screen.getByRole('radio', { name: 'Solo' }));
    await user.click(screen.getByRole('button', { name: 'Confirm and add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter your project name.');
    await user.type(screen.getByLabelText('What is your project name?'), 'Line follower');
    await user.click(screen.getByRole('button', { name: 'Confirm and add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please answer every question.');
    await user.type(screen.getByLabelText('What will you bring?'), 'A laptop');
    await user.click(screen.getByRole('button', { name: 'Confirm and add' }));
    await waitFor(() => expect(state.toggle).toHaveBeenCalledWith('s1', {
      add: true,
      type: 'participant',
      answers: { q1: 'A laptop' },
      project: { action: 'solo', projectName: 'Line follower' },
    }));
  });

  test('a parent or spectator is added straight as a spectator', async () => {
    state.role = 'attendee';
    const user = userEvent.setup();
    page();
    await user.click(screen.getByRole('button', { name: /Add to my day/ }));
    await waitFor(() => expect(state.toggle).toHaveBeenCalledWith('s1', expect.objectContaining({ add: true, type: 'spectator' })));
  });

  test('a time clash shows the app\'s wording', async () => {
    state.toggle.mockResolvedValue({ outcome: 'conflict', conflictingTitle: 'Bio Lab', conflictKind: 'registered' });
    const user = userEvent.setup();
    page();
    await user.click(screen.getByRole('button', { name: /Add to my day/ }));
    await user.click(screen.getByRole('button', { name: /Spectate/ }));
    expect(await screen.findByText('Time conflict')).toBeInTheDocument();
    expect(screen.getByText(/overlaps with "Bio Lab"/)).toBeInTheDocument();
  });

  test('a team owner picks a new owner before removing the session', async () => {
    state.schedule.mySchedule = ['s1'];
    state.project.mockResolvedValue({
      isTeam: true, projectName: 'Rover', teamCode: 'TV1234', isOwner: true, maxTeamSize: 4,
      members: [{ id: 'me', name: 'Me', isOwner: true }, { id: 'pal', name: 'Pal', isOwner: false }],
    });
    state.toggle.mockResolvedValue({ outcome: 'removed' });
    const user = userEvent.setup();
    page();
    expect(await screen.findByText('TV1234')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove from my day' }));
    await user.click(await screen.findByRole('button', { name: 'Pal' }));
    await waitFor(() => expect(state.toggle).toHaveBeenCalledWith('s1', { add: false, newOwnerId: 'pal' }));
  });

  test('admins get the organizer tabs; participants don\'t', async () => {
    page();
    expect(screen.queryByRole('tab', { name: 'Participants' })).not.toBeInTheDocument();
  });

  test('admins see Participants, Experts, Volunteers and Metrics', () => {
    state.role = 'admin';
    page();
    for (const name of ['Session', 'Participants', 'Experts', 'Volunteers', 'Metrics']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
  });
});
