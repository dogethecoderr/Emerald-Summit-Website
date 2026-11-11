// After the summit, ported from the app's summit_followup_screen.dart:
// approved experts rate each session they served in, the summit and the app;
// volunteers and admins say whether they'd volunteer for EAF again. Both only
// open once fetch_summit_status says feedback is open, and the RPCs check it.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useRequireRole } from '../hooks/useRequireProfile';
import { useSchedule } from '../context/ScheduleContext';
import { MOCK_SESSIONS } from '../models/sessions';
import { useSummitStatus } from '../services/summitStatus';
import { useSummitContent } from '../services/summitContent';
import {
  fetchMyEafInterest,
  fetchMyFeedback,
  setEafInterest,
  submitFeedback,
  type ExpertFeedback,
  type FeedbackKind,
} from '../services/organizer';
import { cn } from '@/lib/utils';

interface Item {
  kind: FeedbackKind;
  sessionId: string | null;
  title: string;
  detail?: string;
  rating: number | null;
  comment: string;
}

export default function SummitFollowupPage() {
  useSummitContent();
  const { ready, redirect, roleName } = useRequireRole(['expert', 'volunteer', 'ambassador', 'admin']);
  const status = useSummitStatus();
  const { expertSchedule } = useSchedule();
  const navigate = useNavigate();
  const isExpert = roleName === 'expert';
  const [items, setItems] = useState<Item[] | null>(null);
  const [interest, setInterest] = useState<boolean | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (isExpert) {
      fetchMyFeedback().catch(() => [] as ExpertFeedback[]).then((saved) => {
        const find = (kind: FeedbackKind, id: string | null = null) => saved.find((f) => f.kind === kind && f.sessionId === id);
        const mine = MOCK_SESSIONS.filter((s) => expertSchedule.includes(s.id));
        setItems([
          ...mine.map((s) => ({ kind: 'session' as const, sessionId: s.id, title: s.title, detail: [s.disciplineName, s.time].filter(Boolean).join(' · '), rating: find('session', s.id)?.rating ?? null, comment: find('session', s.id)?.comment ?? '' })),
          { kind: 'summit', sessionId: null, title: 'The summit overall', rating: find('summit')?.rating ?? null, comment: find('summit')?.comment ?? '' },
          { kind: 'app', sessionId: null, title: 'The Emerald Summit app', rating: find('app')?.rating ?? null, comment: find('app')?.comment ?? '' },
        ]);
      });
    } else {
      fetchMyEafInterest().then(setInterest).catch(() => setInterest(null));
    }
  }, [ready, isExpert, expertSchedule.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) return <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;

  if (!status.feedbackOpen) {
    return (
      <AppShell>
        <PageHeader label="After the summit" title={isExpert ? 'Summit feedback' : 'Volunteer for EAF again?'} />
        <p className="mx-auto max-w-3xl text-sm text-muted-foreground">This opens after the last session of summit day ends.</p>
      </AppShell>
    );
  }

  const send = async () => {
    if (!items || items.some((i) => i.rating == null)) return setError('Pick a rating for each one.');
    setSaving(true);
    setError(null);
    try {
      await submitFeedback(items.map((i) => ({ kind: i.kind, sessionId: i.sessionId, rating: i.rating!, comment: i.comment.trim() })));
      toast.success('Thanks for your feedback.');
      navigate('/account');
    } catch {
      setError("Couldn't send your feedback. Check your connection and try again.");
      setSaving(false);
    }
  };

  const answer = async (yes: boolean) => {
    try {
      await setEafInterest(yes);
      setInterest(yes);
      toast.success('Thanks, your answer is saved.');
    } catch {
      toast.error("Couldn't save your answer. Try again.");
    }
  };

  if (!isExpert) {
    return (
      <AppShell>
        <PageHeader label="After the summit" title="Thank you for volunteering" />
        <div className="mx-auto max-w-3xl space-y-4">
          <p>Would you like to volunteer for EAF in the future?</p>
          {interest !== undefined && interest !== null && (
            <p className="text-sm text-muted-foreground">You said {interest ? 'yes' : 'no'}. You can change your answer.</p>
          )}
          <div className="flex gap-2">
            <Button variant={interest === false ? 'default' : 'outline'} onClick={() => void answer(false)}>No</Button>
            <Button variant={interest === true ? 'default' : 'outline'} onClick={() => void answer(true)}>Yes</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader label="After the summit" title="Summit feedback" />
      <div className="mx-auto max-w-3xl space-y-5">
        <p className="text-sm text-muted-foreground">
          Thank you for serving as an expert. Rate each one from 1 to 5 and add a comment if you like. Your feedback on your session goes on the volunteer hours record of the students who ran it.
        </p>
        {items == null ? <Skeleton className="h-40 w-full" /> : items.map((item, idx) => (
          <section key={`${item.kind}-${item.sessionId ?? ''}`} className="space-y-3 rounded-2xl border border-border p-4">
            {item.kind === 'session' && <p className="text-xs font-semibold uppercase tracking-wide text-emerald">Your session</p>}
            <h2 className="font-semibold">{item.title}</h2>
            {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
            <div role="radiogroup" aria-label={`Rating for ${item.title}`} className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={item.rating === n}
                  aria-label={`${n} of 5 for ${item.title}`}
                  onClick={() => setItems((list) => list!.map((x, i) => (i === idx ? { ...x, rating: n } : x)))}
                  className={cn('text-3xl leading-none transition-transform hover:scale-110', (item.rating ?? 0) >= n ? 'text-emerald' : 'text-muted-foreground/40')}
                >
                  ★
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`comment-${idx}`}>Comment (optional)</Label>
              <Textarea id={`comment-${idx}`} rows={2} value={item.comment} onChange={(e) => setItems((list) => list!.map((x, i) => (i === idx ? { ...x, comment: e.target.value } : x)))} />
            </div>
          </section>
        ))}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button disabled={saving || items == null} onClick={() => void send()} className="bg-emerald text-white hover:bg-emerald-deep">{saving ? 'Sending…' : 'Send feedback'}</Button>
      </div>
    </AppShell>
  );
}
