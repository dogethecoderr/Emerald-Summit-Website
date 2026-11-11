import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import GoogleIcon from './GoogleIcon';
import { useTheme } from '../context/ThemeContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { GOOGLE_WEB_CLIENT_ID, loadGoogleIdentity, makeNonce } from '../lib/googleIdentity';
import { signInWithGoogle, signInWithGoogleIdToken } from '../services/auth';

interface Props {
  /** The role a new account gets. */
  roleName: string;
  /** Another sign-in is running; the button can't be used. */
  disabled?: boolean;
  /** Called before Google sign-in starts, so the page can clear old errors. */
  onStart?: () => void;
  /** Called once Supabase has a session. */
  onSignedIn: () => void;
}

const BUTTON_CLASS =
  'h-12 w-full gap-3 rounded-xl bg-navy text-[15px] font-semibold text-white shadow-[0_10px_30px_-14px_rgba(16,28,54,0.8)] hover:bg-navy-bright dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90';

/**
 * Google's own "Continue with Google" button. Its popup names this website, not
 * the Supabase project URL, and nothing leaves the page. If Google's script
 * can't load, it falls back to the redirect sign-in.
 */
export default function GoogleSignInButton({ roleName, disabled, onStart, onSignedIn }: Props) {
  const { theme } = useTheme();
  const slot = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'loading' | 'google' | 'fallback'>(
    isSupabaseConfigured ? 'loading' : 'fallback',
  );
  const [busy, setBusy] = useState(false);
  // Bumped after a failed attempt so the button is set up again with a new nonce.
  const [attempt, setAttempt] = useState(0);

  // The Google callback is registered once per setup; read the latest props.
  const latest = useRef({ roleName, onStart, onSignedIn });
  latest.current = { roleName, onStart, onSignedIn };

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      const api = await loadGoogleIdentity();
      if (cancelled) return;
      if (!api || !slot.current) {
        setMode('fallback');
        return;
      }
      const nonce = await makeNonce();
      if (cancelled || !slot.current) return;
      api.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        nonce: nonce.hashed,
        ux_mode: 'popup',
        context: 'signin',
        itp_support: true,
        callback: async ({ credential }) => {
          if (!credential) {
            toast.error("Google sign-in didn't finish. Try again, or use your email.");
            return;
          }
          latest.current.onStart?.();
          setBusy(true);
          try {
            await signInWithGoogleIdToken(credential, nonce.raw, latest.current.roleName);
            latest.current.onSignedIn();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
            setBusy(false);
            setAttempt((n) => n + 1);
          }
        },
      });
      slot.current.replaceChildren();
      // The slot is hidden until now, so measure the wrapper. Google allows 200–400px.
      const available = slot.current.parentElement?.offsetWidth || 400;
      const width = Math.round(Math.min(400, Math.max(200, available)));
      api.renderButton(slot.current, {
        type: 'standard',
        theme: theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'center',
        width,
      });
      setMode('google');
    })();
    return () => {
      cancelled = true;
    };
  }, [theme, attempt]);

  const redirect = async () => {
    onStart?.();
    setBusy(true);
    try {
      await signInWithGoogle(roleName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  };

  return (
    <div>
      {busy && (
        <Button type="button" className={BUTTON_CLASS} disabled>
          <Loader2 className="h-5 w-5 animate-spin" />
          Signing in with Google…
        </Button>
      )}
      <span role="status" className="sr-only">{busy ? 'Signing in with Google' : ''}</span>
      {mode === 'fallback' && !busy && (
        <Button
          type="button"
          className={BUTTON_CLASS}
          disabled={!isSupabaseConfigured || disabled}
          onClick={redirect}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white"><GoogleIcon size={15} /></span>
          Continue with Google
        </Button>
      )}
      {mode === 'loading' && !busy && (
        <div aria-hidden className="h-12 w-full animate-pulse rounded-xl bg-muted" />
      )}
      {/* Google draws its button in here (an iframe); kept mounted so it isn't redrawn. */}
      <div
        ref={slot}
        data-testid="google-button-slot"
        className={cn(
          'flex min-h-[44px] w-full items-center justify-center',
          (mode !== 'google' || busy) && 'hidden',
          disabled && 'pointer-events-none opacity-60',
        )}
      />
    </div>
  );
}
