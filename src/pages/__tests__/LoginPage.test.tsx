import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '../LoginPage';

const auth = vi.hoisted(() => ({ send: vi.fn(), verify: vi.fn(), google: vi.fn(), isTest: vi.fn(), testSignIn: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ session: null, profile: null, clearSignInError: vi.fn() }) }));
vi.mock('../../services/auth', () => ({ sendSignInCode: (email: string, role: string) => auth.send(email, role), verifySignInCode: (email: string, code: string) => auth.verify(email, code), signInWithGoogle: auth.google, isTestAccount: (email: string) => auth.isTest(email), signInWithTestAccount: (email: string, password: string) => auth.testSignIn(email, password) }));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }));
vi.mock('../../components/AuthLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</>, AUTH_ENTER: '', authStagger: () => ({}) }));

beforeEach(() => {
  vi.clearAllMocks();
  auth.send.mockResolvedValue(undefined);
  auth.verify.mockResolvedValue(undefined);
  auth.isTest.mockResolvedValue(false);
  auth.testSignIn.mockResolvedValue(undefined);
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

test('a test account types the shared password instead of getting a code', async () => {
  auth.isTest.mockResolvedValue(true);
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/login/participant']}><Routes><Route path="/login/:role" element={<LoginPage />} /><Route path="/home" element={<div>Signed-in dashboard</div>} /></Routes></MemoryRouter>);
  await user.type(screen.getByLabelText('Email'), 'Admin@Test.Example');
  await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));
  expect(auth.send).not.toHaveBeenCalled();
  expect(screen.getByText('admin@test.example is a test account. Enter the test account password.', { exact: false })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  await user.type(screen.getByLabelText('Password'), 'shared');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(auth.testSignIn).toHaveBeenCalledWith('admin@test.example', 'shared');
  expect(await screen.findByText('Signed-in dashboard')).toBeInTheDocument();
});

test('use a different email leaves the password step', async () => {
  auth.isTest.mockResolvedValue(true);
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/login/participant']}><Routes><Route path="/login/:role" element={<LoginPage />} /></Routes></MemoryRouter>);
  await user.type(screen.getByLabelText('Email'), 'admin@test.example');
  await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));
  await user.click(screen.getByRole('button', { name: 'Use a different email' }));
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toBeEnabled();
});
