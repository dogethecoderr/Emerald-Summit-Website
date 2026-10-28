import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Clock, Mail, MailCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SIGN_IN_ROLES } from '../models/roles';
import { requiresApproval } from '../models/approvalSurveys';
import { signInWithApprovedEmail, signInWithBypass } from '../services/auth';
import { isValidEmail, lookupApproval } from '../services/approvals';
import GoogleIcon from '../components/GoogleIcon';
import LinkedInIcon from '../components/LinkedInIcon';
import BrandMark from '../components/BrandMark';
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

  const incoming = (location.state as LoginLocationState | null) ?? {};
  const [email, setEmail] = useState(incoming.email ?? '');
  const [notice, setNotice] = useState<ApprovalNotice | null>(
    incoming.notice ?? null,
  );
  const [noticeEmail, setNoticeEmail] = useState(incoming.email ?? '');
  const [isChecking, setIsChecking] = useState(false);

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

  const handleBypass = () => {
    signInWithBypass(role.name);
    navigate('/home', { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 right-[-15%] h-[440px] w-[440px] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #0C7A55 0%, transparent 65%)' }}
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col px-6 lg:px-14">
        <header className="relative z-10 flex shrink-0 items-center justify-between pt-10 pb-6 lg:pt-16 lg:pb-10">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="relative z-10 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <BrandMark
            logoClassName="h-14 w-14 lg:h-[4.5rem] lg:w-[4.5rem]"
            titleClassName="text-lg font-semibold lg:text-2xl"
            subtitleClassName="text-xs text-muted-foreground lg:text-sm"
            textWrapperClassName="hidden leading-tight sm:block"
            gap="gap-4"
          />
          <span className="w-14" aria-hidden />
        </header>

        <div className="flex flex-1 items-start justify-center pb-16 pt-2 lg:pt-4">
          <div className="glass relative z-0 mx-auto w-full max-w-5xl rounded-2xl border border-border/80 p-6 sm:p-8 lg:p-10 xl:max-w-6xl">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-16 xl:gap-24">
              <div
                className="animate-fade-up lg:flex lg:w-[min(100%,440px)] lg:shrink-0 lg:flex-col lg:justify-center"
                style={{ animationDelay: '60ms' }}
              >
                <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-5">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl lg:h-14 lg:w-14"
                    style={{
                      background: `${role.color}1e`,
                      color: role.color,
                      boxShadow: `inset 0 0 0 1px ${role.color}44`,
                    }}
                  >
                    <role.icon className="h-6 w-6 lg:h-7 lg:w-7" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <h1 className="font-display text-xl font-semibold tracking-tight lg:text-3xl">
                      Sign in as {role.label}
                    </h1>
                  </div>
                </div>
              </div>

              <div
                className="animate-fade-up w-full lg:max-w-lg lg:flex-1 xl:max-w-xl"
                style={{ animationDelay: '120ms' }}
              >
                {gated && (
                  <>
                    {notice && <NoticeBanner notice={notice} email={noticeEmail} />}
                    <form onSubmit={handleEmail}>
                      <label htmlFor="login-email" className="mb-2 block text-[13px] font-medium">
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
                          className="h-12 rounded-xl bg-secondary/40 pl-10 text-[15px]"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="glow-emerald mt-3 h-12 w-full rounded-xl bg-primary text-[15px] font-semibold hover:bg-emerald"
                        disabled={!isValidEmail(email) || isChecking}
                      >
                        {isChecking ? (
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        ) : (
                          'Continue with email'
                        )}
                      </Button>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        First time here? We will ask a few questions, then an
                        admin approves your {role.label.toLowerCase()} access.
                      </p>
                    </form>
                    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      or
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  </>
                )}

                {/* Shown but inert for the demo: the OAuth providers are not
                    wired up to a backend yet, so they are rendered disabled
                    rather than failing when someone tries them. */}
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-xl border-border bg-secondary/40 text-[15px] font-semibold"
                  disabled
                >
                  <GoogleIcon size={20} />
                  <span className="ml-2">Continue with Google</span>
                </Button>

                <Button
                  variant="outline"
                  className="mt-3 h-12 w-full rounded-xl border-border bg-secondary/40 text-[15px] font-semibold"
                  disabled
                >
                  <LinkedInIcon size={20} />
                  <span className="ml-2">Continue with LinkedIn</span>
                </Button>

                <Button
                  variant="outline"
                  className="mt-3 h-12 w-full rounded-xl border-emerald-glow/40 bg-emerald/10 text-[15px] font-semibold text-emerald-mint hover:bg-emerald/20 hover:text-white"
                  onClick={handleBypass}
                >
                  <span>Bypass Login (Local Demo Mode)</span>
                </Button>

                <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground lg:text-left">
                  Google and LinkedIn sign-in are coming soon. For now, continue
                  with Bypass Login — your {role.label.toLowerCase()} role is
                  applied for the session.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
