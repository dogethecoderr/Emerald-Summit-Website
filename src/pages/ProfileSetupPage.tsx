// Sign-up details, matching the app's onboarding and auth gate:
// - a new account gives its name and its role's questions
//   (models/profileFields.ts);
// - a signed-in volunteer or admin with no number, or a student volunteer or
//   EAF ambassador with no grade, is asked for just that before going on;
// - after Change role, the new role's questions are asked again, prefilled.
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Info, Mail, User } from '@/components/icons';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { needsProfileSetup, saveProfileDetails, signOut } from '../services/auth';
import AuthLayout, { AUTH_ENTER, authStagger } from '../components/AuthLayout';
import ProfileFieldInput from '../components/ProfileFieldInput';
import { roleByName, roleLabelFor, USER_ROLES } from '../models/roles';
import { formFields, missingGateField, SPECTATOR_AGES_NOTE, VOLUNTEER_GRADE_FIELD, type ProfileField } from '../models/profileFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const FIELD_CLASS = 'h-12 rounded-xl bg-secondary/40 text-[15px]';

/** Router state from Change role: ask the new role's questions. */
export interface ProfileSetupState {
  roleChanged?: boolean;
}

export default function ProfileSetupPage() {
  const { session, profile, loadingProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const roleChanged = (location.state as ProfileSetupState | null)?.roleChanged === true;

  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [prefilled, setPrefilled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const roleName = profile?.role as string | undefined;
  const subtype = profile?.volunteer_subtype as string | null | undefined;
  const onboarding = needsProfileSetup(profile);
  const gate = missingGateField(profile as Parameters<typeof missingGateField>[0]);

  useEffect(() => {
    if (prefilled || loadingProfile) return;
    const details = (profile?.details ?? {}) as Record<string, unknown>;
    setName(((profile?.name as string | undefined) ?? session?.user.user_metadata?.full_name ?? '').trim());
    setAnswers(Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v == null ? '' : String(v)])));
    setPrefilled(true);
  }, [profile, loadingProfile, prefilled, session]);

  if (!loadingProfile && session == null) return <Navigate to="/home" replace />;
  // Nothing to ask: go on into the site.
  if (!loadingProfile && session != null && !onboarding && !gate && !roleChanged) {
    return <Navigate to="/home" replace />;
  }

  // The gate asks only for what's missing, like the app's phone and grade screens.
  const gateOnly = !onboarding && !roleChanged && gate != null;
  const fields: ProfileField[] = gateOnly
    ? gate === 'phone'
      ? formFields(roleName, subtype).filter((f) => f.key === 'phone')
      : [VOLUNTEER_GRADE_FIELD]
    : formFields(roleName, subtype);
  const email = (session?.user.email ?? profile?.email ?? '').trim();
  const role = roleByName(roleName) ?? USER_ROLES[0];
  const label = roleLabelFor(role.name, subtype);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      setIsSigningOut(false);
      toast.error("Couldn't sign out. Try again.");
    }
  };

  const save = async () => {
    setError(null);
    if (!gateOnly && !name.trim()) return setError('Please enter your name.');
    const missing = fields.find((f) => f.required && !(answers[f.key] ?? '').trim());
    if (missing) {
      return setError(missing.key === 'phone' ? 'Mobile number is required.' : `Please answer "${missing.label}".`);
    }
    setIsSaving(true);
    try {
      const out = Object.fromEntries(fields.map((f) => [f.key, answers[f.key] ?? '']));
      await saveProfileDetails(gateOnly ? (profile?.name as string) ?? name : name, out, onboarding);
      await refreshProfile();
      navigate('/home', { replace: true });
    } catch {
      setError(gate === 'phone' && gateOnly ? 'Could not save your number. Please try again.' : 'Could not save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const title = gateOnly
    ? gate === 'phone' ? 'Add your number' : 'Add your grade'
    : roleChanged ? `Your details as ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}` : 'Tell us a bit about yourself';
  const intro = gateOnly
    ? gate === 'phone'
      ? `${role.label}s need a mobile number on file so the summit team can reach you.`
      : 'Student volunteers and EAF ambassadors give a grade. It goes on your volunteer hours record.'
    : 'Add your name and the details the summit team needs.';

  return (
    <AuthLayout
      accent={role.color}
      icon={role.icon}
      eyebrow="Set up your profile"
      title={label}
      backLabel={isSigningOut ? 'Signing out…' : 'Sign out'}
      onBack={() => void handleSignOut()}
    >
      <div style={authStagger(1)} className={AUTH_ENTER}>
        <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{intro}</p>
        {roleName === 'attendee' && !gateOnly && (
          <p className="mt-4 flex gap-2 rounded-xl bg-secondary/60 px-3.5 py-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />
            {SPECTATOR_AGES_NOTE}
          </p>
        )}
      </div>

      <form
        className="animate-fade-up mt-8 space-y-6"
        style={{ animationDelay: '90ms' }}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        {!gateOnly && (
          <>
            <div>
              <Label htmlFor="name" className="mb-2 block text-[13px] font-semibold">Full name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className={cn(FIELD_CLASS, 'pl-10')} />
              </div>
            </div>
            <div>
              <Label htmlFor="email" className="mb-2 block text-[13px] font-semibold">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" readOnly value={email} aria-describedby="email-help" className={cn(FIELD_CLASS, 'pl-10 text-muted-foreground')} />
              </div>
              <p id="email-help" className="mt-1.5 text-[12px] text-muted-foreground">From your sign-in. Summit emails go here.</p>
            </div>
          </>
        )}

        {fields.map((f) => (
          <ProfileFieldInput
            key={f.key}
            field={f}
            value={answers[f.key] ?? ''}
            onChange={(v) => setAnswers((a) => ({ ...a, [f.key]: v }))}
          />
        ))}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          className="glow-emerald h-12 w-full rounded-xl bg-primary text-[15px] font-semibold hover:bg-emerald"
          disabled={isSaving}
        >
          {isSaving ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : gateOnly ? 'Save and continue' : 'Continue'}
        </Button>
      </form>
    </AuthLayout>
  );
}
