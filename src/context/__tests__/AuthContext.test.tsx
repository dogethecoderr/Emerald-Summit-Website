import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const signOut = vi.hoisted(() => vi.fn(async () => ({ error: null })));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'user-1', email: 'student@example.com' } } },
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut,
    },
  },
}));

vi.mock('../../services/auth', async (importActual) => {
  const actual = await importActual<typeof import('../../services/auth')>();
  return {
    ...actual,
    getCurrentProfile: vi.fn(async () => {
      throw new actual.SignInRefusedError(
        "You aren't eligible to sign up as a volunteer.",
        'volunteer',
      );
    }),
  };
});

const { AuthProvider, useAuth } = await import('../AuthContext');
const { default: RolesPage } = await import('../../pages/RolesPage');

function Probe() {
  const { session, profile } = useAuth();
  return <div data-testid="state">{session ? `signed in: ${profile?.role}` : 'signed out'}</div>;
}

describe('AuthProvider', () => {
  test('a refused sign-in signs out and shows the reason instead of another role', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
          <RolesPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("You aren't eligible to sign up as a volunteer."),
    ).toBeInTheDocument();
    expect(screen.getByTestId('state')).toHaveTextContent('signed out');
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });
});
