// Ports of the app's ExpertPendingScreen and its one-time "expert request
// wasn't approved" dialog (lib/screens/auth/expert_pending_screen.dart and
// auth_gate.dart). Same words as the app.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Mail, RefreshCw } from '@/components/icons';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { acknowledgeExpertDecline, fetchExpertStatus, signOut } from '../services/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const EXPERT_CONTACT_EMAIL = 'nysha.singhal@ehsacademics.org';

/** The app's needsExpertApproval: an onboarded expert not yet approved. */
export function needsExpertApproval(profile: { role?: string; profile_setup_complete?: boolean; expert_status?: string | null } | null): boolean {
  return profile != null && profile.profile_setup_complete === true
    && profile.role === 'expert' && profile.expert_status !== 'approved';
}

export function ExpertPending() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const expertise = String((profile?.details as Record<string, unknown> | undefined)?.expertise ?? '').trim();

  const checkAgain = async () => {
    setChecking(true);
    try {
      const status = await fetchExpertStatus();
      if (status === 'approved') await refreshProfile();
      else toast('Not approved yet.');
    } catch {
      toast.error("Couldn't check right now. Try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="glass mx-auto max-w-xl rounded-3xl p-8">
      <h1 className="font-display text-2xl font-bold">Your expert account is awaiting approval</h1>
      <p className="mt-3 text-muted-foreground">
        An admin checks every expert sign-up to make sure the person is who they say they are.
        You'll be able to use the app as soon as your account is approved.
      </p>
      {profile?.name && (
        <div className="mt-5 rounded-xl border border-border bg-card px-4 py-3">
          <div className="font-semibold">{profile.name}</div>
          {expertise && <div className="text-sm text-muted-foreground">{expertise}</div>}
        </div>
      )}
      <p className="mt-5 text-sm text-muted-foreground">If your account isn't approved within 48 hours, email us at:</p>
      <a href={`mailto:${EXPERT_CONTACT_EMAIL}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald hover:underline">
        <Mail className="h-4 w-4" /> {EXPERT_CONTACT_EMAIL}
      </a>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={checkAgain} disabled={checking} className="gap-2">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Check again
        </Button>
        <Button variant="outline" disabled={checking} onClick={() => navigate('/roles')}>Sign up as something else</Button>
        <Button variant="ghost" disabled={checking} onClick={() => void signOut()}>Sign out</Button>
      </div>
    </section>
  );
}

/** Shown once after an admin declines; OK clears it with acknowledge_expert_decline. */
export function ExpertDeclinedDialog() {
  const { profile, refreshProfile } = useAuth();
  const declined = profile?.expert_status === 'declined';
  const [open, setOpen] = useState(false);
  useEffect(() => { if (declined) setOpen(true); }, [declined]);

  const close = async () => {
    setOpen(false);
    try {
      await acknowledgeExpertDecline();
      await refreshProfile();
    } catch {
      // Shown again on the next visit; nothing else depends on it.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) void close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your expert request wasn't approved</DialogTitle>
          <DialogDescription>
            An admin reviewed your sign-up and did not approve it as an expert account, so your
            account is now a participant account. If you think this is a mistake, email {EXPERT_CONTACT_EMAIL}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => void close()}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
