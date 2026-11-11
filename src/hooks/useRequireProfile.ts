import { useAuth } from '../context/AuthContext';
import { needsProfileSetup } from '../services/auth';
import { missingGateField } from '../models/profileFields';

/**
 * Shared guard for the authenticated tabs. Returns a `redirect` path when the
 * page shouldn't render its own content yet/at all, so each page can do:
 *
 *   const { ready, redirect } = useRequireProfile();
 *   if (redirect) return <Navigate to={redirect} replace />;
 *   if (!ready) return <Skeleton />;
 */
export function useRequireProfile(options: { allowPendingExpert?: boolean } = {}): {
  ready: boolean;
  redirect: string | null;
  roleName: string;
} {
  const { session, profile, loadingProfile } = useAuth();
  const roleName = (profile?.role as string | undefined) ?? 'participant';

  if (session == null) {
    return { ready: false, redirect: '/home', roleName };
  }
  if (loadingProfile) {
    return { ready: false, redirect: null, roleName };
  }
  // The app's auth gate: finish sign-up, then a volunteer or admin with no
  // number, or a student volunteer or ambassador with no grade, adds it.
  if (needsProfileSetup(profile) || missingGateField(profile as Parameters<typeof missingGateField>[0])) {
    return { ready: false, redirect: '/profile', roleName };
  }
  if (!options.allowPendingExpert && roleName === 'expert' && profile?.expert_status !== 'approved') {
    return { ready: false, redirect: '/home', roleName };
  }
  return { ready: true, redirect: null, roleName };
}

/** Role-gated variant: also bounces to /home when the role isn't allowed. */
export function useRequireRole(allowed: string[]): {
  ready: boolean;
  redirect: string | null;
  roleName: string;
} {
  const base = useRequireProfile();
  if (base.ready && !allowed.includes(base.roleName)) {
    return { ...base, ready: false, redirect: '/home' };
  }
  return base;
}
