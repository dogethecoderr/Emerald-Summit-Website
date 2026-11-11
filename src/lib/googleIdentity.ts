/**
 * Google's own sign-in button (Google Identity Services), so the Google popup
 * names this website instead of the Supabase project URL. The button hands
 * back a Google ID token, which Supabase checks with signInWithIdToken: the
 * same thing the app's native Google sign-in does, so it reaches the same
 * account.
 *
 * The client is the app's Web OAuth client (the app's GOOGLE_WEB_CLIENT_ID, in
 * Google Cloud project inspiring-chess-491023-g8). Client IDs are public, so
 * it lives in code. Every site address that shows the button must be listed
 * under that client's Authorized JavaScript origins.
 */
export const GOOGLE_WEB_CLIENT_ID =
  '665674617320-97u477dvell0tsalugj3i3p7eifkk7qr.apps.googleusercontent.com';

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const LOAD_TIMEOUT_MS = 8000;

/** The parts of `google.accounts.id` this site uses. */
export interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    nonce?: string;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: 'signin' | 'signup' | 'use';
    itp_support?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      logo_alignment?: 'left' | 'center';
      width?: number;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

let loading: Promise<GoogleIdApi | null> | null = null;

/**
 * Loads Google's script once. Resolves null if it can't load (blocked by an
 * extension, offline, or slow), so the page can fall back to the redirect flow.
 */
export function loadGoogleIdentity(): Promise<GoogleIdApi | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const done = (api: GoogleIdApi | null) => {
      if (!api) loading = null; // let a later visit try again
      resolve(api);
    };
    const timer = window.setTimeout(() => done(null), LOAD_TIMEOUT_MS);
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timer);
      done(window.google?.accounts?.id ?? null);
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      done(null);
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * A fresh nonce pair. Google gets the SHA-256 hash and puts it in the ID
 * token; Supabase gets the raw value, hashes it and compares, so a token can't
 * be replayed from another sign-in.
 */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}
