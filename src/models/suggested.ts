// "Sessions similar to this", the same rule as the app's
// AppState.suggestedSessions: other sessions in the same discipline that
// aren't on the person's day, aren't full, and don't overlap anything they're
// registered for or managing. Earliest first.
import type { Session } from './sessions';

const minutes = (hhmm?: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

function overlaps(a: Session, b: Session): boolean {
  const [as, ae, bs, be] = [minutes(a.start), minutes(a.end), minutes(b.start), minutes(b.end)];
  if (as == null || ae == null || bs == null || be == null) return false;
  return as < be && bs < ae;
}

/** [onMyDay] is every session the person is registered for or managing. */
export function suggestedSessions(current: Session, all: Session[], onMyDay: Set<string>): Session[] {
  const busy = all.filter((s) => onMyDay.has(s.id));
  return all
    .filter((s) =>
      s.id !== current.id &&
      s.track === current.track &&
      !onMyDay.has(s.id) &&
      s.enrolled < s.capacity &&
      !busy.some((b) => overlaps(b, s)))
    .sort((a, b) => (minutes(a.start) ?? 0) - (minutes(b.start) ?? 0));
}
