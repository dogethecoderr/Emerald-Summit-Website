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
  needsProfileSetup: () => true,
  saveProfileDetails: (...args: unknown[]) => state.save(...args),
  signOut: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.save.mockResolvedValue(undefined);
  state.refresh.mockResolvedValue(undefined);
});

test.each([
  ['volunteer', 'Your phone number will be visible to other volunteers the day of for communication with them.'],
  ['admin', 'Your phone number will be visible to volunteers and other admins the day of for communication with them.'],
])('%s sign-up requires a mobile number and says who sees it', async (role, note) => {
  state.role = role;
  const user = userEvent.setup();
  render(<MemoryRouter><ProfileSetupPage /></MemoryRouter>);
  const phone = screen.getByLabelText('Mobile number');
  expect(phone).toBeRequired();
  expect(phone).toHaveAccessibleDescription(note);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Mobile number is required.');
  expect(state.save).not.toHaveBeenCalled();
  await user.type(phone, '5551234567');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(state.save).toHaveBeenCalledWith('Summit Team', expect.objectContaining({ phone: '5551234567' }), true);
});

test('participants pick a school and give a grade; the phone is optional', async () => {
  state.role = 'participant';
  const user = userEvent.setup();
  render(<MemoryRouter><ProfileSetupPage /></MemoryRouter>);
  expect(screen.getByLabelText(/Mobile number/)).not.toBeRequired();
  // No school is filled in for them.
  expect(screen.getByLabelText('School')).toHaveValue('');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Please answer "School".');
  await user.selectOptions(screen.getByLabelText('School'), 'Dublin High School');
  await user.type(screen.getByLabelText('Grade'), '11');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(state.save).toHaveBeenCalledWith('Summit Team', { school: 'Dublin High School', grade: '11', phone: '' }, true);
});

test('experts give their area of expertise and a one-line bio', () => {
  state.role = 'expert';
  render(<MemoryRouter><ProfileSetupPage /></MemoryRouter>);
  expect(screen.getByLabelText('Area of expertise')).toBeRequired();
  expect(screen.getByLabelText('One-line bio')).toBeRequired();
});
