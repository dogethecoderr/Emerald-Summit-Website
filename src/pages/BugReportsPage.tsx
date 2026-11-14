// Admins: every bug report and piece of feedback (README: Bug reports).
// "Copy as Markdown" puts the whole ticket, attached data included, on the
// clipboard, ready to paste to whoever fixes it.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Bug, Copy, ImageIcon, MessageSquare, RefreshCw } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useRequireRole } from '../hooks/useRequireProfile';
import {
  fetchReports, reportAsMarkdown, screenshotUrls, setReportStatus,
  type BugReport, type ReportStatus,
} from '../services/bugReports';

type Filter = ReportStatus | 'all';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v : []);

function facts(report: BugReport): [string, string][] {
  const snap = obj(report.snapshot);
  const auth = obj(snap.auth);
  const profile = obj(snap.profile);
  const details = obj(profile.details);
  const client = obj(report.client);
  const device = obj(client.device);
  const build = obj(client.build);
  const pages = arr(client.route_history).map((r) => String(r.path)).slice(-6);
  return [
    ['Email', String(auth.email ?? '')],
    ['Role', [profile.role, profile.volunteer_subtype].filter(Boolean).join(' · ')],
    ['School / grade', [details.school, details.grade].filter(Boolean).join(' · ')],
    ['Sessions', String(arr(snap.registrations).length)],
    ['Managing', String(arr(snap.managing).length)],
    ['Pages before', pages.join(' → ')],
    ['Errors / failed requests', `${arr(client.errors).length} / ${arr(client.failed_requests).length}`],
    ['Device', `${device.viewport ?? '?'} · ${device.theme ?? '?'} · ${device.timezone ?? '?'}`],
    ['Browser', String(device.user_agent ?? '')],
    ['Build', [build.commit, build.built_at].filter(Boolean).join(' · ')],
  ].filter(([, v]) => v !== '') as [string, string][];
}

function Detail({ report, onStatus }: { report: BugReport; onStatus: (status: ReportStatus) => void }) {
  const [links, setLinks] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    setLinks([]);
    screenshotUrls(report.screenshots).then((l) => { if (live) setLinks(l); });
    return () => { live = false; };
  }, [report.id, report.screenshots]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportAsMarkdown(report, links));
      toast.success(`Copied #${report.ticket_no} as Markdown`);
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };

  return (
    <article className="space-y-5 rounded-2xl border border-border/70 bg-card/70 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {report.kind === 'feedback' ? 'Feedback' : 'Bug'} #{report.ticket_no} · {when(report.created_at)}
          </p>
          <h2 className="mt-1 break-words font-display text-xl font-semibold">{report.reporter_name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copy}><Copy className="h-4 w-4" /> Copy as Markdown</Button>
          {report.status === 'open'
            ? <Button size="sm" onClick={() => onStatus('resolved')} className="bg-emerald text-white hover:bg-emerald-deep">Mark resolved</Button>
            : <Button size="sm" variant="outline" onClick={() => onStatus('open')}>Reopen</Button>}
        </div>
      </header>

      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{report.description}</p>

      {report.screenshots.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {links.length === 0
            ? report.screenshots.map((p) => <Skeleton key={p} className="aspect-video rounded-lg" />)
            : links.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border">
                <img src={url} alt={`Screenshot ${i + 1}`} className="aspect-video w-full object-cover" />
              </a>
            ))}
        </div>
      )}

      <dl className="grid gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-[10rem_1fr]">
        {facts(report).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
        <dt className="text-muted-foreground">Email</dt>
        <dd>{report.email_error ? `Failed: ${report.email_error}` : report.emailed_at ? `Sent${report.email_copy ? ', with a copy to them' : ''}` : 'Not sent'}</dd>
      </dl>

      {[['From the browser', report.client], ['From the server (their account)', report.snapshot]].map(([title, data]) => (
        <details key={title as string} className="rounded-xl border border-border bg-secondary/40">
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">{title as string}</summary>
          <pre className="max-h-[28rem] overflow-auto px-3 pb-3 text-[11.5px] leading-relaxed">{JSON.stringify(data, null, 2)}</pre>
        </details>
      ))}
    </article>
  );
}

export default function BugReportsPage() {
  const { ready, redirect } = useRequireRole(['admin']);
  const [params, setParams] = useSearchParams();
  const [reports, setReports] = useState<BugReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('open');

  const load = useCallback(() => {
    setError(null);
    fetchReports().then(setReports).catch(() => setError("Couldn't load reports."));
  }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const shown = useMemo(() => (reports ?? []).filter((r) => filter === 'all' || r.status === filter), [reports, filter]);
  const ticket = Number(params.get('ticket'));
  const selected = (reports ?? []).find((r) => r.ticket_no === ticket) ?? shown[0] ?? null;

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) return <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;

  const changeStatus = async (report: BugReport, status: ReportStatus) => {
    try {
      await setReportStatus(report.id, status);
      setReports((all) => (all ?? []).map((r) => (r.id === report.id ? { ...r, status, resolved_at: status === 'resolved' ? new Date().toISOString() : null } : r)));
      toast.success(status === 'resolved' ? `#${report.ticket_no} marked resolved` : `#${report.ticket_no} reopened`);
    } catch {
      toast.error("Couldn't update the report.");
    }
  };

  const counts = { open: 0, resolved: 0, all: reports?.length ?? 0 };
  for (const r of reports ?? []) counts[r.status] += 1;

  return (
    <AppShell>
      <PageHeader label="Admin" title="Bug reports and feedback" actions={
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      } />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Filter reports">
        {(['open', 'resolved', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => { setFilter(f); setParams({}, { replace: true }); }}
            className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors', filter === f ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-accent/50')}
          >
            {f} <span className="opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!reports && !error && <Skeleton className="h-64 w-full rounded-2xl" />}
      {reports && shown.length === 0 && (
        <p className="rounded-2xl border border-border/70 bg-card/70 p-8 text-center text-sm text-muted-foreground">
          {filter === 'open' ? 'No open reports.' : 'Nothing here yet.'}
        </p>
      )}
      {reports && shown.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <ul className="space-y-2">
            {shown.map((r) => {
              const Icon = r.kind === 'feedback' ? MessageSquare : Bug;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setParams({ ticket: String(r.ticket_no) }, { replace: true })}
                    aria-current={selected?.id === r.id}
                    className={cn('w-full rounded-xl border p-3 text-left transition-colors', selected?.id === r.id ? 'border-emerald bg-emerald/10' : 'border-border/70 bg-card/70 hover:bg-accent/50')}
                  >
                    <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" /> #{r.ticket_no} · {when(r.created_at)}
                      {r.screenshots.length > 0 && <span className="ml-auto inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />{r.screenshots.length}</span>}
                    </span>
                    <span className="mt-1 block text-sm font-semibold">{r.reporter_name}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted-foreground">{r.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {selected && <Detail report={selected} onStatus={(s) => changeStatus(selected, s)} />}
        </div>
      )}
    </AppShell>
  );
}
