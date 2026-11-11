import { beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import GoogleSignInButton from '../GoogleSignInButton';
import { makeNonce } from '../../lib/googleIdentity';

// Google's button hands back an ID token; the page gives it to Supabase with
// the raw nonce, the same check the app's native Google sign-in uses.
const google = vi.hoisted(() => ({
  api: null as null | { initialize: ReturnType<typeof vi.fn>; renderButton: ReturnType<typeof vi.fn> },
  idToken: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }));
vi.mock('../../services/auth', () => ({
  signInWithGoogleIdToken: (token: string, nonce: string, role: string) => google.idToken(token, nonce, role),
  signInWithGoogle: (role: string) => google.redirect(role),
}));
vi.mock('../../lib/googleIdentity', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/googleIdentity')>();
  return {
    ...real,
    loadGoogleIdentity: async () => google.api,
    makeNonce: async () => ({ raw: 'raw-nonce', hashed: 'hashed-nonce' }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  google.idToken.mockResolvedValue(undefined);
  google.api = {
    initialize: vi.fn(),
    renderButton: vi.fn((parent: HTMLElement) => {
      parent.innerHTML = '<div role="button">Continue with Google</div>';
    }),
  };
});

test("Google's button signs in with the ID token, the raw nonce and the page's role", async () => {
  const onSignedIn = vi.fn();
  render(<GoogleSignInButton roleName="expert" onSignedIn={onSignedIn} />);
  await waitFor(() => expect(google.api!.renderButton).toHaveBeenCalled());
  const config = google.api!.initialize.mock.calls[0][0];
  expect(config).toMatchObject({ client_id: expect.stringContaining('665674617320-97u'), nonce: 'hashed-nonce', ux_mode: 'popup' });
  expect(screen.getByTestId('google-button-slot')).not.toHaveClass('hidden');

  await act(async () => { await config.callback({ credential: 'google-id-token' }); });
  expect(google.idToken).toHaveBeenCalledWith('google-id-token', 'raw-nonce', 'expert');
  expect(onSignedIn).toHaveBeenCalled();
  expect(google.redirect).not.toHaveBeenCalled();
});

test('a refused token shows the reason and sets the button up again', async () => {
  google.idToken.mockRejectedValue(new Error("Google sign-in didn't finish (bad audience). Try again, or use your email."));
  const onSignedIn = vi.fn();
  render(<GoogleSignInButton roleName="participant" onSignedIn={onSignedIn} />);
  await waitFor(() => expect(google.api!.initialize).toHaveBeenCalledTimes(1));
  await act(async () => { await google.api!.initialize.mock.calls[0][0].callback({ credential: 't' }); });
  expect(onSignedIn).not.toHaveBeenCalled();
  await waitFor(() => expect(google.api!.initialize).toHaveBeenCalledTimes(2));
});

test("without Google's script, the redirect button still works", async () => {
  google.api = null;
  render(<GoogleSignInButton roleName="participant" onSignedIn={vi.fn()} />);
  const button = await screen.findByRole('button', { name: 'Continue with Google' });
  await act(async () => { button.click(); });
  expect(google.redirect).toHaveBeenCalledWith('participant');
});

test('the nonce Google gets is the SHA-256 of the one Supabase gets', async () => {
  const { makeNonce: realMakeNonce } = await vi.importActual<typeof import('../../lib/googleIdentity')>('../../lib/googleIdentity');
  const { raw, hashed } = await realMakeNonce();
  expect(raw.length).toBeGreaterThan(20);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  expect(hashed).toBe(Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(''));
  expect(makeNonce).toBeDefined();
});
