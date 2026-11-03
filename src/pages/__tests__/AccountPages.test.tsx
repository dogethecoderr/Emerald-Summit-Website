import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DirectoryPage from '../DirectoryPage';
import SettingsPage from '../SettingsPage';

const state = vi.hoisted(() => ({
  guard: { ready: true, redirect: null as string | null, roleName: 'volunteer' },
  profile: { id: 'vol-1', name: 'Arjun Mahajan', email: 'arjun@example.com', role: 'volunteer', phone: '5551234567', bio: '', profile_setup_complete: true },
  contacts: vi.fn(),
  save: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('../../components/AppShell', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('../../components/ThemeToggle', () => ({ default: () => <button>Appearance</button> }));
vi.mock('../../components/QrPassModal', () => ({ default: ({ open }: { open: boolean }) => open ? <div role="dialog">Digital pass</div> : null }));
vi.mock('../../hooks/useRequireProfile', () => ({ useRequireRole: () => state.guard, useRequireProfile: () => state.guard }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ profile: state.profile, refreshProfile: state.refresh }) }));
vi.mock('../../services/volunteerContacts', () => ({ fetchVolunteerContacts: () => state.contacts() }));
vi.mock('../../services/auth', () => ({ updateProfileSettings: (input: unknown) => state.save(input), signOut: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  state.guard = { ready: true, redirect: null, roleName: 'volunteer' };
  state.contacts.mockResolvedValue([]);
  state.save.mockResolvedValue(undefined);
  state.refresh.mockResolvedValue(undefined);
});

describe('private volunteer contacts', () => {
  test('participants are redirected before any team contacts are fetched', () => {
    state.guard = { ready: false, redirect: '/home', roleName: 'participant' };
    render(<MemoryRouter initialEntries={['/volunteer/contacts']}><Routes><Route path="/volunteer/contacts" element={<DirectoryPage />} /><Route path="/home" element={<div>Dashboard</div>} /></Routes></MemoryRouter>);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(state.contacts).not.toHaveBeenCalled();
    expect(screen.queryByText('Volunteer hub')).not.toBeInTheDocument();
  });

  test('authorized volunteers can reach team phone numbers without participant listings', async () => {
    state.contacts.mockResolvedValue([{ id: 'other-1', name: 'Team Admin', role: 'admin', subtype: null, phone: '5551239999' }]);
    render(<MemoryRouter><DirectoryPage /></MemoryRouter>);
    expect(await screen.findByText('Team Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '5551239999' })).toHaveAttribute('href', 'tel:5551239999');
    expect(screen.queryByText('Email private')).not.toBeInTheDocument();
  });
});

describe('unified profile', () => {
  test('holds the QR pass, account settings and volunteer contacts in one place', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/account']}><Routes><Route path="/account" element={<SettingsPage />} /></Routes></MemoryRouter>);
    expect(screen.getByText('Arjun Mahajan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit profile/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volunteer hub/ })).toBeInTheDocument();
    expect(screen.queryByText('List me in the directory')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /My QR Pass/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Digital pass');
  });

  test('editing saves supported personal fields without directory visibility settings', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/account/edit']}><Routes><Route path="/account/:section" element={<SettingsPage />} /></Routes></MemoryRouter>);
    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), 'Arjun Updated');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(state.save).toHaveBeenCalledWith({ name: 'Arjun Updated', phone: '5551234567', bio: '' });
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    expect(screen.queryByText('Organization')).not.toBeInTheDocument();
  });

  test('volunteer editing discloses team phone sharing and prevents removing the required number', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/account/edit']}><Routes><Route path="/account/:section" element={<SettingsPage />} /></Routes></MemoryRouter>);
    const phone = screen.getByLabelText('Phone');
    expect(phone).toBeRequired();
    expect(phone).toHaveAccessibleDescription('Your phone number is shared with other volunteers and admins for Summit-day coordination.');
    await user.clear(phone);
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled();
    expect(state.save).not.toHaveBeenCalled();
  });
});
