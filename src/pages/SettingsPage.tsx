import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Bell, ChevronLeft, ChevronRight, Info, LogOut, Palette, QrCode, UserRound, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import QrPassModal from '../components/QrPassModal';
import ThemeToggle from '../components/ThemeToggle';
import { useRequireProfile } from '../hooks/useRequireProfile';
import { useAuth } from '../context/AuthContext';
import { roleByName, roleLabelFor, USER_ROLES } from '../models/roles';
import { signOut, updateProfileSettings, type Profile } from '../services/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function SettingsRow({ icon: Icon, title, subtitle, onClick, destructive }: {
  icon: typeof UserRound;
  title: string;
  subtitle?: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/50">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', destructive ? 'bg-red-500/10 text-red-500' : 'bg-emerald/15 text-emerald-mint')}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[14px] font-semibold', destructive && 'text-red-500')}>{title}</span>
        {subtitle && <span className="mt-0.5 block text-[12px] text-muted-foreground">{subtitle}</span>}
      </span>
      {!destructive && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </button>
  );
}

function ProfileSettings({ profile, onSaved }: { profile: Profile; onSaved: () => Promise<void> }) {
  const navigate = useNavigate();
  const [name, setName] = useState(profile.name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const requiresPhone = ['volunteer', 'ambassador', 'admin'].includes(profile.role ?? '');

  useEffect(() => {
    setName(profile.name ?? '');
    setPhone(profile.phone ?? '');
    setBio(profile.bio ?? '');
  }, [profile]);

  const isDirty = name !== (profile.name ?? '') || phone !== (profile.phone ?? '') || bio !== (profile.bio ?? '');
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (isDirtyRef.current) toast.error('You have unsaved profile changes', { description: 'Your edits were not saved.' });
    };
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (requiresPhone && !phone.trim()) {
      toast.error('Phone is required for volunteers and admins.');
      return;
    }
    setIsSaving(true);
    try {
      await updateProfileSettings({ name: name.trim(), phone: phone.trim(), bio: bio.trim() });
      await onSaved();
      isDirtyRef.current = false;
      toast.success('Profile updated');
    } catch (error) {
      toast.error(`Could not save profile: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[43.2rem] space-y-5">
      <button type="button" onClick={() => navigate('/account')} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Profile
      </button>
      <h2 className="font-display text-2xl font-semibold tracking-tight">Edit profile</h2>
      <div className="space-y-4 rounded-2xl border border-border/70 bg-card/70 p-5">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Full name</Label>
          <Input id="profile-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-phone">Phone</Label>
          <Input id="profile-phone" type="tel" autoComplete="tel" required={requiresPhone} aria-describedby={requiresPhone ? 'profile-phone-sharing-note' : undefined} value={phone} onChange={(e) => setPhone(e.target.value)} />
          {requiresPhone && <p id="profile-phone-sharing-note" className="text-xs text-muted-foreground">Your phone number is shared with other volunteers and admins for Summit-day coordination.</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-bio">Bio</Label>
          <Textarea id="profile-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" type="email" value={profile.email} readOnly />
        </div>
        <Button onClick={handleSave} disabled={isSaving || (requiresPhone && !phone.trim())}>{isSaving ? 'Saving…' : 'Save profile'}</Button>
      </div>
    </div>
  );
}

function ProfileHub({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const roleName = profile.role ?? 'participant';
  const role = roleByName(roleName) ?? USER_ROLES[0];
  const roleLabel = roleLabelFor(roleName, profile.volunteer_subtype);
  const [signingOut, setSigningOut] = useState(false);
  const [qrPassOpen, setQrPassOpen] = useState(false);
  const canOpenVolunteerHub = ['volunteer', 'ambassador', 'admin'].includes(roleName);

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
      <section className="rounded-2xl border border-border/70 bg-card/70 p-5">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white" style={{ background: role.color }}><UserRound className="h-7 w-7" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="break-words font-display text-xl font-semibold">{profile.name || 'Summit User'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{roleLabel}</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">
        <SettingsRow icon={QrCode} title="My QR Pass" subtitle="Show your pass at the front desk" onClick={() => setQrPassOpen(true)} />
      </section>
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">
        <div className="border-b border-border/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Settings</div>
        <div className="divide-y divide-border/60">
          <SettingsRow icon={UserRound} title="Edit profile" subtitle="Your name and contact details" onClick={() => navigate('/account/edit')} />
          <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald/15 text-emerald-mint dark:text-primary"><Palette className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">Appearance</span><span className="mt-0.5 block text-[12px] text-muted-foreground">System is dark from 7 PM to 7 AM</span></span>
            <ThemeToggle labels />
          </div>
          <SettingsRow icon={Bell} title="Notifications" subtitle="Push and email preferences coming soon" onClick={() => toast.message('Notifications settings coming soon')} />
          {canOpenVolunteerHub && <SettingsRow icon={Users} title="Volunteer hub" subtitle="Reach other volunteers and admins" onClick={() => navigate('/volunteer/contacts')} />}
          <SettingsRow icon={Info} title="About" subtitle="Emerald Summit ’27 · EHS Academic Foundation" onClick={() => toast.message('Emerald Summit companion app')} />
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">
        <SettingsRow icon={LogOut} title={signingOut ? 'Signing out…' : 'Sign out'} onClick={handleSignOut} destructive />
      </section>
      <QrPassModal open={qrPassOpen} onOpenChange={setQrPassOpen} profile={profile} />
    </div>
  );
}

export default function SettingsPage() {
  const { section } = useParams();
  const { ready, redirect } = useRequireProfile({ allowPendingExpert: true });
  const { profile, refreshProfile } = useAuth();
  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready || profile == null) return <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (section && section !== 'edit' && section !== 'profile') return <Navigate to="/account" replace />;
  return (
    <AppShell>
      {!section && <><PageHeader label="Emerald High School · Dublin, CA" title="Profile" /><div className="-mt-4 mb-8 border-t border-border/60" /></>}
      {section ? <ProfileSettings profile={profile} onSaved={refreshProfile} /> : <ProfileHub profile={profile} />}
    </AppShell>
  );
}
