import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Search,
  UserCheck,
  UserX,
  Users,
  AlertCircle,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import TrackPill from '../components/TrackPill';
import { useRequireRole } from '../hooks/useRequireProfile';
import { MOCK_PEOPLE, type Person } from '../models/people';
import { disciplineByName } from '../models/disciplines';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface VolunteerDashboardProps {
  assignedTrack?: string | null;
  participants?: Person[] | null;
}

export default function VolunteerDashboard({
  assignedTrack = 'novasphere',
  participants: customParticipants,
}: VolunteerDashboardProps) {
  const { ready, redirect } = useRequireRole(['volunteer']);

  // Initial roster defaults to mock participants if custom list not provided
  const initialRoster = customParticipants !== undefined
    ? customParticipants
    : MOCK_PEOPLE.filter(
        (p) => p.role === 'participant' || p.role === 'attendee',
      );

  const [roster, setRoster] = useState<Person[]>(initialRoster ?? []);
  const [filter, setFilter] = useState<'all' | 'checkedIn' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const trackInfo = assignedTrack ? disciplineByName(assignedTrack) : undefined;

  const toggleCheckIn = (personId: string) => {
    setRoster((prev) =>
      prev.map((p) => {
        if (p.id === personId) {
          const nextStatus = p.status === 'checkedIn' ? 'validated' : 'checkedIn';
          return { ...p, status: nextStatus };
        }
        return p;
      }),
    );
  };

  const filteredRoster = (roster ?? []).filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.org.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filter === 'checkedIn') return p.status === 'checkedIn';
    if (filter === 'pending') return p.status !== 'checkedIn';
    return true;
  });

  const checkedInCount = (roster ?? []).filter((p) => p.status === 'checkedIn').length;
  const totalCount = (roster ?? []).length;

  return (
    <AppShell>
      <PageHeader
        label="Volunteer Dashboard"
        title="Volunteer Hub & Track Management"
        sub="Manage your assigned track, review participant check-ins, and support Summit attendees."
      />

      <div className="space-y-6">
        {/* Track Banner */}
        <section className="glass rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-bold tracking-tight">
                  Assigned Track
                </h2>
                {assignedTrack && <TrackPill track={assignedTrack} />}
              </div>
              {trackInfo ? (
                <p className="text-sm text-muted-foreground">
                  {trackInfo.description}
                </p>
              ) : (
                <div className="flex items-center gap-2 text-sm text-amber-500 font-medium">
                  <AlertCircle className="h-4 w-4" />
                  <span>No assigned track found</span>
                </div>
              )}
            </div>
            {assignedTrack && (
              <div className="flex items-center gap-4 rounded-xl bg-accent/40 px-4 py-2.5 text-xs">
                <div className="text-center">
                  <span className="block font-bold text-foreground text-sm">
                    {checkedInCount} / {totalCount}
                  </span>
                  <span className="text-muted-foreground">Checked In</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Participant Management Tools */}
        <section className="glass rounded-2xl p-6 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-mint" />
              <h2 className="font-display text-lg font-semibold">
                Participant Roster
              </h2>
              <span className="rounded-full bg-emerald/15 px-2.5 py-0.5 text-xs font-bold text-emerald-mint">
                {totalCount} Total
              </span>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search participants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-lg border border-border bg-background/50 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-glow"
                />
              </div>

              <div className="flex rounded-lg bg-accent/50 p-1 text-xs">
                <button
                  onClick={() => setFilter('all')}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-medium transition-colors',
                    filter === 'all'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  All ({totalCount})
                </button>
                <button
                  onClick={() => setFilter('checkedIn')}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-medium transition-colors',
                    filter === 'checkedIn'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Checked In ({checkedInCount})
                </button>
                <button
                  onClick={() => setFilter('pending')}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-medium transition-colors',
                    filter === 'pending'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Pending ({totalCount - checkedInCount})
                </button>
              </div>
            </div>
          </div>

          {/* Participant List or Empty State */}
          {!assignedTrack ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-2 font-display text-base font-semibold">
                No assigned track
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Please contact the Summit coordinator to assign a track to your volunteer account.
              </p>
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-2 font-display text-base font-semibold">
                No participants assigned to this track
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery || filter !== 'all'
                  ? 'No participants match your current search or filter criteria.'
                  : 'There are currently no participants listed under this assigned track.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRoster.map((p) => {
                const isCheckedIn = p.status === 'checkedIn';
                return (
                  <div
                    key={p.id}
                    className="glass flex flex-col justify-between rounded-xl p-4 transition-colors hover:border-emerald-glow/40"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald text-xs font-bold text-white"
                        aria-hidden
                      >
                        {p.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold text-sm">
                            {p.name}
                          </span>
                          {isCheckedIn && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-glow" />
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p.org}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                              isCheckedIn
                                ? 'bg-emerald/15 text-emerald-mint'
                                : 'bg-amber-500/15 text-amber-400',
                            )}
                          >
                            {isCheckedIn ? (
                              <>
                                <UserCheck className="h-3 w-3" /> Checked In
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3" /> Arriving Soon
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        Status: <strong className="text-foreground">{isCheckedIn ? 'Checked In' : 'Pending'}</strong>
                      </span>
                      <button
                        onClick={() => toggleCheckIn(p.id)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                          isCheckedIn
                            ? 'bg-secondary text-muted-foreground hover:bg-destructive/15 hover:text-destructive'
                            : 'bg-emerald text-white hover:bg-emerald-deep',
                        )}
                      >
                        {isCheckedIn ? (
                          <>
                            <UserX className="h-3 w-3" /> Undo Check-in
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3 w-3" /> Check In
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
