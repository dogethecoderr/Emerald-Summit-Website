import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftRight, Award, Bug, CalendarDays, ChartLine, ChevronLeft, ChevronRight, Clock, HeartHandshake, LogOut, MapPin,
  MessageSquare, Palette, QrCode, ScanLine, ShieldCheck, UserRound, Users, Inbox,
} from '@/components/icons';
import { useSummitStatus } from '../services/summitStatus';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import QrPassModal from '../components/QrPassModal';
import ReportDialog from '../components/ReportDialog';
import type { ReportKind } from '../services/bugReports';
import ThemeToggle from '../components/ThemeToggle';
import { useRequireProfile } from '../hooks/useRequireProfile';
import { useAuth } from '../context/AuthContext';
import { roleByName, roleLabelFor, USER_ROLES } from '../models/roles';
import { saveProfileDetails, signOut, type Profile } from '../services/auth';
import { formFields } from '../models/profileFields';
import ProfileFieldInput from '../components/ProfileFieldInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

/** A menu row for something only the mobile app can do: shown, not clickable. */
function AppOnlyRow({ icon: Icon, title, subtitle }: { icon: typeof UserRound; title: string; subtitle: string }) {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-muted-foreground">{title}</span>
        <span className="mt-0.5 block text-[12px] text-muted-foreground">{subtitle}</span>
      </span>
      <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">Mobile app only</span>
    </div>
  );
}

function ProfileSettings({ profile, onSaved }: { profile: Profile; onSaved: () => Promise<void> }) {
  const navigate = useNavigate();
  // The same questions the account answered at sign-up, like the app's Edit profile.
  const fields = formFields(profile.role, profile.volunteer_subtype);
  const detailsOf = (p: Profile) => Object.fromEntries(
    Object.entries((p.details ?? {}) as Record<string, unknown>).map(([k, v]) => [k, v == null ? '' : String(v)]),
  );
  const [name, setName] = useState(profile.name ?? '');
  const [answers, setAnswers] = useState<Record<string, string>>(() => detailsOf(profile));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(profile.name ?? '');
    setAnswers(detailsOf(profile));
  }, [profile]);

  const saved = detailsOf(profile);
  const isDirty = name !== (profile.name ?? '') || fields.some((f) => (answers[f.key] ?? '') !== (saved[f.key] ?? ''));
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
    const missing = fields.find((f) => f.required && !(answers[f.key] ?? '').trim());
    if (missing) {
      toast.error(missing.key === 'phone' ? 'Mobile number is required.' : `Please answer "${missing.label}".`);
      return;
    }
    setIsSaving(true);
    try {
      await saveProfileDetails(name, Object.fromEntries(fields.map((f) => [f.key, answers[f.key] ?? ''])), false);
      await onSaved();
      isDirtyRef.current = false;
      toast.success('Profile updated');
    } catch {
      toast.error('Could not save your profile. Please try again.');
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
        {fields.map((f) => (
          <ProfileFieldInput key={f.key} field={f} value={answers[f.key] ?? ''} onChange={(v) => setAnswers((a) => ({ ...a, [f.key]: v }))} />
        ))}
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" type="email" value={profile.email} readOnly />
        </div>
        <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save profile'}</Button>
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
  const [reportKind, setReportKind] = useState<ReportKind | null>(null);
  const lastReportKind = useRef<ReportKind>('bug');
  if (reportKind) lastReportKind.current = reportKind;
  const canOpenVolunteerHub = ['volunteer', 'ambassador', 'admin'].includes(roleName);
  const isAdmin = roleName === 'admin';
  const isVolunteer = roleName === 'volunteer' || roleName === 'ambassador';
  const canCheckIn = isAdmin || profile.can_check_in_front_desk === true;
  const status = useSummitStatus();

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
        <div className="divide-y divide-border/60">
          <SettingsRow icon={Bug} title="Report a bug" subtitle="Something broken? Tell us, with screenshots" onClick={() => setReportKind('bug')} />
          <SettingsRow icon={MessageSquare} title="Send feedback" subtitle="Ideas, likes, or something confusing" onClick={() => setReportKind('feedback')} />
        </div>
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
          {isVolunteer && <SettingsRow icon={CalendarDays} title="Sessions I'm managing" subtitle="Take attendance for sessions you run" onClick={() => navigate('/volunteer')} />}
          {status.feedbackOpen && roleName === 'expert' && <SettingsRow icon={Award} title="Summit feedback" subtitle="Rate your sessions, the summit and the app" onClick={() => navigate('/follow-up')} />}
          {status.feedbackOpen && (isVolunteer || isAdmin) && <SettingsRow icon={HeartHandshake} title="Volunteer for EAF again?" subtitle="Let us know" onClick={() => navigate('/follow-up')} />}
          {(isVolunteer || isAdmin) && <SettingsRow icon={Clock} title="Track volunteer hours" subtitle="Your logged hours and summit-day hours" onClick={() => navigate('/volunteer/hours')} />}
          {canOpenVolunteerHub && <SettingsRow icon={Users} title="Volunteer hub" subtitle="Volunteers, admins, and how to reach them" onClick={() => navigate('/volunteer/contacts')} />}
          {canCheckIn && <AppOnlyRow icon={ScanLine} title="Front desk check-in" subtitle="Scanning QR passes needs the phone camera, so check people in from the Emerald Summit app." />}
          {isAdmin && <SettingsRow icon={ChartLine} title="Metrics" subtitle="Who signed up, from which schools, for what" onClick={() => navigate('/admin/metrics')} />}
          {isAdmin && <SettingsRow icon={ShieldCheck} title="Expert approvals" subtitle="Approve or decline expert sign-ups" onClick={() => navigate('/admin/experts')} />}
          {isAdmin && <SettingsRow icon={Inbox} title="Bug reports and feedback" subtitle="What people reported, with their details" onClick={() => navigate('/admin/reports')} />}
          {isAdmin && <SettingsRow icon={MapPin} title="Manage rooms" subtitle="The rooms sessions can be held in" onClick={() => navigate('/admin/rooms')} />}
          <SettingsRow icon={ArrowLeftRight} title="Change role" subtitle={`Currently ${roleLabel}`} onClick={() => navigate('/roles')} />
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">
        <SettingsRow icon={LogOut} title={signingOut ? 'Signing out…' : 'Sign out'} onClick={handleSignOut} destructive />
      </section>
      <QrPassModal open={qrPassOpen} onOpenChange={setQrPassOpen} profile={profile} />
      <ReportDialog open={reportKind !== null} onOpenChange={(o) => { if (!o) setReportKind(null); }} kind={reportKind ?? lastReportKind.current} defaultName={profile.name ?? ''} email={profile.email} />
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
      {!section && <><PageHeader label="Emerald High School, Dublin, CA" title="Profile" /><div className="-mt-4 mb-8 border-t border-border/60" /></>}
      {section ? <ProfileSettings profile={profile} onSaved={refreshProfile} /> : <ProfileHub profile={profile} />}
    </AppShell>
  );
}
