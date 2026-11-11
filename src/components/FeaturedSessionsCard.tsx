import { Clock, MapPin } from '@/components/icons';
import type { Session } from '../models/sessions';
import CapacityBar from './CapacityBar';
import TrackPill from './TrackPill';

export default function FeaturedSessionsCard({
  sessions,
  title = 'Featured Sessions',
}: {
  sessions: Session[];
  title?: string;
}) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="mb-4 font-display text-base font-semibold">{title}</h2>
      <div className="space-y-1">
        {sessions.map((s) => {
          const pct = Math.round((s.enrolled / s.capacity) * 100);
          return (
            <div
              key={s.id}
              className="flex items-start justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-accent/40"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold leading-snug">
                  {s.title}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {s.speaker}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {s.time}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {s.location}
                  </span>
                </div>
                <CapacityBar enrolled={s.enrolled} capacity={s.capacity} />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <TrackPill track={s.track} />
                {pct >= 100 && (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
                    Full
                  </span>
                )}
                {pct >= 80 && pct < 100 && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                    Nearly full
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
