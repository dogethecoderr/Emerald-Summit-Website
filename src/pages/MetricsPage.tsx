// Summit-wide metrics for admins, ported from the app's metrics_screen.dart.
// fetch_summit_metrics returns no names or contact details, and only to admins.
import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRequireRole } from '../hooks/useRequireProfile';
import { USER_DISCIPLINES } from '../models/disciplines';
import { compareGrades, countBy, crossTab, NO_SCHOOL_LABEL, type SummitMetrics } from '../models/metrics';
import { fetchSummitMetrics } from '../services/organizer';
import { BarList, FilterChips, HeatTable, MetricsSection, StatTiles } from '../components/MetricsBits';

type Who = 'participants' | 'parents' | 'everyone';
const NOUN: Record<Who, string> = { participants: 'participants', parents: 'parents or spectators', everyone: 'people' };

export default function MetricsPage() {
  const { ready, redirect } = useRequireRole(['admin']);
  const [data, setData] = useState<SummitMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState<Who>('participants');

  const load = useCallback(() => {
    setError(null);
    fetchSummitMetrics().then(setData).catch(() => setError("Couldn't load metrics. Try again."));
  }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) return <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;

  return (
    <AppShell>
      <PageHeader label="Admin" title="Metrics" />
      <div className="mx-auto max-w-4xl space-y-6">
        <FilterChips<Who>
          options={[['participants', 'Participants'], ['parents', 'Parents & spectators'], ['everyone', 'Everyone']]}
          selected={who}
          onSelect={setWho}
        />
        {error ? (
          <div className="space-y-2 text-sm"><p role="alert" className="text-destructive">{error}</p><Button variant="outline" size="sm" onClick={load}>Try again</Button></div>
        ) : data == null ? (
          <Skeleton className="h-64 w-full" />
        ) : <Charts data={data} who={who} />}
      </div>
    </AppShell>
  );
}

function Charts({ data, who }: { data: SummitMetrics; who: Who }) {
  const noun = NOUN[who];
  const people = data.people.filter((p) =>
    who === 'participants' ? p.role === 'participant' : who === 'parents' ? p.role === 'parentSpectator' : true);
  const byId = new Map(people.map((p) => [p.id, p]));
  // Experts leading a session aren't showing interest in it.
  const regs = data.registrations.filter((r) => byId.has(r.userId) && r.type !== 'expert');
  const inSessions = new Set(regs.map((r) => r.userId));
  const schools = new Set(people.map((p) => p.school).filter((s) => s !== NO_SCHOOL_LABEL));
  const grades = [...new Set(people.map((p) => p.grade))].sort(compareGrades);
  return (
    <div className="space-y-8">
      <StatTiles stats={[
        ['Signed up', String(people.length)],
        ['Schools', String(schools.size)],
        ['In a session', String(inSessions.size)],
        ['Session sign-ups', String(regs.length)],
      ]} />
      <MetricsSection title="Sign-ups by school">
        <p className="-mt-2 text-xs text-muted-foreground">Accounts that finished sign-up, by the school they picked.</p>
        <BarList rows={countBy(people.map((p) => [p.school, p.id]), { last: NO_SCHOOL_LABEL })} total={people.length} emptyText={`No ${noun} have signed up yet.`} />
      </MetricsSection>
      <MetricsSection title="Disciplines by school">
        <p className="-mt-2 text-xs text-muted-foreground">
          People from each school registered for at least one session in a discipline. Someone in two Tech sessions counts once under Tech, so a row total can be less than its cells added up.
        </p>
        <HeatTable
          table={crossTab(regs.map((r) => [byId.get(r.userId)!.school, r.disciplineName, r.userId]), USER_DISCIPLINES.map((d) => d.label), NO_SCHOOL_LABEL)}
          cornerLabel="School"
          emptyText={`No ${noun} have registered for a session yet.`}
        />
      </MetricsSection>
      <MetricsSection title="Interest by discipline">
        <p className="-mt-2 text-xs text-muted-foreground">People registered for at least one session in each.</p>
        <BarList rows={countBy(regs.map((r) => [r.disciplineName, r.userId]))} total={inSessions.size} emptyText={`No ${noun} have registered for a session yet.`} />
      </MetricsSection>
      {who !== 'parents' && (
        <>
          <MetricsSection title="Grades by school">
            <p className="-mt-2 text-xs text-muted-foreground">Everyone who signed up, by school and grade.</p>
            <HeatTable table={crossTab(people.map((p) => [p.school, p.grade, p.id]), grades, NO_SCHOOL_LABEL)} cornerLabel="School" emptyText={`No ${noun} have signed up yet.`} />
          </MetricsSection>
          <MetricsSection title="Sign-ups by grade">
            <BarList rows={countBy(people.map((p) => [p.grade, p.id]), { compare: compareGrades })} total={people.length} emptyText={`No ${noun} have signed up yet.`} />
          </MetricsSection>
        </>
      )}
    </div>
  );
}
