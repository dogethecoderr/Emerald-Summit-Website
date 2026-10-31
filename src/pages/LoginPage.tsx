import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Clock, Loader2, Mail, MailCheck, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SIGN_IN_ROLES, roleLabelFor } from '../models/roles';
import { useAuth } from '../context/AuthContext';
import { requiresApproval } from '../models/approvalSurveys';
import { signInWithApprovedEmail, signInWithBypass, signInWithGoogle } from '../services/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import { isValidEmail, lookupApproval } from '../services/approvals';
import GoogleIcon from '../components/GoogleIcon';
import LinkedInIcon from '../components/LinkedInIcon';
import AuthLayout, { AUTH_ENTER, authStagger } from '../components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type ApprovalNotice = 'submitted' | 'awaiting' | 'rejected';

/** Router state the sign-up survey hands back to this page. */
export interface LoginLocationState {
  email?: string;
  notice?: ApprovalNotice;
}

export default function LoginPage() {
  const { role: roleName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const role = SIGN_IN_ROLES.find((r) => r.name === roleName);
  const { session, profile } = useAuth();
  const signedInRole = session ? ((profile?.role as string | undefined) ?? null) : null;

  const incoming = (location.state as LoginLocationState | null) ?? {};
  const [email, setEmail] = useState(incoming.email ?? '');
  const [notice, setNotice] = useState<ApprovalNotice | null>(
    incoming.notice ?? null,
  );
  const [noticeEmail, setNoticeEmail] = useState(incoming.email ?? '');
  const [isChecking, setIsChecking] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (!role) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="text-center">
          <p className="text-muted-foreground">Unknown role.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate('/home')}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }


  // Already signed in as this role: nothing to sign in to.
  if (signedInRole === role.name) {
    return <Navigate to="/home" replace />;
  }

  const gated = requiresApproval(role.name);

  // Approval-gated roles: the email decides between the survey (first time),
  // a pending notice, or signing straight in.
  const handleEmail = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed) || isChecking) return;

    setIsChecking(true);
    setNotice(null);
    try {
      const result = await lookupApproval(role.name, trimmed);
      if (result.status === 'approved') {
        signInWithApprovedEmail(role.name, trimmed, result.name ?? '');
        navigate('/home', { replace: true });
        return;
      }
      if (result.status === 'not_found') {
        navigate(`/apply/${role.name}`, { state: { email: trimmed } });
        return;
      }
      setNotice(result.status);
      setNoticeEmail(trimmed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsChecking(false);
    }
  };

  // Leaves for Google and comes back to /home, where the new account is
  // created with this role (the Sheets allowlist decides volunteer/admin).
  const handleGoogle = async () => {
    setIsRedirecting(true);
    try {
      await signInWithGoogle(role.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      setIsRedirecting(false);
    }
  };

  const handleBypass = () => {
    signInWithBypass(role.name);
    navigate('/home', { replace: true });
  };

  const needsList = role.name === 'volunteer' || role.name === 'admin';

  return (
    <AuthLayout
      accent={role.color}
      icon={role.icon}
      eyebrow="Sign in"
      title={role.label}
      onBack={() => navigate(signedInRole ? '/roles' : '/home')}
    >
      <div className="space-y-7">
        <header style={authStagger(1)} className={AUTH_ENTER}>
          <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-[44px]">
            Sign in as {role.label}
          </h1>
        </header>

        {signedInRole && (
          <p
            style={authStagger(2)}
            className={cn(AUTH_ENTER, 'rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground')}
          >
            You're signed in as{' '}
            <span className="font-semibold text-foreground">
              {roleLabelFor(signedInRole, profile?.volunteer_subtype)}
            </span>
            . Signing in as {role.label} ends that.
          </p>
        )}

        <div style={authStagger(3)} className={cn(AUTH_ENTER, 'space-y-3')}>
          {gated ? (
            <>
              {notice && <NoticeBanner notice={notice} email={noticeEmail} />}
              <form onSubmit={handleEmail} className="space-y-3">
                <label htmlFor="login-email" className="block text-[13px] font-medium">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl bg-card pl-10 text-[15px]"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-navy text-[15px] font-semibold text-white hover:bg-navy-bright dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                  disabled={!isValidEmail(email) || isChecking}
                >
                  {isChecking ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continue with email'}
                </Button>
              </form>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                First time here? We will ask a few questions, then an admin approves your{' '}
                {role.label.toLowerCase()} access.
              </p>
            </>
          ) : (
            <>
              {/* Google works wherever Supabase is configured. */}
              <Button
                type="button"
                className="h-12 w-full gap-3 rounded-xl bg-navy text-[15px] font-semibold text-white shadow-[0_10px_30px_-14px_rgba(16,28,54,0.8)] hover:bg-navy-bright dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                disabled={!isSupabaseConfigured || isRedirecting}
                onClick={handleGoogle}
              >
                {isRedirecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                    <GoogleIcon size={15} />
                  </span>
                )}
                {isRedirecting ? 'Opening Google…' : 'Continue with Google'}
              </Button>
              <span role="status" className="sr-only">
                {isRedirecting ? 'Opening Google' : ''}
              </span>
              {needsList && (
                <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: role.color }} />
                  {role.label}s need their Google email on the Summit team's {role.label.toLowerCase()} list.
                </p>
              )}
            </>
          )}
        </div>

        <div style={authStagger(4)} className={cn(AUTH_ENTER, 'space-y-3 border-t border-border pt-6')}>
          <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <LinkedInIcon size={16} />
            <span>LinkedIn sign-in</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">Coming soon</span>
          </div>
          <button
            type="button"
            onClick={handleBypass}
            className="group flex w-full items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 text-left transition-colors hover:border-emerald/50 hover:bg-card"
          >
            <span>
              <span className="block text-[13.5px] font-semibold">Use demo mode</span>
              <span className="block text-[12px] text-muted-foreground">
                A local session that skips the volunteer and admin lists.
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}

const NOTICE_COPY: Record<
  ApprovalNotice,
  { icon: typeof Mail; title: string; body: (email: string) => string; tone: string }
> = {
  submitted: {
    icon: MailCheck,
    title: 'Application received',
    body: (email) =>
      `Thanks! An admin will review it, and we will email ${email} once you are approved.`,
    tone: 'border-emerald/30 bg-emerald/10',
  },
  awaiting: {
    icon: Clock,
    title: 'Awaiting approval',
    body: (email) =>
      `Your application is still being reviewed. We will email ${email} once you are approved.`,
    tone: 'border-amber-500/30 bg-amber-500/10',
  },
  rejected: {
    icon: XCircle,
    title: 'Not approved',
    body: (email) =>
      `The application for ${email} was not approved. Contact the Summit team if you think this is a mistake.`,
    tone: 'border-red-500/30 bg-red-500/10',
  },
};

function NoticeBanner({ notice, email }: { notice: ApprovalNotice; email: string }) {
  const copy = NOTICE_COPY[notice];
  return (
    <div
      role="status"
      className={cn('mb-5 flex gap-3 rounded-xl border p-4', copy.tone)}
    >
      <copy.icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{copy.title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
          {copy.body(email)}
        </p>
      </div>
    </div>
  );
}
