import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProfileSetupPage from '../ProfileSetupPage';

const state = vi.hoisted(() => ({
  role: 'volunteer',
  save: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({
  session: { user: { id: 'user-1', email: 'team@example.com', user_metadata: {} } },
  profile: { id: 'user-1', name: 'Summit Team', email: 'team@example.com', role: state.role, profile_setup_complete: false },
  loadingProfile: false,
  refreshProfile: state.refresh,
}) }));
vi.mock('../../components/AuthLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</>, AUTH_ENTER: '', authStagger: () => ({}) }));
vi.mock('../../services/auth', () => ({
  DEFAULT_PROFILE_SETTINGS: { org: '' },
  isDemoSession: () => false,
  getRegistration: async () => null,
  needsProfileSetup: () => true,
  saveProfile: (input: unknown) => state.save(input),
  signOut: vi.fn(),
  completeDemoProfile: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.save.mockResolvedValue(undefined);
  state.refresh.mockResolvedValue(undefined);
});

test.each(['volunteer', 'admin'])('%s onboarding requires a phone number and explains team sharing', async (role) => {
  state.role = role;
  const user = userEvent.setup();
  render(<MemoryRouter><ProfileSetupPage /></MemoryRouter>);
  const phone = screen.getByLabelText('Phone');
  expect(phone).toBeRequired();
  expect(phone).toHaveAccessibleDescription('Your phone number is shared with other volunteers and admins for Summit-day coordination.');
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await user.type(phone, '5551234567');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(state.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Summit Team', phone: '5551234567' }));
});

test('participant onboarding keeps the phone optional', () => {
  state.role = 'participant';
  render(<MemoryRouter><ProfileSetupPage /></MemoryRouter>);
  expect(screen.getByLabelText(/Phone/)).not.toBeRequired();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  expect(screen.queryByText(/shared with other volunteers and admins/)).not.toBeInTheDocument();
});
