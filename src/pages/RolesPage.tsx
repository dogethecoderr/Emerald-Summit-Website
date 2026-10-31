import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Info, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SIGN_IN_ROLES, roleByName, roleLabelFor } from '../models/roles';
import BrandMark from '../components/BrandMark';
import SummitLogo from '../components/SummitLogo';
import { cn } from '@/lib/utils';

/** Roles the database or the experts sheet has to approve. */
const APPROVAL_ROLES = new Set(['volunteer', 'admin', 'expert']);

/** Router state for a refused switch, e.g. after a Google sign-in. */
export interface RolesLocationState {
  denied?: string;
}

function notEligibleMessage(roleName: string): string {
  const label = (roleByName(roleName)?.label ?? roleName).toLowerCase();
  const article = /^[aeiou]/.test(label) ? 'an' : 'a';
  return `You aren't eligible to sign up as ${article} ${label}.`;
}

/**
 * Pick a role. One role at a time: signed in, only the current role continues
 * straight to the dashboard; any other role means signing in again for it,
 * which ends the current one. Signed out, every role leads to its sign-in.
 */
export default function RolesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile } = useAuth();
  const signedIn = session != null;
  const currentRole = signedIn ? ((profile?.role as string | undefined) ?? null) : null;

  const denied = (location.state as RolesLocationState | null)?.denied ?? null;
  const pick = (roleName: string) => {
    if (signedIn && roleName === currentRole) {
      navigate('/home');
      return;
    }
    navigate(`/login/${roleName}`);
  };

  const name = (profile?.name as string | undefined) ?? '';

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Navy panel */}
      <aside className="relative overflow-hidden bg-navy px-6 pb-10 pt-8 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[42%] lg:flex-col lg:px-14 lg:pb-14 lg:pt-12">
        <div
          className="pointer-events-none absolute -left-24 top-1/3 h-[460px] w-[460px] animate-drift rounded-full bg-emerald/35 blur-[120px] motion-reduce:animate-none"
          aria-hidden
        />
        <svg
          className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] text-white/[0.06]"
          viewBox="0 0 420 420"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <circle cx="300" cy="120" r="70" />
          <circle cx="300" cy="120" r="140" />
          <circle cx="300" cy="120" r="210" />
        </svg>
        <div
          className="pointer-events-none absolute -bottom-16 -right-10 hidden h-72 w-72 opacity-[0.12] lg:block"
          aria-hidden
        >
          <SummitLogo />
        </div>

        <div className="relative flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(signedIn ? '/home' : '/')}
            className="inline-flex items-center gap-1 text-sm font-medium text-white/65 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            {signedIn ? 'Back to dashboard' : 'Back'}
          </button>
        </div>

        <div className="relative mt-8 lg:mt-14">
          <BrandMark
            logoClassName="h-12 w-12 lg:h-14 lg:w-14"
            titleClassName="text-lg font-bold text-white lg:text-xl"
            subtitleClassName="text-xs text-white/55 lg:text-sm"
            gap="gap-3"
          />
        </div>

        <div className="relative mt-10 lg:my-auto lg:pb-28">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-sky-300">
            Emerald Summit 2027 · Dublin, CA
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold leading-[1.08] tracking-tight lg:text-[52px]">
            Who are you at the Summit?
          </h1>
          {signedIn && (
            <div className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-white/[0.08] py-1.5 pl-1.5 pr-4 ring-1 ring-inset ring-white/15">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: roleByName(currentRole ?? undefined)?.color ?? '#0C7A55' }}
                aria-hidden
              >
                {name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
              <span className="text-[13px] text-white/80">
                Signed in as <span className="font-semibold text-white">{name}</span> ·{' '}
                {roleLabelFor(currentRole ?? undefined, profile?.volunteer_subtype)}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Role cards */}
      <main className="flex-1 px-6 py-10 lg:flex lg:items-center lg:px-14 lg:py-14">
        <div className="mx-auto w-full max-w-2xl">
          {signedIn && currentRole && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-emerald" />
              <p className="text-sm">
                You're signed in as{' '}
                <span className="font-semibold">
                  {roleLabelFor(currentRole, profile?.volunteer_subtype)}
                </span>
                . Signing in as another role ends this one.
              </p>
            </div>
          )}

          {denied && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800"
            >
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="text-sm">
                <div className="font-semibold">{notEligibleMessage(denied)}</div>
              </div>
            </div>
          )}

          {/* Role rows: solid color tiles in a list, deliberately unlike the
              tinted session cards elsewhere in the portal. */}
          <div className="space-y-3">
            {SIGN_IN_ROLES.map((r, i) => {
              const isCurrent = r.name === currentRole;
              return (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => pick(r.name)}
                  className={cn(
                    'animate-fade-up group flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all sm:gap-5 sm:p-5',
                    isCurrent
                      ? 'border-navy bg-navy text-white shadow-[0_16px_40px_-18px_rgba(16,28,54,0.6)]'
                      : 'border-transparent bg-card shadow-sm hover:translate-x-1 hover:border-[var(--role)]',
                  )}
                  style={{
                    animationDelay: `${i * 60}ms`,
                    ['--role' as string]: r.color,
                  }}
                >
                  <span
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                    style={{ background: r.color }}
                  >
                    <r.icon className="h-7 w-7" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-bold tracking-tight">
                        {r.label}
                      </span>
                      {isCurrent ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                          style={{ background: r.color }}
                        >
                          Current role
                        </span>
                      ) : APPROVAL_ROLES.has(r.name) ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                          <ShieldCheck className="h-3.5 w-3.5" /> Approval needed
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block text-[13.5px] leading-snug',
                        isCurrent ? 'text-white/70' : 'text-muted-foreground',
                      )}
                    >
                      {r.description}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'hidden shrink-0 items-center gap-1 text-[13px] font-semibold sm:flex',
                      isCurrent ? 'text-white' : 'text-foreground/70 group-hover:text-foreground',
                    )}
                  >
                    {isCurrent ? 'Continue' : 'Sign in'}
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <ChevronRight
                    className={cn('h-5 w-5 shrink-0 sm:hidden', isCurrent ? 'text-white' : 'text-muted-foreground')}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
