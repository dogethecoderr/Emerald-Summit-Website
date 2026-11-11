// Schools and grades of the people registered for one session (the app's
// session_metrics_view.dart). Experts are left out of "Everyone".
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Session } from '../../models/sessions';
import { compareGrades, countBy, crossTab, gradeLabel, NO_SCHOOL_LABEL, schoolLabel } from '../../models/metrics';
import { fetchSessionRoster, type RosterEntry } from '../../services/organizer';
import { BarList, FilterChips, HeatTable, MetricsSection, StatTiles } from '../MetricsBits';

type Who = 'all' | 'participating' | 'spectating';

export default function SessionMetrics({ session }: { session: Session }) {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState<Who>('all');

  const load = useCallback(() => {
    setError(null);
    fetchSessionRoster(session.id).then(setRoster).catch(() => setError("Couldn't load this session's metrics. Try again."));
  }, [session.id]);
  useEffect(load, [load]);

  if (error) {
    return (
      <div className="space-y-3 py-6 text-sm">
        <p role="alert" className="text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>Try again</Button>
      </div>
    );
  }
  if (!roster) return <Skeleton className="my-4 h-40 w-full" />;

  const people = roster.filter((e) =>
    who === 'all' ? e.type !== 'expert' : who === 'participating' ? e.type === 'participant' : e.type === 'spectator');
  const school = (e: RosterEntry) => schoolLabel(e.details.school);
  const grade = (e: RosterEntry) => gradeLabel(e.details.grade);
  const schools = new Set(people.map(school).filter((s) => s !== NO_SCHOOL_LABEL));
  const grades = [...new Set(people.map(grade))].sort(compareGrades);
  const empty = 'Nobody here has registered yet.';

  return (
    <div className="space-y-6 py-2">
      <FilterChips<Who>
        options={[['all', 'Everyone'], ['participating', 'Participating'], ['spectating', 'Spectating']]}
        selected={who}
        onSelect={setWho}
      />
      <StatTiles stats={[
        ['Registered', String(people.length)],
        ['Schools', String(schools.size)],
        ['Marked present', String(people.filter((e) => e.attended).length)],
      ]} />
      <MetricsSection title="By school">
        <BarList rows={countBy(people.map((e) => [school(e), e.userId]), { last: NO_SCHOOL_LABEL })} total={people.length} emptyText={empty} />
      </MetricsSection>
      <MetricsSection title="By grade">
        <BarList rows={countBy(people.map((e) => [grade(e), e.userId]), { compare: compareGrades })} total={people.length} emptyText={empty} />
      </MetricsSection>
      <MetricsSection title="Grades by school">
        <HeatTable
          table={crossTab(people.map((e) => [school(e), grade(e), e.userId]), grades, NO_SCHOOL_LABEL)}
          cornerLabel="School"
          emptyText={empty}
        />
      </MetricsSection>
    </div>
  );
}
