// Expert approvals for admins, ported from the app's
// expert_approvals_screen.dart. review_expert refuses anyone but an admin.
import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Mail, Phone } from '@/components/icons';
import { useRequireRole } from '../hooks/useRequireProfile';
import { useAuth } from '../context/AuthContext';
import { formatDeadline } from '../models/registration';
import { fetchExpertRequests, markExpertQueueSeen, reviewExpert, type ExpertRequest } from '../services/organizer';

export default function ExpertApprovalsPage() {
  const { ready, redirect } = useRequireRole(['admin']);
  const { refreshProfile } = useAuth();
  const [requests, setRequests] = useState<ExpertRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState<ExpertRequest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchExpertRequests().then(setRequests).catch(() => setError("Couldn't load the requests."));
  }, []);
  useEffect(() => {
    if (!ready) return;
    load();
    // Opening the queue clears the admin's badge, like opening Profile in the app.
    void markExpertQueueSeen().then(() => refreshProfile()).catch(() => {});
  }, [ready, load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) return <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;

  const review = async (r: ExpertRequest, approve: boolean) => {
    setDeclining(null);
    setBusy(r.userId);
    const name = r.fullName || r.email;
    try {
      const done = await reviewExpert(r.userId, approve);
      setRequests((list) => list?.filter((x) => x.userId !== r.userId) ?? list);
      toast(!done ? `${name} was already reviewed or changed roles.` : approve ? `Approved ${name}.` : `Declined ${name}.`);
    } catch {
      toast.error("Couldn't save that. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell>
      <PageHeader label="Admin" title="Expert approvals" />
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Expert accounts stay on a waiting screen until you approve them. Check that each person is who they say they are before approving.
        </p>
        {error ? (
          <div className="space-y-2 text-sm"><p role="alert" className="text-destructive">{error}</p><Button variant="outline" size="sm" onClick={load}>Try again</Button></div>
        ) : requests == null ? (
          <Skeleton className="h-32 w-full" />
        ) : requests.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No one is waiting for approval.</p>
        ) : requests.map((r) => (
          <article key={r.userId} className="rounded-2xl border border-border p-4">
            <h2 className="font-semibold">{r.fullName || 'No name given'}</h2>
            {r.expertise && <p className="text-sm text-emerald">{r.expertise}</p>}
            {r.bio && <p className="mt-1.5 text-sm">"{r.bio}"</p>}
            <p className="mt-1.5 flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /> {r.email}</p>
            {r.phone && <p className="mt-1 flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /> {r.phone}</p>}
            {r.requestedAt && <p className="mt-1.5 text-xs text-muted-foreground">Signed up {formatDeadline(new Date(r.requestedAt))}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" disabled={busy === r.userId} onClick={() => setDeclining(r)}>Decline</Button>
              <Button disabled={busy === r.userId} onClick={() => void review(r, true)} className="bg-emerald text-white hover:bg-emerald-deep"><Check className="h-4 w-4" /> Approve</Button>
            </div>
          </article>
        ))}
      </div>
      <Dialog open={declining != null} onOpenChange={(o) => !o && setDeclining(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline {declining?.fullName || declining?.email}?</DialogTitle>
            <DialogDescription>
              Their account becomes a participant account, and any sessions they signed up for as an expert are removed. They'll see a note saying their expert request was not approved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclining(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => declining && void review(declining, false)}>Decline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
