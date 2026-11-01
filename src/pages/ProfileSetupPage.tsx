import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { User, Phone, Check, School, Plus, X, Users, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { USER_DISCIPLINES } from '../models/disciplines';
import { tracksForUniverse } from '../models/tracks';
import {
  completeDemoProfile,
  DEFAULT_PROFILE_SETTINGS,
  getRegistration,
  isDemoSession,
  needsProfileSetup,
  saveProfile,
  signOut,
  type RegistrationDetails,
  type SaveProfileInput,
} from '../services/auth';
import AuthLayout, { AUTH_ENTER, authStagger } from '../components/AuthLayout';
import { roleByName, roleLabelFor, USER_ROLES } from '../models/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const BIO_WORD_LIMIT = 30;
const OVERVIEW_WORD_LIMIT = 75;
const MAX_TEAMMATES = 4;
const GRADES = [9, 10, 11, 12];
const FIELD_CLASS = 'h-12 rounded-xl bg-secondary/40 text-[15px]';

/**
 * Participants register in three steps; every other role only has the first.
 * The team, track, and project go to student_registrations, which only the
 * student and admins can read, and are shown nowhere in the app; picking a
 * track doesn't reserve any sessions. The planned verse is users.discipline.
 */
const STUDENT_STEPS = ['about', 'team', 'project'] as const;
type Step = (typeof STUDENT_STEPS)[number];

const STEP_COPY: Record<Step, { eyebrow: string; title: string; intro: string }> = {
  about: {
    eyebrow: 'About you',
    title: 'Tell us a bit about yourself',
    intro: 'Only your name and email are required — the rest helps others find and connect with you.',
  },
  team: {
    eyebrow: 'Team',
    title: 'Are you competing in a group?',
    intro: 'List everyone else on your team. They register on their own accounts too.',
  },
  project: {
    eyebrow: 'Project',
    title: 'Your project and verse',
    intro: 'Pick the verse and track you plan to compete in, and describe your project.',
  },
};

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

export default function ProfileSetupPage() {
  const { session, profile, loadingProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [grade, setGrade] = useState<number | null>(null);
  const [school, setSchool] = useState(DEFAULT_PROFILE_SETTINGS.org);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(
    null,
  );
  const [inTeam, setInTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teammates, setTeammates] = useState<string[]>(['']);
  const [track, setTrack] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectOverview, setProjectOverview] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Prefill from an existing profile, else from the mock account's name hint.
  useEffect(() => {
    if (prefilled || loadingProfile) return;

    if (profile) {
      const existingName = (profile.name as string | undefined)?.trim();
      if (existingName) setName(existingName);
      const existingPhone = (profile.phone as string | undefined)?.trim();
      if (existingPhone) setPhone(existingPhone);
      const existingBio = (profile.bio as string | undefined)?.trim();
      if (existingBio) setBio(existingBio);
      const disciplineName = profile.discipline as string | undefined;
      if (disciplineName) setSelectedDiscipline(disciplineName);
      setPrefilled(true);
      // Team, track, and project live in student_registrations.
      if (profile.role === 'participant') {
        void getRegistration().then((saved) => {
          if (!saved) return;
          if (saved.grade) setGrade(saved.grade);
          if (saved.school) setSchool(saved.school);
          if (saved.teamName || saved.teammates?.length) {
            setInTeam(true);
            setTeamName(saved.teamName ?? '');
            setTeammates(saved.teammates?.length ? saved.teammates : ['']);
          }
          if (saved.track) setTrack(saved.track);
          if (saved.projectTitle) setProjectTitle(saved.projectTitle);
          if (saved.projectOverview) setProjectOverview(saved.projectOverview);
        });
      }
    } else {
      const metadataName = session?.user.user_metadata?.full_name?.trim();
      if (metadataName && metadataName.length > 0) {
        setName(metadataName);
      }
      setPrefilled(true);
    }
  }, [profile, loadingProfile, prefilled, session]);

  // Demo mode: the pages work as normal, but saving or skipping only changes
  // the profile in this browser.
  const demo = session != null && isDemoSession();
  const isStudent = profile?.role === 'participant';
  const steps: readonly Step[] = isStudent ? STUDENT_STEPS : ['about'];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLastStep = stepIndex >= steps.length - 1;

  // Always the sign-in email: enforce_role_allowlist pins users.email to it.
  const email = (session?.user.email ?? profile?.email ?? '').trim();
  const bioWords = useMemo(() => wordCount(bio), [bio]);
  const overviewWords = useMemo(() => wordCount(projectOverview), [projectOverview]);
  const stepValid =
    step === 'about'
      ? name.trim().length > 0 && email.length > 0 && bioWords <= BIO_WORD_LIMIT
      : step === 'project'
        ? overviewWords <= OVERVIEW_WORD_LIMIT
        : true;
  const canContinue = stepValid && !isSaving;

  if (!loadingProfile && session == null) {
    return <Navigate to="/home" replace />;
  }

  if (!loadingProfile && session != null && !needsProfileSetup(profile)) {
    return <Navigate to="/home" replace />;
  }

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      setIsSigningOut(false);
      toast.error(`Sign out failed: ${error}`);
    }
  };

  const buildInput = (): SaveProfileInput => {
    const registration: RegistrationDetails | undefined = isStudent
      ? {
          grade,
          school,
          teamName: inTeam ? teamName : '',
          teammates: inTeam ? teammates : [],
          track: selectedDiscipline ? track : null,
          projectTitle,
          projectOverview,
        }
      : undefined;
    return {
      name: name.trim(),
      phone: phone.trim(),
      discipline: selectedDiscipline,
      bio: bio.trim(),
      registration,
    };
  };

  const handleFinish = async () => {
    if (!stepValid || name.trim().length === 0) return;
    const input = buildInput();
    if (demo) {
      completeDemoProfile(input);
      navigate('/home');
      return;
    }

    setIsSaving(true);
    try {
      await saveProfile(input);
      await refreshProfile();
      navigate('/home');
    } catch (error) {
      toast.error(`Could not save profile: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    if (!canContinue) return;
    if (isLastStep) {
      void handleFinish();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  // Demo only: move on without filling in this step. Skipping the last step
  // finishes setup in this browser.
  const handleSkip = () => {
    if (isLastStep) {
      completeDemoProfile();
      navigate('/home');
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const role = roleByName(profile?.role as string | undefined) ?? USER_ROLES[0];
  const copy = STEP_COPY[step];

  return (
    <AuthLayout
      accent={role.color}
      icon={role.icon}
      eyebrow={steps.length > 1 ? `Register · ${copy.eyebrow}` : 'Set up your profile'}
      title={roleLabelFor(role.name, profile?.volunteer_subtype)}
      backLabel={
        stepIndex > 0 ? 'Back' : isSigningOut ? 'Signing out…' : 'Sign out'
      }
      onBack={() =>
        stepIndex > 0 ? setStepIndex((i) => i - 1) : void handleSignOut()
      }
    >
        <div key={step} style={authStagger(1)} className={AUTH_ENTER}>
          {steps.length > 1 && (
            <StepDots count={steps.length} current={stepIndex} color={role.color} />
          )}
          <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{copy.intro}</p>
          {demo && (
            <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground">
              Demo mode: nothing on this page is saved to the Summit database.
            </p>
          )}
        </div>

        <div key={`${step}-fields`} className="animate-fade-up mt-8 space-y-6" style={{ animationDelay: '90ms' }}>
          {step === 'about' && (
            <>
              <Field id="name" label="Full name">
                <IconInput icon={User}>
                  <Input
                    id="name"
                    autoComplete="name"
                    placeholder="Jordan Lee"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn(FIELD_CLASS, 'pl-10')}
                  />
                </IconInput>
              </Field>

              <Field id="email" label="Email">
                <IconInput icon={Mail}>
                  <Input
                    id="email"
                    type="email"
                    readOnly
                    required
                    value={email}
                    className={cn(FIELD_CLASS, 'pl-10 text-muted-foreground')}
                  />
                </IconInput>
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  From your sign-in. Summit emails go here.
                </p>
              </Field>

              <Field id="phone" label="Phone" optional="optional, recommended for notifications">
                <IconInput icon={Phone}>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={cn(FIELD_CLASS, 'pl-10')}
                  />
                </IconInput>
              </Field>

              {isStudent && (
                <>
                  <Field label="Grade" optional>
                    <div className="grid grid-cols-4 gap-2.5" role="radiogroup" aria-label="Grade">
                      {GRADES.map((g) => (
                        <ChoiceButton
                          key={g}
                          selected={grade === g}
                          onClick={() => setGrade((current) => (current === g ? null : g))}
                        >
                          {g}th
                        </ChoiceButton>
                      ))}
                    </div>
                  </Field>

                  <Field id="school" label="School" optional>
                    <IconInput icon={School}>
                      <Input
                        id="school"
                        autoComplete="organization"
                        value={school}
                        onChange={(e) => setSchool(e.target.value)}
                        className={cn(FIELD_CLASS, 'pl-10')}
                      />
                    </IconInput>
                  </Field>
                </>
              )}

              {!isStudent && (
                <Field label="Discipline" optional>
                  <VersePicker
                    value={selectedDiscipline}
                    onChange={setSelectedDiscipline}
                  />
                </Field>
              )}

              <Field id="bio" label="Short bio" optional>
                <Textarea
                  id="bio"
                  rows={3}
                  placeholder="A sentence or two about yourself."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="rounded-xl bg-secondary/40 text-[15px]"
                />
                <WordCounter count={bioWords} limit={BIO_WORD_LIMIT} />
              </Field>
            </>
          )}

          {step === 'team' && (
            <>
              <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Team">
                <ChoiceButton selected={!inTeam} onClick={() => setInTeam(false)}>
                  <User className="mx-auto mb-1 h-5 w-5" />
                  Solo
                </ChoiceButton>
                <ChoiceButton selected={inTeam} onClick={() => setInTeam(true)}>
                  <Users className="mx-auto mb-1 h-5 w-5" />
                  In a group
                </ChoiceButton>
              </div>

              {inTeam && (
                <>
                  <Field id="team-name" label="Team name" optional>
                    <Input
                      id="team-name"
                      placeholder="The Summiteers"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      className={FIELD_CLASS}
                    />
                  </Field>

                  <Field label="Teammates">
                    <p className="-mt-1 mb-2 text-[12px] text-muted-foreground">
                      Everyone except you, up to {MAX_TEAMMATES}.
                    </p>
                    <div className="space-y-2.5">
                      {teammates.map((mate, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            aria-label={`Teammate ${i + 1}`}
                            placeholder={`Teammate ${i + 1}'s full name`}
                            value={mate}
                            onChange={(e) =>
                              setTeammates((list) =>
                                list.map((m, j) => (j === i ? e.target.value : m)),
                              )
                            }
                            className={FIELD_CLASS}
                          />
                          {teammates.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove teammate ${i + 1}`}
                              className="h-12 w-12 shrink-0 rounded-xl text-muted-foreground"
                              onClick={() =>
                                setTeammates((list) => list.filter((_, j) => j !== i))
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {teammates.length < MAX_TEAMMATES && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-2 gap-1.5 rounded-xl px-3 text-[13px] font-semibold"
                        onClick={() => setTeammates((list) => [...list, ''])}
                      >
                        <Plus className="h-4 w-4" /> Add teammate
                      </Button>
                    )}
                  </Field>
                </>
              )}
            </>
          )}

          {step === 'project' && (
            <>
              <Field label="Planned verse" optional>
                <VersePicker
                  value={selectedDiscipline}
                  onChange={(verse) => {
                    setSelectedDiscipline(verse);
                    // A track only makes sense inside its verse.
                    setTrack(null);
                  }}
                />
              </Field>

              <Field id="track" label="Planned track" optional>
                <Select
                  value={track ?? undefined}
                  onValueChange={setTrack}
                  disabled={!selectedDiscipline}
                >
                  <SelectTrigger id="track" className={FIELD_CLASS}>
                    <SelectValue
                      placeholder={selectedDiscipline ? 'Choose a track' : 'Pick a verse first'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {tracksForUniverse(selectedDiscipline ?? '').map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  This doesn't reserve any sessions. You build your schedule after registering.
                </p>
              </Field>

              <Field id="project-title" label="Project title" optional>
                <Input
                  id="project-title"
                  placeholder="Solar-powered water purifier"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className={FIELD_CLASS}
                />
              </Field>

              <Field id="project-overview" label="Project overview" optional>
                <Textarea
                  id="project-overview"
                  rows={4}
                  placeholder="What you're making or researching, and why."
                  value={projectOverview}
                  onChange={(e) => setProjectOverview(e.target.value)}
                  className="rounded-xl bg-secondary/40 text-[15px]"
                />
                <WordCounter count={overviewWords} limit={OVERVIEW_WORD_LIMIT} />
              </Field>
            </>
          )}

          <div className="flex flex-col gap-3">
            <Button
              className="glow-emerald h-12 w-full rounded-xl bg-primary text-[15px] font-semibold hover:bg-emerald"
              onClick={handleContinue}
              disabled={!canContinue}
            >
              {isSaving ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : isLastStep && steps.length > 1 ? (
                'Finish'
              ) : (
                'Continue'
              )}
            </Button>
            {demo && (
              <Button
                variant="outline"
                className="h-12 w-full rounded-xl border-dashed border-border/80 bg-transparent text-[15px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={handleSkip}
              >
                Skip
              </Button>
            )}
          </div>
        </div>
    </AuthLayout>
  );
}

function StepDots({ count, current, color }: { count: number; current: number; color: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={cn('h-1.5 rounded-full transition-all', i === current ? 'w-6' : 'w-1.5 bg-border')}
            style={i <= current ? { background: color } : undefined}
          />
        ))}
      </div>
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Step {current + 1} of {count}
      </span>
    </div>
  );
}

function Field({
  id,
  label,
  optional,
  children,
}: {
  id?: string;
  label: string;
  /** true shows "(optional)"; a string replaces the words in brackets. */
  optional?: boolean | string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-2 block text-[13px]">
        {label}
        {optional && (
          <span className="text-muted-foreground">
            {' '}({typeof optional === 'string' ? optional : 'optional'})
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

function IconInput({ icon: Icon, children }: { icon: typeof User; children: ReactNode }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {children}
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3 text-center text-[13px] font-semibold transition-all',
        selected
          ? 'border-transparent bg-accent shadow-[inset_0_0_0_1.5px_hsl(var(--primary))]'
          : 'border-border/70 bg-secondary/30 text-muted-foreground hover:bg-accent/50',
      )}
    >
      {children}
    </button>
  );
}

function WordCounter({ count, limit }: { count: number; limit: number }) {
  return (
    <div
      className={cn(
        'mt-1.5 text-right text-[11px] font-medium',
        count > limit ? 'text-red-400' : 'text-muted-foreground',
      )}
    >
      {count}/{limit} words
    </div>
  );
}

function VersePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (verse: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {USER_DISCIPLINES.map((d) => {
        const selected = value === d.name;
        return (
          <button
            key={d.name}
            type="button"
            onClick={() => onChange(selected ? null : d.name)}
            className={cn(
              'relative rounded-xl border p-3 text-left transition-all',
              selected
                ? 'border-transparent bg-accent'
                : 'border-border/70 bg-secondary/30 hover:bg-accent/50',
            )}
            style={
              selected
                ? { boxShadow: `inset 0 0 0 1.5px ${d.color}` }
                : undefined
            }
          >
            {selected && (
              <span
                className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full text-white"
                style={{ background: d.color }}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
            <span
              className="mb-1.5 block h-1.5 w-6 rounded-full"
              style={{ background: d.color }}
              aria-hidden
            />
            <span className="block text-[13px] font-semibold">
              {d.label}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
              {d.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
