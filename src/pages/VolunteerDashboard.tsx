// "Sessions I'm managing", ported from the app's my_assignments_screen.dart:
// the sessions an admin assigned this volunteer to, each opening its session
// page for the roster and attendance. Front-desk check-in isn't on the
// website: it scans QR passes with the phone's camera, so it's only in the
// mobile app (Profile shows it as app-only).
import { Link, Navigate } from 'react-router-dom';
import { useSchedule } from '../context/ScheduleContext';
import { MOCK_SESSIONS } from '../models/sessions';
import { toMinutes, useSummitContent } from '../services/summitContent';
import { CalendarDays, ChevronRight } from '@/components/icons';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { useRequireRole } from '../hooks/useRequireProfile';
import { Skeleton } from '@/components/ui/skeleton';

export default function VolunteerDashboard() {
  // Like the app, this is a volunteer's own list; admins assign, they aren't assigned.
  const { ready, redirect } = useRequireRole(['volunteer', 'ambassador']);
  const { volunteerSchedule = [] } = useSchedule();
  useSummitContent();

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const managed = MOCK_SESSIONS
    .filter((m) => volunteerSchedule.includes(m.id))
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

  return (
    <AppShell>
      <PageHeader label="Volunteering" title="Sessions I'm managing" />
      <section className="glass mx-auto max-w-3xl rounded-2xl p-2 sm:p-4">
        {managed.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            You're not assigned to any sessions yet. An admin assigns volunteers to sessions. Once you are, they show up here with their rosters.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {managed.map((m) => (
              <li key={m.id}>
                <Link to={`/sessions/${m.id}`} className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent/40">
                  <CalendarDays className="h-5 w-5 shrink-0 text-emerald" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">{[m.time, m.room || 'Unassigned room'].join(' · ')}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
