import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '../LoginPage';

const auth = vi.hoisted(() => ({ send: vi.fn(), verify: vi.fn(), google: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ session: null, profile: null, clearSignInError: vi.fn() }) }));
vi.mock('../../services/auth', () => ({ sendSignInCode: (email: string, role: string) => auth.send(email, role), verifySignInCode: (email: string, code: string) => auth.verify(email, code), signInWithGoogle: auth.google, signInWithBypass: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }));
vi.mock('../../lib/demoMode', () => ({ isDemoModeEnabled: false }));
vi.mock('../../components/AuthLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</>, AUTH_ENTER: '', authStagger: () => ({}) }));

beforeEach(() => {
  vi.clearAllMocks();
  auth.send.mockResolvedValue(undefined);
  auth.verify.mockResolvedValue(undefined);
});

test('expert email sign-in requires a verified code and offers no LinkedIn or local approval bypass', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/login/expert']}><Routes><Route path="/login/:role" element={<LoginPage />} /><Route path="/home" element={<div>Signed-in dashboard</div>} /></Routes></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  expect(screen.queryByText('LinkedIn sign-in')).not.toBeInTheDocument();
  expect(screen.queryByText('Use demo mode')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Email'), 'Expert@Example.com');
  await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));
  expect(auth.send).toHaveBeenCalledWith('expert@example.com', 'expert');
  expect(auth.verify).not.toHaveBeenCalled();
  await user.type(await screen.findByLabelText('Sign-in code'), '12345678');
  await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));
  expect(auth.verify).toHaveBeenCalledWith('expert@example.com', '12345678');
  expect(await screen.findByText('Signed-in dashboard')).toBeInTheDocument();
});
