// Two website switches kept on the shared backend, in the summit_settings row
// (app repo, supabase/website_switches.sql), so the organizers can flip them
// in Supabase without a deploy:
//
//   website_registration_open   false: "Add to my day" is greyed out on session
//                               and track pages, with REGISTRATION_CLOSED_MESSAGE
//                               on hover. Signing in and browsing still work.
//   website_show_session_times  false: session times, lengths and participant
//                               deadlines read "TBD", and Home has no countdown.
//
// Both stay off until the backend says true, so a missing column, a failed
// read or a slow network never opens registration or shows times by accident.
// The mobile app doesn't read these columns.
import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';

export interface SiteSwitches {
  registrationOpen: boolean;
  showTimes: boolean;
  /** False until the backend has answered (or failed to). */
  loaded: boolean;
}

export const SWITCHES_OFF: SiteSwitches = { registrationOpen: false, showTimes: false, loaded: false };

/** Shown on the greyed-out "Add to my day" buttons while registration is closed. */
export const REGISTRATION_CLOSED_MESSAGE = 'Registration will open on November 21st';

/** What a hidden time, length or deadline reads as. */
export const TBD = 'TBD';

/** Never throws: anything but an explicit true reads as off. */
export async function fetchSiteSwitches(): Promise<SiteSwitches> {
  const off = { ...SWITCHES_OFF, loaded: true };
  if (!supabase) return off;
  try {
    const { data, error } = await supabase
      .from('summit_settings')
      .select('website_registration_open, website_show_session_times')
      .limit(1)
      .maybeSingle();
    if (error || !data) return off;
    const row = data as { website_registration_open?: unknown; website_show_session_times?: unknown };
    return {
      registrationOpen: row.website_registration_open === true,
      showTimes: row.website_show_session_times === true,
      loaded: true,
    };
  } catch {
    return off;
  }
}

let current: SiteSwitches = SWITCHES_OFF;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: SiteSwitches) {
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The switches, read once per page load and shared by every caller. */
export function useSiteSwitches(): SiteSwitches {
  const value = useSyncExternalStore(subscribe, () => current);
  useEffect(() => {
    pending ??= fetchSiteSwitches().then(publish);
  }, []);
  return value;
}

/** Test hook: set the switches without reading the backend. */
export function setSiteSwitchesForTests(next: Partial<SiteSwitches> | null): void {
  if (next === null) {
    pending = null;
    publish(SWITCHES_OFF);
    return;
  }
  pending = Promise.resolve();
  publish({ ...SWITCHES_OFF, loaded: true, ...next });
}
