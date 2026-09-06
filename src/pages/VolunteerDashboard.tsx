import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Bot,
  CheckCircle2,
  Clock,
  Dna,
  Lightbulb,
  MapPin,
  Rocket,
  Search,
  Sun,
  Sunset,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  AlertCircle,
  QrCode,
  type LucideIcon,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import TrackPill from '../components/TrackPill';
import VolunteerQrScannerModal from '../components/VolunteerQrScannerModal';
import { useRequireRole } from '../hooks/useRequireProfile';
import { MOCK_PEOPLE, type Person } from '../models/people';
import { disciplineByName } from '../models/disciplines';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  VOLUNTEER_TRACKS,
  volunteerTrackById,
  type VolunteerShift,
  type VolunteerTrackId,
} from '../models/volunteerSchedule';

export interface VolunteerDashboardProps {
  assignedTrack?: string | null;
  participants?: Person[] | null;
}

const TRACK_ICONS: Record<VolunteerTrackId, LucideIcon> = {
  techverse: Bot,
  biosphere: Dna,
  imaginex: Lightbulb,
  novasphere: Rocket,
  ventureverse: TrendingUp,
};

const SHIFT_OPTIONS: Array<{
  id: VolunteerShift;
  label: string;
  time: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: 'morning',
    label: 'Morning shift',
    time: '7:30 AM – 11:30 AM',
    description: 'Setup, check-in, opening activities, and the first sessions.',
    icon: Sun,
  },
  {
    id: 'afternoon',
    label: 'Afternoon shift',
    time: '11:30 AM – 3:00 PM',
    description: 'Midday sessions, closing, cleanup, and guest support.',
    icon: Sunset,
  },
];

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
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isShiftDialogOpen, setIsShiftDialogOpen] = useState(false);
  const [volunteerShift, setVolunteerShift] = useState<VolunteerShift | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<VolunteerTrackId>(
    () => volunteerTrackById(assignedTrack)?.id ?? 'techverse',
  );

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
  const selectedTrack = volunteerTrackById(selectedTrackId) ?? VOLUNTEER_TRACKS[0];
  const selectedShift = SHIFT_OPTIONS.find((shift) => shift.id === volunteerShift);

  const handleCheckInSuccess = (user: { id: string; name: string; checked_in_at?: string | null }) => {
    setRoster((prev) =>
      prev.map((p) => {
        if (p.id === user.id || p.name.toLowerCase() === user.name.toLowerCase()) {
          return { ...p, status: 'checkedIn' };
        }
        return p;
      }),
    );
  };

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
        {/* Color-coded volunteer schedule: swapping tracks stays on this page. */}
        <section className="overflow-hidden rounded-2xl border border-emerald-glow/20 bg-gradient-to-br from-emerald-deep to-emerald p-6 text-white shadow-lg shadow-emerald/10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
                Your Summit shift
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
                Find your verse. Make it happen.
              </h2>
              <p className="mt-1.5 max-w-xl text-sm text-white/80">
                Preview every volunteer track without leaving the hub, then choose the time that works for you.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsShiftDialogOpen(true)}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-deep shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-emerald"
            >
              {selectedShift ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              {selectedShift
                ? `${selectedShift.label} · ${selectedShift.time}`
                : 'Choose morning or afternoon'}
            </button>
          </div>
        </section>

        <section className="glass rounded-2xl p-4 sm:p-6" aria-label="Volunteer track schedule">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">Explore a track</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a color to switch the schedule here in the Volunteer Hub.
              </p>
            </div>
            {assignedTrack && (
              <p className="text-xs text-muted-foreground">
                Your assigned roster remains in <span className="font-semibold text-foreground">{trackInfo?.label ?? assignedTrack}</span>.
              </p>
            )}
          </div>

          <div
            className="mt-5 flex gap-2 overflow-x-auto pb-2 scrollbar-none"
            role="tablist"
            aria-label="Volunteer tracks"
          >
            {VOLUNTEER_TRACKS.map((track) => {
              const Icon = TRACK_ICONS[track.id];
              const isSelected = track.id === selectedTrack.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={`${track.label} schedule`}
                  onClick={() => setSelectedTrackId(track.id)}
                  className={cn(
                    'min-w-[126px] rounded-xl border px-3 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-emerald-glow focus:ring-offset-2',
                    isSelected ? 'shadow-md' : 'opacity-70 hover:opacity-100',
                  )}
                  style={{
                    backgroundColor: track.color,
                    borderColor: isSelected ? '#0A5F43' : track.color,
                    color: '#16211C',
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span className="mt-2 block text-xs font-extrabold">{track.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl border border-border/70 bg-background/50 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: selectedTrack.color }}
                    aria-hidden
                  />
                  <h3 className="font-display text-lg font-bold">{selectedTrack.label} schedule</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{selectedTrack.tagline}</p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground">
                {selectedTrack.schedule.length} volunteer touchpoints
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {selectedTrack.schedule.map((item) => (
                <article
                  key={`${selectedTrack.id}-${item.title}-${item.time}`}
                  className="rounded-lg border border-border/70 bg-card p-3.5"
                  style={{ borderLeftWidth: 4, borderLeftColor: selectedTrack.color }}
                >
                  <div className="flex items-start gap-3">
                    <time className="w-[78px] shrink-0 text-xs font-extrabold leading-5 text-foreground">
                      {item.time}
                    </time>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-foreground">{item.title}</h4>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {item.location} · {item.assignment}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

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
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-mint" />
                <h2 className="font-display text-lg font-semibold">
                  Participant Roster
                </h2>
                <span className="rounded-full bg-emerald/15 px-2.5 py-0.5 text-xs font-bold text-emerald-mint">
                  {totalCount} Total
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-deep transition-all"
              >
                <QrCode className="h-4 w-4" />
                <span>Scan QR Code</span>
              </button>
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

      <VolunteerQrScannerModal
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onCheckInSuccess={handleCheckInSuccess}
      />

      <Dialog open={isShiftDialogOpen} onOpenChange={setIsShiftDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold">Choose your volunteer shift</DialogTitle>
            <DialogDescription>
              Pick the time that works best for you. You can update this choice before the Summit.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            {SHIFT_OPTIONS.map((shift) => {
              const Icon = shift.icon;
              const isSelected = volunteerShift === shift.id;
              return (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => {
                    setVolunteerShift(shift.id);
                    setIsShiftDialogOpen(false);
                  }}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-glow',
                    isSelected
                      ? 'border-emerald bg-emerald/10'
                      : 'border-border hover:border-emerald-glow/60 hover:bg-secondary/50',
                  )}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-deep" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-foreground">{shift.label}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-emerald-deep">{shift.time}</span>
                    <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">{shift.description}</span>
                  </span>
                  {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
