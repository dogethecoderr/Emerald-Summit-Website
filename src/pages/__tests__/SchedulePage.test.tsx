import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

const state = vi.hoisted(() => ({
  role: 'participant',
  schedule: {
    mySchedule: [] as string[],
    expertSchedule: [] as string[],
    volunteerSchedule: [] as string[],
    spectating: [] as string[],
    sessionCounts: {},
    reserveSession: vi.fn().mockResolvedValue(undefined),
    releaseSession: vi.fn().mockResolvedValue(undefined),
    loading: false,
    scheduleError: null as string | null,
  },
}));

vi.mock('../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ profile: { role: state.role } }) }));
vi.mock('../../hooks/useRequireProfile', () => ({ useRequireRole: () => ({ ready: true, redirect: null }) }));
vi.mock('../../context/ScheduleContext', () => ({
  ownScheduleKind: (role: string) => role === 'participant' ? 'competing' : role === 'expert' ? 'judging' : role === 'volunteer' ? 'volunteering' : null,
  useSchedule: () => state.schedule,
}));
vi.mock('../../components/AppShell', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('../../services/summitContent', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/summitContent')>(),
  useSummitContent: () => 0,
}));
vi.mock('../../models/sessions', () => {
  const base = {
    track: 'techverse',
    trackName: 'Engineering',
    speaker: 'Summit team',
    location: 'Lab',
    room: 'A',
    duration: '60 min',
    description: 'Session details',
    capacity: 30,
    enrolled: 0,
    expertCapacity: 3,
    expertsEnrolled: 0,
    spectatorCap: 10,
    spectators: 0,
    volunteerCapacity: 2,
    volunteersEnrolled: 0,
  };
  return { MOCK_SESSIONS: [
    { ...base, id: 'afternoon', title: 'Afternoon registered session', time: '14:15' },
    { ...base, id: 'morning', title: 'Morning registered session', time: '10:30' },
    { ...base, id: 'unregistered', title: 'Unregistered catalogue session', time: '12:00' },
  ], sessionPlace: () => 'Room TBD' };
});

import SchedulePage from '../SchedulePage';

function page() {
  return <MemoryRouter initialEntries={['/schedule']}><SchedulePage /></MemoryRouter>;
}

beforeEach(() => {
  state.role = 'participant';
  state.schedule.mySchedule = [];
  state.schedule.expertSchedule = [];
  state.schedule.volunteerSchedule = [];
  state.schedule.spectating = [];
  state.schedule.loading = false;
  state.schedule.scheduleError = null;
  vi.clearAllMocks();
});

describe('personal schedule', () => {
  test('shows only committed sessions in time order, with browsing in Disciplines', () => {
    state.schedule.mySchedule = ['afternoon'];
    state.schedule.spectating = ['morning'];
    render(page());
    expect(screen.queryByText('Unregistered catalogue session')).not.toBeInTheDocument();
    const sessions = screen.getAllByRole('article');
    expect(sessions[0]).toHaveTextContent('Morning registered session');
    expect(sessions[1]).toHaveTextContent('Afternoon registered session');
    expect(screen.getByRole('link', { name: /Add a track/ })).toHaveAttribute('href', '/disciplines');
  });

  test('admin-assigned volunteer sessions have no remove action', async () => {
    state.role = 'volunteer';
    state.schedule.volunteerSchedule = ['morning'];
    render(page());
    expect(screen.getByText('Managing')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More options for Morning registered session' }));
    expect(await screen.findByRole('menuitem', { name: 'Open track' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Remove from my day' })).not.toBeInTheDocument();
  });

  test('Remove is hidden until the ⋯ menu is opened', async () => {
    state.schedule.mySchedule = ['morning'];
    render(page());
    expect(screen.queryByRole('menuitem', { name: 'Remove from my day' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More options for Morning registered session' }));
    expect(await screen.findByRole('menuitem', { name: 'Remove from my day' })).toBeInTheDocument();
  });

  test('session titles open the session page', () => {
    state.schedule.mySchedule = ['morning'];
    render(page());
    expect(screen.getByRole('link', { name: 'Morning registered session' })).toHaveAttribute('href', '/sessions/morning');
  });

  test('a team owner removing a session is sent to the session page to pick a new owner', async () => {
    state.schedule.mySchedule = ['morning'];
    state.schedule.releaseSession.mockRejectedValueOnce(
      new Error('You own this team. Choose a teammate to take over before you leave.'),
    );
    render(<MemoryRouter initialEntries={['/schedule']}><Routes>
      <Route path="/schedule" element={<SchedulePage />} />
      <Route path="/sessions/:id" element={<p>Session page</p>} />
    </Routes></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'More options for Morning registered session' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove from my day' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Session page')).toBeInTheDocument();
  });

  test('Remove in the ⋯ menu asks before removing, and Keep it removes nothing', async () => {
    state.schedule.mySchedule = ['morning'];
    render(page());
    await userEvent.click(screen.getByRole('button', { name: 'More options for Morning registered session' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove from my day' }));
    expect(await screen.findByRole('heading', { name: 'Remove from your day?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(state.schedule.releaseSession).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'More options for Morning registered session' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove from my day' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(state.schedule.releaseSession).toHaveBeenCalledWith('morning'));
  });

  test('attendees can open their personal spectator schedule', () => {
    state.role = 'attendee';
    state.schedule.spectating = ['morning'];
    render(page());
    expect(screen.getByRole('heading', { name: 'Morning registered session' })).toBeInTheDocument();
    expect(screen.getByText('Spectating')).toBeInTheDocument();
  });

});
