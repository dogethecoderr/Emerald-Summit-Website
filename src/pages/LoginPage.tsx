import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { SIGN_IN_ROLES } from '../models/roles';
import {
  signInWithGoogle,
  signInWithLinkedIn,
  signInWithBypass,
} from '../services/auth';
import GoogleIcon from '../components/GoogleIcon';
import LinkedInIcon from '../components/LinkedInIcon';
import BrandMark from '../components/BrandMark';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { role: roleName } = useParams();
  const navigate = useNavigate();
  const role = SIGN_IN_ROLES.find((r) => r.name === roleName);

  const [isLoading, setIsLoading] = useState(false);

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



  const handleGoogle = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle(role.name);
      // signInWithGoogle redirects, so code below here won't run.
    } catch (error) {
      toast.error(`Google sign-in failed: ${error}`);
      setIsLoading(false);
    }
  };

  const handleLinkedIn = async () => {
    setIsLoading(true);
    try {
      await signInWithLinkedIn(role.name);
      // Redirects, so this won't be reached usually.
    } catch (error) {
      toast.error(`LinkedIn sign-in failed: ${error}`);
      setIsLoading(false);
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
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-xl border-border bg-secondary/40 text-[15px] font-semibold hover:bg-accent"
                  onClick={handleGoogle}
                  disabled={isLoading}
                >
                  <GoogleIcon size={20} />
                  <span className="ml-2">Continue with Google</span>
                </Button>

                <Button
                  variant="outline"
                  className="mt-3 h-12 w-full rounded-xl border-border bg-secondary/40 text-[15px] font-semibold hover:bg-accent"
                  onClick={handleLinkedIn}
                  disabled={isLoading}
                >
                  <LinkedInIcon size={20} />
                  <span className="ml-2">Continue with LinkedIn</span>
                </Button>

                <Button
                  variant="outline"
                  className="mt-3 h-12 w-full rounded-xl border-emerald-glow/40 bg-emerald/10 text-[15px] font-semibold text-emerald-mint hover:bg-emerald/20 hover:text-white"
                  onClick={handleBypass}
                  disabled={isLoading}
                >
                  <span>Bypass Login (Local Demo Mode)</span>
                </Button>

                <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground lg:text-left">
                  Sign in with your Google account. Your {role.label.toLowerCase()} role will be saved to your
                  profile.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
