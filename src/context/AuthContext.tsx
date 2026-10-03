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
  type Profile,
} from '../services/auth';
import type { Session } from '@supabase/supabase-js';
import { getDemoPeople, subscribeOfflineDemo } from '../services/offlineDemo';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loadingProfile: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

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
      console.error(err);
      setProfile(null);
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

  useEffect(() => {
    const userId = session?.user.id;
    if (!supabase || !userId || typeof supabase.channel !== 'function') return;

    const client = supabase;
    const channel = client
      .channel(`profile-checkin-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        ({ new: updated }) => {
          setProfile((current) => current
            ? {
                ...current,
                checked_in_at: updated.checked_in_at,
                discipline: updated.discipline,
                is_front_desk: updated.is_front_desk,
                is_volunteer: updated.is_volunteer,
              }
            : current);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (supabase) return;
    return subscribeOfflineDemo(() => {
      const activeProfile = getBypassProfile();
      if (!activeProfile) return;
      const person = getDemoPeople().find((candidate) => candidate.id === activeProfile.id);
      if (!person) return;
      setProfile((current) => current?.id === person.id
        ? {
            ...current,
            name: person.name,
            role: person.role,
            discipline: person.discipline ?? null,
            is_volunteer: person.is_volunteer ?? person.role === 'volunteer',
            is_front_desk: person.is_front_desk ?? false,
            checked_in_at: person.checked_in_at ?? undefined,
          }
        : current);
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, profile, loadingProfile, refreshProfile }}
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
