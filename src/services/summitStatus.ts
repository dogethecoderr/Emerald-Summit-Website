// The summit date and whether post-summit feedback is open, from the shared
// fetch_summit_status() RPC (the app's SummitStatus). The date stays null
// until the organizers set summit_settings.summit_date, so nothing here
// hard-codes a day.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface SummitStatus {
  /** 'YYYY-MM-DD', or null while the date isn't set. */
  date: string | null;
  feedbackOpen: boolean;
}

export const UNKNOWN_STATUS: SummitStatus = { date: null, feedbackOpen: false };

/**
 * The website's own summit day, used until the organizers set
 * summit_settings.summit_date on the shared backend (which then wins). Kept on
 * the website only: writing it to the backend would change the mobile app too.
 */
export const SUMMIT_DATE = '2027-01-23';

/** Shown wherever the app shows SampleData.eventDate while no date is known. */
export const EVENT_DATE_FALLBACK = 'January 23, 2027';
export const EVENT_VENUE = 'Emerald High · Dublin, CA';

/** Never throws: a failed read means "date not set yet", like the app. */
export async function fetchSummitStatus(): Promise<SummitStatus> {
  if (!supabase) return UNKNOWN_STATUS;
  try {
    const { data, error } = await supabase.rpc('fetch_summit_status');
    if (error || !data || typeof data !== 'object') return UNKNOWN_STATUS;
    const row = data as { summit_date?: unknown; feedback_open?: unknown };
    const date = typeof row.summit_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(row.summit_date)
      ? row.summit_date.slice(0, 10) : null;
    return { date, feedbackOpen: row.feedback_open === true };
  } catch {
    return UNKNOWN_STATUS;
  }
}

let cached: Promise<SummitStatus> | null = null;

/**
 * The status, read once per page load and shared by every caller. The date is
 * the backend's when it is set, and the website's SUMMIT_DATE until then.
 */
export function useSummitStatus(): SummitStatus {
  const [status, setStatus] = useState<SummitStatus>({ ...UNKNOWN_STATUS, date: SUMMIT_DATE });
  useEffect(() => {
    let live = true;
    cached ??= fetchSummitStatus();
    cached.then((s) => { if (live) setStatus({ ...s, date: s.date ?? SUMMIT_DATE }); });
    return () => { live = false; };
  }, []);
  return status;
}

/** Test hook: forget the shared read. */
export function resetSummitStatusCache(): void {
  cached = null;
}

/** A 'YYYY-MM-DD' date as a local calendar day (no UTC shift). */
export function localDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Port of the app's formatDay: "Sat, Jan 23", with the year when it isn't this year. */
export function formatDay(date: string, now: Date = new Date()): string {
  const d = localDay(date);
  const year = d.getFullYear() === now.getFullYear() ? '' : `, ${d.getFullYear()}`;
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}${year}`;
}

/**
 * When summit day's first session starts: the earliest start from 6 AM on
 * (ignoring a time typed without the 12-hour offset), or 8 AM when there are
 * none. Same rule as the app's _SummitCountdown.
 */
export function summitStart(date: string, startMinutes: number[]): Date {
  const starts = startMinutes.filter((m) => Number.isFinite(m) && m >= 6 * 60);
  const first = starts.length ? Math.min(...starts) : 8 * 60;
  const day = localDay(date);
  day.setMinutes(first);
  return day;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Time left until `start`, or null once it has started. */
export function countdownParts(start: Date, now: Date): CountdownParts | null {
  const left = start.getTime() - now.getTime();
  if (left <= 0) return null;
  const total = Math.floor(left / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
  };
}
