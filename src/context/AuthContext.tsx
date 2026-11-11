import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import {
  getCurrentProfile,
  signOut,
  SignInRefusedError,
  takeTestAccountNotice,
  takeOAuthError,
  type Profile,
} from '../services/auth';
import { toast } from 'sonner';
import type { Session } from '@supabase/supabase-js';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loadingProfile: boolean;
  refreshProfile: () => Promise<void>;
  /**
   * Why the last sign-in was ended, e.g. "You aren't eligible to sign up as
   * a volunteer." Shown on the roles page until the next role is picked.
   */
  signInError: string | null;
  clearSignInError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// A Google sign-in that failed comes back with the reason in the URL. Read it
// once at load: StrictMode runs state initializers twice, and the first run
// already removes it from the address bar.
const oauthErrorAtLoad = takeOAuthError();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [signInError, setSignInError] = useState<string | null>(oauthErrorAtLoad);

  const refreshProfile = async (currentSession?: Session | null) => {
    const s = currentSession !== undefined ? currentSession : session;
    if (!s?.user) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }
    
    setLoadingProfile(true);
    try {
      const next = await getCurrentProfile(s.user);
      setProfile(next);
      const notice = takeTestAccountNotice();
      if (notice) toast.info(notice);
    } catch (err) {
      // A refused role or an unreadable account ends the session outright:
      // no falling back to the account's old role or to participant.
      console.error(err);
      setSession(null);
      setProfile(null);
      setSignInError(
        err instanceof SignInRefusedError
          ? err.message
          : "We couldn't load your account. Try signing in again.",
      );
      await signOut().catch(() => {});
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    // With no configured client there is no session to restore, and the
    // loading state must still resolve.
    if (!supabase) {
      setSession(null);
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      refreshProfile(session);
    });

    const subscription = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      refreshProfile(newSession);
    }).data.subscription;

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loadingProfile,
        refreshProfile,
        signInError,
        clearSignInError: () => setSignInError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
