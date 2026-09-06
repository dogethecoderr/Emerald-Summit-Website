import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Info,
  LogOut,
  User,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import PersonCard from '../components/PersonCard';
import { useRequireProfile } from '../hooks/useRequireProfile';
import { useAuth } from '../context/AuthContext';
import { roleByName, USER_ROLES } from '../models/roles';
import type { Visibility } from '../models/people';
import {
  getProfileSettings,
  profileToPerson,
  signOut,
  updateProfileSettings,
  type Profile,
} from '../services/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function FieldCard({
  title,
  description,
  children,
  visibility,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  visibility?: {
    value: Visibility;
    onChange: (value: Visibility) => void;
    disabled?: boolean;
  };
}) {
  const isPublic = visibility?.value === 'public';

  return (
    <div className="rounded-xl border border-border/70 bg-secondary/30 px-4 py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{title}</div>
          {description && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {description}
            </div>
          )}
        </div>
        {visibility && (
          <div className="flex shrink-0 items-center gap-2 self-center">
            <span
              className={cn(
                'text-[11px] font-semibold',
                isPublic ? 'text-emerald-mint' : 'text-muted-foreground',
              )}
            >
              {isPublic ? 'Visible' : 'Hidden'}
            </span>
            <Switch
              checked={isPublic}
              disabled={visibility.disabled}
              onCheckedChange={(checked) =>
                visibility.onChange(checked ? 'public' : 'private')
              }
            />
          </div>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
  destructive,
}: {
  icon: typeof UserRound;
  title: string;
  subtitle?: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/50"
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          destructive
            ? 'bg-red-500/10 text-red-500'
            : 'bg-emerald/15 text-emerald-mint',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-[14px] font-semibold',
            destructive && 'text-red-500',
          )}
        >
          {title}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
      {!destructive && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

function ProfileSettings({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const settings = getProfileSettings(profile);
  const roleName = (profile.role as string | undefined) ?? 'participant';

  const [name, setName] = useState((profile.name as string) ?? '');
  const [org, setOrg] = useState(settings.org);
  const [phone, setPhone] = useState((profile.phone as string | undefined) ?? '');
  const [bio, setBio] = useState((profile.bio as string | undefined) ?? '');
  const [directoryVisible, setDirectoryVisible] = useState(
    settings.directoryVisible,
  );
  const [emailVisible, setEmailVisible] = useState(settings.emailVisible);
  const [phoneVisible, setPhoneVisible] = useState(settings.phoneVisible);
  const [bioVisible, setBioVisible] = useState(settings.bioVisible);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const next = getProfileSettings(profile);
    setName((profile.name as string) ?? '');
    setOrg(next.org);
    setPhone((profile.phone as string | undefined) ?? '');
    setBio((profile.bio as string | undefined) ?? '');
    setDirectoryVisible(next.directoryVisible);
    setEmailVisible(next.emailVisible);
    setPhoneVisible(next.phoneVisible);
    setBioVisible(next.bioVisible);
  }, [profile]);

  // Unsaved-changes tracking: compare form state against the saved profile.
  const isDirty =
    name !== ((profile.name as string) ?? '') ||
    org !== settings.org ||
    phone !== ((profile.phone as string | undefined) ?? '') ||
    bio !== ((profile.bio as string | undefined) ?? '') ||
    directoryVisible !== settings.directoryVisible ||
    emailVisible !== settings.emailVisible ||
    phoneVisible !== settings.phoneVisible ||
    bioVisible !== settings.bioVisible;

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Alert when leaving the page (unmount) with unsaved edits.
  useEffect(() => {
    return () => {
      if (isDirtyRef.current) {
        toast.error('You have unsaved profile changes', {
          description: 'Your edits were not saved.',
          classNames: {
            description: '!text-red-200',
          },
        });
      }
    };
  }, []);

  // Also warn on tab close / refresh with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const previewPerson = useMemo(
    () =>
      profileToPerson({
        ...profile,
        name: name.trim() || 'Summit User',
        phone,
        bio,
        org,
        directory_visible: directoryVisible,
        email_visible: emailVisible,
        phone_visible: phoneVisible,
        bio_visible: bioVisible,
      }),
    [
      profile,
      name,
      org,
      phone,
      bio,
      directoryVisible,
      emailVisible,
      phoneVisible,
      bioVisible,
    ],
  );

  const handleSave = async () => {
    if (name.trim().length === 0) {
      toast.error('Name is required.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfileSettings({
        name: name.trim(),
        org: org.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        directoryVisible,
        emailVisible,
        phoneVisible,
        bioVisible,
      });
      await onSaved();
      toast.success('Profile updated');
    } catch (error) {
      toast.error(`Could not save profile: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[43.2rem] space-y-5">
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Settings
      </button>

      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Profile
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit how you appear and choose what others can see in the directory.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Preview
        </p>
        {directoryVisible ? (
          <PersonCard
            person={previewPerson}
            viewerRoleName={roleName}
            showBio
          />
        ) : (
          <div className="glass flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center">
            <EyeOff className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-semibold">Hidden from directory</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Your profile is saved, but other Summit attendees won&apos;t see
              you in the directory until you turn listing back on.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <FieldCard title="Full name">
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl border-border/60 bg-background/60 pl-10"
            />
          </div>
        </FieldCard>

        <FieldCard title="Organization">
          <Input
            id="profile-org"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            placeholder="Emerald High School"
            className="h-11 rounded-xl border-border/60 bg-background/60"
          />
        </FieldCard>

        <FieldCard
          title="Phone"
          description="Show your phone number on your directory card."
          visibility={{
            value: phoneVisible,
            onChange: setPhoneVisible,
            disabled: !directoryVisible,
          }}
        >
          <Input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className="h-11 rounded-xl border-border/60 bg-background/60"
          />
        </FieldCard>

        <FieldCard
          title="Bio"
          description="Show your bio on your directory card."
          visibility={{
            value: bioVisible,
            onChange: setBioVisible,
            disabled: !directoryVisible,
          }}
        >
          <Textarea
            id="profile-bio"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A sentence or two about yourself."
            className="rounded-xl border-border/60 bg-background/60"
          />
        </FieldCard>

        <FieldCard
          title="Email"
          description="Show your email on your directory card."
          visibility={{
            value: emailVisible,
            onChange: setEmailVisible,
            disabled: !directoryVisible,
          }}
        >
          <p className="truncate rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-sm text-muted-foreground">
            {(profile.email as string | undefined) ?? ''}
          </p>
        </FieldCard>

        <FieldCard
          title="List me in the directory"
          description="Turn off to hide your profile for now."
          visibility={{
            value: directoryVisible ? 'public' : 'private',
            onChange: (v) => setDirectoryVisible(v === 'public'),
          }}
        />

        <Button
          className="glow-emerald mt-1 h-11 rounded-xl bg-primary font-semibold hover:bg-emerald"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </div>
  );
}

function SettingsHub({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const name = (profile.name as string | undefined) ?? 'Summit User';
  const email = (profile.email as string | undefined) ?? '';
  const roleName = (profile.role as string | undefined) ?? 'participant';
  const role = roleByName(roleName) ?? USER_ROLES[0];
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate('/home', { replace: true });
    } catch (error) {
      setSigningOut(false);
      toast.error(`Sign out failed: ${error}`);
    }
  };

  return (
    <div className="mx-auto max-w-[43.2rem] space-y-6">
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">
        <div className="border-b border-border/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Account
        </div>
        <SettingsRow
          icon={UserRound}
          title="Profile"
          subtitle={`${name} · ${role.label}${email ? ` · ${email}` : ''}`}
          onClick={() => navigate('/settings/profile')}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">
        <div className="border-b border-border/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Preferences
        </div>
        <div className="divide-y divide-border/60">
          <SettingsRow
            icon={Bell}
            title="Notifications"
            subtitle="Push and email preferences coming soon"
            onClick={() =>
              toast.message('Notifications settings coming soon')
            }
          />
          <SettingsRow
            icon={Info}
            title="About"
            subtitle="Emerald Summit ’27 · EHS Academic Foundation"
            onClick={() => toast.message('Emerald Summit companion app demo')}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">
        <SettingsRow
          icon={LogOut}
          title={signingOut ? 'Signing out…' : 'Sign out'}
          onClick={handleSignOut}
          destructive
        />
      </section>
    </div>
  );
}

export default function SettingsPage() {
  const { section } = useParams();
  const { ready, redirect } = useRequireProfile();
  const { profile, refreshProfile } = useAuth();

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready || profile == null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (section && section !== 'profile') {
    return <Navigate to="/settings" replace />;
  }

  const showingProfile = section === 'profile';

  return (
    <AppShell>
      {!showingProfile && (
        <>
          <PageHeader
            label="Emerald High School · Dublin, CA"
            title="Settings"
            sub="Manage your account, profile, and app preferences."
          />
          <div className="-mt-4 mb-8 border-t border-border/60" />
        </>
      )}
      {showingProfile ? (
        <ProfileSettings profile={profile} onSaved={refreshProfile} />
      ) : (
        <SettingsHub profile={profile} />
      )}
    </AppShell>
  );
}
