import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VolunteerDashboard from '../VolunteerDashboard';
import { MOCK_SESSIONS } from '../../models/sessions';

const state = vi.hoisted(() => ({
  guard: { ready: true, redirect: null as string | null, roleName: 'volunteer' },
  assigned: [] as string[],
}));

vi.mock('../../components/AppShell', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../hooks/useRequireProfile', () => ({ useRequireRole: () => state.guard }));
vi.mock('../../context/ScheduleContext', () => ({ useSchedule: () => ({ volunteerSchedule: state.assigned }) }));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/volunteer']}>
      <Routes>
        <Route path="/volunteer" element={<VolunteerDashboard />} />
        <Route path="/home" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  state.guard = { ready: true, redirect: null, roleName: 'volunteer' };
  state.assigned = [];
});

describe("Sessions I'm managing", () => {
  test('says how assignments work when there are none, like the app', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: "Sessions I'm managing" })).toBeInTheDocument();
    expect(screen.getByText(/not assigned to any sessions yet/)).toBeInTheDocument();
  });

  test('lists assigned sessions, each linking to its session page for attendance', () => {
    const [first, second] = MOCK_SESSIONS;
    state.assigned = [second.id, first.id];
    renderPage();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(screen.getByRole('link', { name: new RegExp(first.title) })).toHaveAttribute('href', `/sessions/${first.id}`);
  });

  test('has no front-desk check-in on the website (the camera scan is in the app)', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: /scan/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /check in/i })).toBeNull();
  });

  test('other roles are sent home', () => {
    state.guard = { ready: false, redirect: '/home', roleName: 'participant' };
    renderPage();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
