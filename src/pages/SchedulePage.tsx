import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertTriangle,
  Navigation,
  Plus,
  Minus,
  Eye,
  CalendarDays,
  Clock,
  MapPin,
  GripVertical,
  HandHeart,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import CapacityBar from '../components/CapacityBar';
import TrackPill from '../components/TrackPill';
import { useRequireRole } from '../hooks/useRequireProfile';
import { useSchedule } from '../context/ScheduleContext';
import { USER_DISCIPLINES } from '../models/disciplines';
import {
  MOCK_SESSIONS,
  MOCK_VOLUNTEER_COUNTS,
  TIME_SLOTS,
  VOLUNTEER_CAPACITY,
  WALKING_TIME,
  type Session,
} from '../models/sessions';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const FILTERS = ['All', ...USER_DISCIPLINES.map((d) => d.name)];

function filterLabel(name: string): string {
  if (name === 'All') return 'All';
  return USER_DISCIPLINES.find((d) => d.name === name)?.label ?? name;
}

export default function SchedulePage() {
  const { ready, redirect } = useRequireRole(['participant']);
  const { mySchedule, setMySchedule, spectating, setSpectating } =
    useSchedule();
  const [disciplineFilter, setDisciplineFilter] = useState('All');
  const [volunteering, setVolunteering] = useState<string[]>([]);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const getConflict = (session: Session): Session | null => {
    const competing = MOCK_SESSIONS.find(
      (s) => mySchedule.includes(s.id) && s.time === session.time,
    );
    return competing ?? null;
  };

  const getWalkWarning = (session: Session): number | null => {
    const prevSlotIdx = TIME_SLOTS.indexOf(session.time) - 1;
    if (prevSlotIdx < 0) return null;
    const prevSlot = TIME_SLOTS[prevSlotIdx];
    const prevSession = MOCK_SESSIONS.find(
      (s) => mySchedule.includes(s.id) && s.time === prevSlot,
    );
    if (!prevSession) return null;
    const mins = WALKING_TIME[prevSession.room]?.[session.room];
    return mins && mins >= 6 ? mins : null;
  };

  const toggle = (id: string) => {
    setMySchedule(
      mySchedule.includes(id)
        ? mySchedule.filter((x) => x !== id)
        : [...mySchedule, id],
    );
    setSpectating(spectating.filter((x) => x !== id));
  };

  const toggleSpectate = (id: string) => {
    setSpectating(
      spectating.includes(id)
        ? spectating.filter((x) => x !== id)
        : [...spectating, id],
    );
    setMySchedule(mySchedule.filter((x) => x !== id));
  };

  const volunteerCountFor = (id: string) =>
    (MOCK_VOLUNTEER_COUNTS[id] ?? 0) + (volunteering.includes(id) ? 1 : 0);

  const toggleVolunteer = (id: string) => {
    if (volunteering.includes(id)) {
      setVolunteering(volunteering.filter((volunteerId) => volunteerId !== id));
      return;
    }

    if (volunteerCountFor(id) < VOLUNTEER_CAPACITY) {
      setVolunteering([...volunteering, id]);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    if (result.destination.droppableId === 'my-schedule') {
      const sessionId = result.draggableId;
      const session = MOCK_SESSIONS.find((s) => s.id === sessionId);
      if (!session) return;
      
      const isAdded = mySchedule.includes(session.id);
      const isSpec = spectating.includes(session.id);
      const conflict = !isAdded && getConflict(session);
      const full = session.enrolled >= session.capacity;
      
      if (!isAdded && !isSpec && !full && !conflict) {
        toggle(session.id);
      }
    }
  };

  const added = MOCK_SESSIONS.filter(
    (s) => mySchedule.includes(s.id) || spectating.includes(s.id),
  ).sort((a, b) => TIME_SLOTS.indexOf(a.time) - TIME_SLOTS.indexOf(b.time));

  const filteredSessions =
    disciplineFilter === 'All'
      ? MOCK_SESSIONS
      : MOCK_SESSIONS.filter(
          (s) => s.track === disciplineFilter || s.track === 'keynote',
        );

  return (
    <AppShell>
      <PageHeader
        label="Emerald High School · Dublin, CA"
        title="Build Your Schedule"
        sub="Add sessions to your agenda. The builder prevents time conflicts, flags near-full tracks, and warns about long walks between rooms. Drag and drop a session to your schedule!"
      />

      {/* discipline filters */}
      <div className="scrollbar-none mb-6 flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = disciplineFilter === f;
          const color =
            f === 'All'
              ? undefined
              : USER_DISCIPLINES.find((d) => d.name === f)?.color;
          return (
            <button
              key={f}
              onClick={() => setDisciplineFilter(f)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                active
                  ? 'bg-emerald text-white'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              style={
                active && color ? { background: color, color: '#fff' } : undefined
              }
            >
              {filterLabel(f)}
            </button>
          );
        })}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid items-start gap-6 lg:grid-cols-[5fr_2fr]">
          {/* session browser */}
          <Droppable droppableId="browser" isDropDisabled={true}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-8"
              >
                {TIME_SLOTS.map((slot) => {
                  const slotSessions = filteredSessions.filter((s) => s.time === slot);
                  if (slotSessions.length === 0) return null;
                  
                  return (
                    <div key={slot}>
                      <div className="mb-3 flex items-center gap-3">
                        <span className="font-display text-sm font-semibold text-emerald-mint">
                          {slot}
                        </span>
                        <div className="h-px flex-1 bg-border/70" />
                      </div>
                      <div className="space-y-3">
                        {slotSessions.map((s) => {
                          const globalIndex = filteredSessions.indexOf(s);
                          const isAdded = mySchedule.includes(s.id);
                          const isSpectating = spectating.includes(s.id);
                          const conflict = !isAdded && getConflict(s);
                          const walkWarn = getWalkWarning(s);
                          const full = s.enrolled >= s.capacity;
                          const spectatorFull = s.spectators >= s.spectatorCap;
                          const near = !full && s.enrolled / s.capacity >= 0.8;
                          const volunteeringHere = volunteering.includes(s.id);
                          const volunteerCount = volunteerCountFor(s.id);
                          const volunteerFull = volunteerCount >= VOLUNTEER_CAPACITY;
                          const volunteerSpots = Math.max(
                            0,
                            VOLUNTEER_CAPACITY - volunteerCount,
                          );
                          const isDragDisabled = isAdded || isSpectating || full || !!conflict;

                          return (
                            <Draggable
                              key={s.id}
                              draggableId={s.id}
                              index={globalIndex}
                              isDragDisabled={isDragDisabled}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={cn(
                                    'glass rounded-2xl p-4 transition-all sm:p-5',
                                    isAdded && 'ring-1 ring-emerald-glow/50',
                                    isSpectating && 'ring-1 ring-amber-400/50',
                                    snapshot.isDragging && 'shadow-2xl scale-[1.02] z-50 ring-2 ring-emerald opacity-95',
                                    isDragDisabled && !isAdded && !isSpectating && 'opacity-70 grayscale-[0.3]'
                                  )}
                                  style={provided.draggableProps.style}
                                >
                                  {conflict && (
                                    <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400">
                                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                      <span>
                                        Conflicts with <strong>{conflict.title}</strong>
                                      </span>
                                    </div>
                                  )}
                                  {walkWarn && (
                                    <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400">
                                      <Navigation className="h-3.5 w-3.5 shrink-0" />
                                      {walkWarn} min walk from your previous session
                                    </div>
                                  )}

                                  <div className="flex gap-4">
                                    {!isDragDisabled && (
                                      <div
                                        {...provided.dragHandleProps}
                                        className="flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                                      >
                                        <GripVertical className="h-5 w-5" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                        <TrackPill track={s.track} />
                                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                          <Clock className="h-3 w-3" /> {s.duration}
                                        </span>
                                        {full && (
                                          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
                                            Full
                                          </span>
                                        )}
                                        {near && (
                                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                                            Nearly full
                                          </span>
                                        )}
                                      </div>
                                      <h3 className="text-[15px] font-semibold leading-snug">
                                        {s.title}
                                      </h3>
                                      <div className="mt-0.5 text-xs text-muted-foreground">
                                        {s.speaker}
                                      </div>
                                      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                                        {s.description}
                                      </p>
                                      <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-mint">
                                        <MapPin className="h-3 w-3" /> {s.location}
                                      </div>
                                      <CapacityBar
                                        enrolled={s.enrolled}
                                        capacity={s.capacity}
                                        label="Competitor seats"
                                      />
                                      {s.spectatorCap > 0 && (
                                        <CapacityBar
                                          enrolled={s.spectators}
                                          capacity={s.spectatorCap}
                                          label="Spectator seats"
                                        />
                                      )}
                                      <div className="mt-3 rounded-xl border border-emerald/15 bg-emerald/5 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-mint">
                                            <HandHeart className="h-3.5 w-3.5" />
                                            Volunteer team
                                          </div>
                                          <span
                                            className={cn(
                                              'text-xs font-medium',
                                              volunteeringHere
                                                ? 'text-emerald-mint'
                                                : volunteerFull
                                                  ? 'text-red-400'
                                                  : 'text-muted-foreground',
                                            )}
                                          >
                                            {volunteeringHere
                                              ? "You're volunteering"
                                              : volunteerFull
                                                ? 'Volunteer team full'
                                                : `${volunteerSpots} spot${volunteerSpots === 1 ? '' : 's'} open`}
                                          </span>
                                        </div>
                                        <CapacityBar
                                          enrolled={volunteerCount}
                                          capacity={VOLUNTEER_CAPACITY}
                                          label="Volunteer spots"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => toggleVolunteer(s.id)}
                                          disabled={!volunteeringHere && volunteerFull}
                                          aria-label={
                                            volunteeringHere
                                              ? `Stop volunteering for ${s.title}`
                                              : `Volunteer for ${s.title}`
                                          }
                                          className={cn(
                                            'mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                                            volunteeringHere
                                              ? 'border-transparent bg-emerald text-white hover:bg-emerald-deep'
                                              : 'border-emerald/30 bg-background/50 text-emerald-mint hover:border-emerald-glow hover:bg-emerald/10',
                                          )}
                                        >
                                          <HandHeart className="h-3.5 w-3.5" />
                                          {volunteeringHere
                                            ? 'Stop volunteering'
                                            : volunteerFull
                                              ? 'No spots left'
                                              : 'Volunteer for this event'}
                                        </button>
                                      </div>
                                    </div>

                                    <div className="flex shrink-0 flex-col gap-2">
                                      <button
                                        onClick={() => toggle(s.id)}
                                        disabled={!isAdded && (full || !!conflict)}
                                        title={
                                          isAdded
                                            ? 'Remove'
                                            : full
                                              ? 'Session full'
                                              : conflict
                                                ? 'Time conflict'
                                                : 'Add as competitor'
                                        }
                                        className={cn(
                                          'flex h-9 w-9 items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-35',
                                          isAdded
                                            ? 'border-transparent bg-emerald text-white hover:bg-emerald-deep'
                                            : 'border-border bg-secondary/50 text-foreground hover:border-emerald-glow/50 hover:text-emerald-mint',
                                        )}
                                      >
                                        {isAdded ? (
                                          <Minus className="h-4 w-4" />
                                        ) : (
                                          <Plus className="h-4 w-4" />
                                        )}
                                      </button>
                                      {s.spectatorCap > 0 && !isAdded && (
                                        <button
                                          onClick={() => toggleSpectate(s.id)}
                                          disabled={
                                            !isSpectating && (spectatorFull || !!conflict)
                                          }
                                          title={
                                            isSpectating
                                              ? 'Remove spectator spot'
                                              : spectatorFull
                                                ? 'Spectator seats full'
                                                : 'Attend as spectator'
                                          }
                                          className={cn(
                                            'flex h-9 w-9 items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-35',
                                            isSpectating
                                              ? 'border-transparent bg-amber-500 text-white hover:bg-amber-600'
                                              : 'border-border bg-secondary/50 text-foreground hover:border-amber-400/50 hover:text-amber-400',
                                          )}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* my schedule summary */}
          <Droppable droppableId="my-schedule">
            {(provided, snapshot) => (
              <aside
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "glass sticky top-10 rounded-2xl p-5 transition-all duration-300",
                  snapshot.isDraggingOver && "ring-2 ring-emerald bg-emerald/5"
                )}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-mint/80">
                      My Schedule
                    </div>
                    <div className="font-display text-lg font-semibold">
                      {added.length} session{added.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {added.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <CalendarDays className="h-8 w-8 text-muted-foreground/60" />
                    <div className="text-sm font-medium">No sessions added yet.</div>
                    <div className="text-xs text-muted-foreground">
                      Drag sessions here or use + to compete.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {added.map((s) => {
                      const isSpec = spectating.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          className="flex items-start gap-2 rounded-xl border border-border/70 bg-secondary/30 p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-emerald-mint">
                                {s.time}
                              </span>
                              {isSpec && (
                                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400">
                                  Spectating
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 truncate text-[13px] font-semibold">
                              {s.title}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {s.location}
                            </div>
                          </div>
                          <button
                            onClick={() => (isSpec ? toggleSpectate(s.id) : toggle(s.id))}
                            aria-label="Remove"
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-red-400"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {provided.placeholder}
              </aside>
            )}
          </Droppable>
        </div>
      </DragDropContext>
    </AppShell>
  );
}
