import { Link, useNavigate } from 'react-router-dom';
import { Info, XCircle } from '@/components/icons';
import ThemeToggle from '../components/ThemeToggle';
import SummitLogo from '../components/SummitLogo';
import EafLogo from '../components/EafLogo';
import { useAuth } from '../context/AuthContext';
import { CHOOSER_ROLES, roleByName, roleLabelFor, type RoleInfo } from '../models/roles';
import { cn } from '@/lib/utils';
import BackButton from '../components/BackButton';
import { usePageMeta } from '../lib/pageMeta';

const CONTACT_EMAIL = 'contact@ehsacademics.org';

const SECTIONS = [
  { heading: 'Attending the Summit', roles: CHOOSER_ROLES.filter((r) => r.section === 'attending') },
  { heading: 'Helping run the Summit', roles: CHOOSER_ROLES.filter((r) => r.section === 'helping') },
];

const ENTER = 'animate-fade-up motion-reduce:animate-none';

/**
 * How are you joining the Summit? Each role has Sign in and Sign up (both go
 * to the same email-code / Google sign-in, which makes the account when it is
 * new). Admins and test accounts use "Organizer sign in" at the bottom. One
 * role at a time: signed in, the current role's card continues to the
 * dashboard, and any other role means signing in again for it.
 */
export default function RolesPage() {
  const navigate = useNavigate();
  const { session, profile, signInError, clearSignInError } = useAuth();
  const signedIn = session != null;

  usePageMeta({
    title: 'Sign In — Emerald Summit 2027',
    description: 'Sign in or sign up for Emerald Summit 2027 as a participant, spectator, volunteer, expert, or organizer.',
    path: '/roles',
  });
  const currentRole = signedIn ? ((profile?.role as string | undefined) ?? null) : null;

  const go = (roleName: string, signUp = false) => {
    clearSignInError();
    if (signedIn && roleName === currentRole) {
      navigate('/home');
      return;
    }
    navigate(`/login/${roleName}${signUp ? '?mode=signup' : ''}`);
  };

  let cardIndex = 0;

  return (
    <div className="relative min-h-svh bg-background lg:grid lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)]">
      <BackButton onClick={() => navigate(signedIn ? '/home' : '/')} className="absolute left-4 top-5 z-10 sm:left-8 sm:top-8">
        {signedIn ? 'Back to dashboard' : 'Back'}
      </BackButton>
      <ThemeToggle className="absolute right-4 top-5 z-10 rounded-xl border border-border bg-card sm:right-8 sm:top-8" />

      {/* Identity: headline, the Summit seal, and who organizes it */}
      <aside className="flex flex-col items-center border-b border-border px-6 pb-10 pt-20 text-center lg:sticky lg:top-0 lg:h-svh lg:border-b-0 lg:border-r lg:px-10 lg:py-16">
        <div className="my-auto flex w-full max-w-xl flex-col items-center">
          <p className={cn(ENTER, 'text-sm font-semibold text-primary')}>
            Emerald Summit &rsquo;27 · Dublin, CA
          </p>
          <h1
            className={cn(ENTER, 'mt-3 font-display text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl xl:text-[58px]')}
            style={{ animationDelay: '60ms' }}
          >
            How are you joining the Summit?
          </h1>
          <p
            className={cn(ENTER, 'mt-5 max-w-sm text-[15px] leading-relaxed text-muted-foreground sm:text-base')}
            style={{ animationDelay: '120ms' }}
          >
            Choose the option that fits you best, then sign in or create an account.
          </p>

          <Link
            to="/"
            aria-label="Emerald Summit, back to home"
            className={cn(
              ENTER,
              'mt-8 block h-36 w-36 rounded-full bg-white p-1.5 shadow-[0_24px_60px_-28px_rgba(12,122,85,0.55)] ring-1 ring-black/5 transition-transform duration-300 hover:scale-[1.03] sm:h-44 sm:w-44 lg:mt-12 lg:h-60 lg:w-60 xl:h-64 xl:w-64',
            )}
            style={{ animationDelay: '180ms' }}
          >
            <SummitLogo />
          </Link>

          <div
            className={cn(ENTER, 'mt-8 flex items-center gap-3 text-left lg:mt-12')}
            style={{ animationDelay: '240ms' }}
          >
            <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white p-0.5 ring-1 ring-black/5 lg:h-16 lg:w-16">
              <EafLogo />
            </span>
            <span className="leading-tight">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Organized by
              </span>
              <span className="mt-1 block text-[15px] font-semibold">EHS Academic Foundation</span>
            </span>
          </div>
        </div>
      </aside>

      {/* Role cards */}
      <main className="px-4 py-10 sm:px-8 lg:flex lg:min-h-svh lg:items-center lg:px-12 lg:py-24">
        <div className="mx-auto w-full max-w-2xl">
          {signedIn && currentRole && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm">
                You're signed in as{' '}
                <span className="font-semibold">
                  {roleLabelFor(currentRole, profile?.volunteer_subtype)}
                </span>
                . Signing in as another role ends this one.
              </p>
            </div>
          )}

          {signInError && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
            >
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="text-sm font-semibold">{signInError}</div>
            </div>
          )}

          <div className="space-y-9">
            {SECTIONS.map((section) => (
              <section key={section.heading} aria-labelledby={`roles-${section.roles[0].name}`}>
                <h2
                  id={`roles-${section.roles[0].name}`}
                  className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {section.heading}
                </h2>
                <div className="space-y-3">
                  {section.roles.map(({ name, title, description }) => {
                    const role = roleByName(name);
                    if (!role) return null;
                    return (
                      <RoleCard
                        key={name}
                        role={role}
                        title={title}
                        description={description}
                        index={cardIndex++}
                        isCurrent={name === currentRole}
                        onSignIn={() => go(name)}
                        onSignUp={() => go(name, true)}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm">
            <p className="text-muted-foreground">
              Not sure?{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-primary underline underline-offset-4 hover:opacity-80"
              >
                Contact the EAF team
              </a>
            </p>
            <button
              type="button"
              onClick={() => go('admin')}
              className="font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Organizer sign in
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function RoleCard({
  role,
  title,
  description,
  index,
  isCurrent,
  onSignIn,
  onSignUp,
}: {
  role: RoleInfo;
  title: string;
  description: string;
  index: number;
  isCurrent: boolean;
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  const copy = { title, description };
  const button =
    'inline-flex h-10 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none';
  return (
    <div
      className={cn(
        ENTER,
        'flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5',
        isCurrent ? 'border-primary' : 'border-border',
      )}
      style={{ animationDelay: `${120 + index * 60}ms` }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white sm:h-14 sm:w-14 sm:rounded-2xl"
          style={{ background: role.color }}
        >
          <role.icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold tracking-tight sm:text-xl">{copy.title}</h3>
            {isCurrent && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                Current role
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground sm:text-sm">
            {copy.description}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {isCurrent ? (
          <button
            type="button"
            onClick={onSignIn}
            className={cn(button, 'bg-primary text-primary-foreground hover:bg-primary/90')}
          >
            Continue
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onSignIn}
              aria-label={`Sign in as ${copy.title}`}
              className={cn(button, 'border border-border bg-background hover:bg-secondary')}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={onSignUp}
              aria-label={`Sign up as ${copy.title}`}
              className={cn(button, 'bg-primary text-primary-foreground hover:bg-primary/90')}
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </div>
  );
}
