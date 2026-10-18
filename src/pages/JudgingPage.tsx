import { Navigate } from 'react-router-dom';
import { Clock, MapPin, Footprints, ScrollText } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import TrackPill from '../components/TrackPill';
import { useRequireRole } from '../hooks/useRequireProfile';
import { MOCK_ASSIGNMENTS } from '../models/assignments';
import { MOCK_SESSIONS, TIME_SLOTS, WALKING_TIME } from '../models/sessions';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Stylized campus grid — room letter blocks with the day's route drawn through. */
const ROOM_POS: Record<string, { x: number; y: number; name: string }> = {
  A: { x: 55, y: 40, name: 'Main Hall' },
  B: { x: 170, y: 95, name: 'Rm 108' },
  C: { x: 285, y: 40, name: 'Comp Lab' },
  D: { x: 285, y: 150, name: 'Rm 204' },
  E: { x: 55, y: 150, name: 'Design' },
  F: { x: 170, y: 205, name: 'Sci Wing' },
  G: { x: 400, y: 95, name: 'Innov Hub' },
  H: { x: 400, y: 205, name: 'Bio Lab' },
  I: { x: 515, y: 150, name: 'Media Lab' },
  J: { x: 515, y: 40, name: 'Courtyard' },
};

function CampusMap({ route }: { route: string[] }) {
  const routeSet = new Set(route);
  const points = route
    .map((r) => ROOM_POS[r])
    .filter(Boolean)
    .map((p) => `${p.x + 24},${p.y + 18}`)
    .join(' ');

  return (
    <svg viewBox="0 0 594 260" className="w-full">
      {/* paths between all rooms, faint */}
      {Object.entries(ROOM_POS).map(([k, p]) => (
        <g key={k}>
          <rect
            x={p.x}
            y={p.y}
            width={48}
            height={36}
            rx={9}
            className={cn(
              routeSet.has(k) ? 'fill-emerald/30' : 'fill-secondary',
            )}
            stroke={routeSet.has(k) ? '#0C7A55' : 'hsl(154 20% 20%)'}
            strokeWidth={routeSet.has(k) ? 1.5 : 1}
          />
          <text
            x={p.x + 24}
            y={p.y + 20}
            textAnchor="middle"
            dominantBaseline="middle"
            className={cn(
              'font-display text-[13px] font-bold',
              routeSet.has(k) ? 'fill-emerald-mint' : 'fill-muted-foreground',
            )}
          >
            {k}
          </text>
          <text
            x={p.x + 24}
            y={p.y + 46}
            textAnchor="middle"
            className="fill-muted-foreground text-[8px]"
          >
            {p.name}
          </text>
        </g>
      ))}
      {route.length > 1 && (
        <polyline
          points={points}
          fill="none"
          stroke="#0C7A55"
          strokeWidth="2"
          strokeDasharray="5 4"
          strokeLinecap="round"
          opacity="0.85"
        />
      )}
      {/* numbered stops */}
      {route.map((r, i) => {
        const p = ROOM_POS[r];
        if (!p) return null;
        return (
          <g key={`${r}-${i}`}>
            <circle cx={p.x + 48} cy={p.y} r={9} fill="#0C7A55" />
            <text
              x={p.x + 48}
              y={p.y + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-[9px] font-bold"
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function JudgingPage() {
  const { ready, redirect } = useRequireRole(['expert']);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const assignments = MOCK_ASSIGNMENTS.map((a) => ({
    ...a,
    session: MOCK_SESSIONS.find((s) => s.id === a.sessionId)!,
  }))
    .filter((a) => a.session)
    .sort(
      (a, b) =>
        TIME_SLOTS.indexOf(a.session.time) - TIME_SLOTS.indexOf(b.session.time),
    );

  const route = assignments.map((a) => a.session.room);

  return (
    <AppShell>
      <PageHeader
        label="Expert Day Plan"
        title="Your Judging Schedule"
      />

      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        {/* timeline */}
        <div className="space-y-3">
          {assignments.map((a, i) => {
            const prev = assignments[i - 1];
            const walk =
              prev &&
              (WALKING_TIME[prev.session.room]?.[a.session.room] ??
                WALKING_TIME[a.session.room]?.[prev.session.room]);
            return (
              <div key={a.id}>
                {walk != null && (
                  <div className="mb-3 ml-6 flex items-center gap-2 text-xs font-medium text-amber-400/90">
                    <Footprints className="h-3.5 w-3.5" />
                    ~{walk} min walk from {prev.session.location}
                  </div>
                )}
                <div className="glass flex gap-4 rounded-2xl p-5">
                  <div className="flex flex-col items-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald font-display text-[13px] font-bold text-white">
                      {i + 1}
                    </span>
                    {i < assignments.length - 1 && (
                      <span className="mt-2 w-px flex-1 bg-border" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <TrackPill track={a.session.track} />
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold',
                          a.duty === 'Lead Judge'
                            ? 'bg-emerald/20 text-emerald-mint'
                            : a.duty === 'Panel Judge'
                              ? 'bg-sky-500/15 text-sky-400'
                              : 'bg-violet-500/15 text-violet-400',
                        )}
                      >
                        {a.duty}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-semibold leading-snug">
                      {a.session.title}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {a.session.time} ·{' '}
                        {a.session.duration}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-mint">
                        <MapPin className="h-3 w-3" /> {a.session.location} (Room{' '}
                        {a.session.room})
                      </span>
                    </div>
                    {a.note && (
                      <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-mint" />
                        {a.note}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* campus map */}
        <aside className="glass sticky top-10 rounded-2xl p-5">
          <h2 className="font-display text-base font-semibold">Campus Route</h2>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            Your day in order — numbered stops match the timeline.
          </p>
          <CampusMap route={route} />
        </aside>
      </div>
    </AppShell>
  );
}
