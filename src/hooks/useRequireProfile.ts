import { useAuth } from '../context/AuthContext';
import { needsProfileSetup } from '../services/auth';

/**
 * Shared guard for the authenticated tabs. Returns a `redirect` path when the
 * page shouldn't render its own content yet/at all, so each page can do:
 *
 *   const { ready, redirect } = useRequireProfile();
 *   if (redirect) return <Navigate to={redirect} replace />;
 *   if (!ready) return <Skeleton />;
 */
export function useRequireProfile(): {
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
  if (needsProfileSetup(profile)) {
    return { ready: false, redirect: '/profile', roleName };
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
  const { profile } = useAuth();
  const hasAllowedRole =
    allowed.includes(base.roleName) ||
    (allowed.includes('volunteer') && profile?.is_volunteer === true);
  if (base.ready && !hasAllowedRole) {
    return { ...base, ready: false, redirect: '/home' };
  }
  return base;
}
