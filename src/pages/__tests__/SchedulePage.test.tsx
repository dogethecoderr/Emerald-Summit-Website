import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
vi.mock('../../components/verse/ExploreVerses', () => ({
  VersePortalProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TrackTag: ({ track }: { track: string }) => <span>{track}</span>,
  useOpenVerse: () => vi.fn(),
}));
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
  ] };
});

import SchedulePage from '../SchedulePage';

function page(add?: string) {
  return <MemoryRouter initialEntries={[{ pathname: '/schedule', state: add ? { add } : null }]}><SchedulePage /></MemoryRouter>;
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
    expect(screen.getByRole('link', { name: /Browse sessions/ })).toHaveAttribute('href', '/disciplines');
  });

  test('admin-assigned volunteer sessions have no remove action and cannot be added through router state', async () => {
    state.role = 'volunteer';
    state.schedule.volunteerSchedule = ['morning'];
    render(page('unregistered'));
    expect(screen.getByText('Managing')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove .* from schedule/ })).not.toBeInTheDocument();
    expect(state.schedule.reserveSession).not.toHaveBeenCalled();
  });

  test('adding from a verse waits for the saved schedule to finish loading', async () => {
    state.schedule.loading = true;
    const view = render(page('unregistered'));
    expect(state.schedule.reserveSession).not.toHaveBeenCalled();
    state.schedule.loading = false;
    view.rerender(page('unregistered'));
    await waitFor(() => expect(state.schedule.reserveSession).toHaveBeenCalledWith('unregistered', 'competing'));
  });

  test('attendees can open their personal spectator schedule', () => {
    state.role = 'attendee';
    state.schedule.spectating = ['morning'];
    render(page());
    expect(screen.getByText('Morning registered session')).toBeInTheDocument();
    expect(screen.getByText('Spectating')).toBeInTheDocument();
  });

  test('an attendee adding from a verse reserves a spectator seat', async () => {
    state.role = 'attendee';
    render(page('unregistered'));
    await waitFor(() => expect(state.schedule.reserveSession).toHaveBeenCalledWith('unregistered', 'spectating'));
  });
});
