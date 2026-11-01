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
  getBypassSession,
  getBypassProfile,
  BYPASS_USER_ID,
  signOut,
  SignInRefusedError,
  type Profile,
} from '../services/auth';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [signInError, setSignInError] = useState<string | null>(null);

  const refreshProfile = async (currentSession?: Session | null) => {
    const bypassS = getBypassSession();
    if (bypassS) {
      setProfile(getBypassProfile());
      setLoadingProfile(false);
      return;
    }

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
    
    const sync = () => {
      if (!mounted) return;
      const bypassS = getBypassSession();
      if (bypassS) {
        setSession(bypassS as any);
        setProfile(getBypassProfile());
        setLoadingProfile(false);
        return;
      }

      // A local session just ended: drop it now rather than after the
      // Supabase round trip below, so nothing renders it as signed in.
      setSession((current) => (current?.user?.id === BYPASS_USER_ID ? null : current));
      setProfile((current) => (current?.id === BYPASS_USER_ID ? null : current));

      // With no configured client there is no real session to restore — the
      // app runs bypass-only, and the loading state must still resolve.
      if (!supabase) {
        setSession(null);
        setProfile(null);
        setLoadingProfile(false);
        return;
      }

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (mounted) {
          if (getBypassSession()) return; // Avoid race condition if bypass was set
          setSession(session);
          refreshProfile(session);
        }
      });
    };

    sync();

    const subscription = supabase?.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mounted) {
          if (getBypassSession()) return;
          setSession(newSession);
          refreshProfile(newSession);
        }
      }
    ).data.subscription;

    const handleStorage = () => {
      sync();
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      window.removeEventListener('storage', handleStorage);
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
