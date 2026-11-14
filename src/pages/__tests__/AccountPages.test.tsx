import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DirectoryPage from '../DirectoryPage';
import SettingsPage from '../SettingsPage';

const state = vi.hoisted(() => ({
  guard: { ready: true, redirect: null as string | null, roleName: 'volunteer' },
  profile: { id: 'vol-1', name: 'Arjun Mahajan', email: 'arjun@example.com', role: 'volunteer', phone: '5551234567', bio: '', profile_setup_complete: true, details: { phone: '5551234567' } } as Record<string, unknown>,
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
vi.mock('../../services/auth', () => ({
  saveProfileDetails: (...args: unknown[]) => state.save(...args),
  setNotificationsEnabled: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../../services/summitStatus', () => ({ useSummitStatus: () => ({ date: null, feedbackOpen: false }) }));

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
    expect(screen.getByText('5551239999')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:5551239999');
    expect(screen.getByRole('link', { name: 'Text' })).toHaveAttribute('href', 'sms:5551239999');
    expect(screen.getByRole('button', { name: 'Copy number' })).toBeInTheDocument();
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

  test('editing saves the name and the role\'s sign-up answers, like the app', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/account/edit']}><Routes><Route path="/account/:section" element={<SettingsPage />} /></Routes></MemoryRouter>);
    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), 'Arjun Updated');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(state.save).toHaveBeenCalledWith('Arjun Updated', { phone: '5551234567', student_id: '' }, false);
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
  });

  test('a volunteer can\'t save without a mobile number, and is told who sees it', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/account/edit']}><Routes><Route path="/account/:section" element={<SettingsPage />} /></Routes></MemoryRouter>);
    const phone = screen.getByLabelText('Mobile number');
    expect(phone).toBeRequired();
    expect(phone).toHaveAccessibleDescription('Your phone number will be visible to other volunteers the day of for communication with them.');
    await user.clear(phone);
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(state.save).not.toHaveBeenCalled();
  });

  test('admins see the admin tools, like the app\'s Profile', () => {
    state.profile = { ...state.profile, role: 'admin' };
    state.guard = { ready: true, redirect: null, roleName: 'admin' };
    render(<MemoryRouter initialEntries={['/account']}><Routes><Route path="/account" element={<SettingsPage />} /></Routes></MemoryRouter>);
    for (const name of [/Metrics/, /Expert approvals/, /Manage rooms/, /Track volunteer hours/]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    // Front desk scans passes with the camera, so on the website it's labelled app-only.
    expect(screen.queryByRole('button', { name: /Front desk check-in/ })).toBeNull();
    expect(screen.getByText('Front desk check-in')).toBeInTheDocument();
    expect(screen.getByText('Mobile app only')).toBeInTheDocument();
    state.profile = { ...state.profile, role: 'volunteer' };
  });
});
