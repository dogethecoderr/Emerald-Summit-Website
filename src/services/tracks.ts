import { supabase } from '../lib/supabase';
import {
  addDemoTrack,
  getDemoTracks,
  removeDemoTrack,
  type DemoTrack,
} from './offlineDemo';

export type TrackOption = DemoTrack;

export async function fetchTrackOptions(): Promise<TrackOption[]> {
  if (!supabase) {
    return getDemoTracks().map((track) => ({ ...track }));
  }

  const { data, error } = await supabase
    .from('summit_tracks')
    .select('name, label, color, is_discipline')
    .order('label');
  if (error) throw new Error(`Could not load summit tracks: ${error.message}`);
  return (data ?? []) as TrackOption[];
}

export async function saveTrackOption(
  name: string,
  label: string,
  color: string,
): Promise<void> {
  if (!supabase) {
    addDemoTrack({ name, label: label.trim(), color, is_discipline: true });
    return;
  }
  const { error } = await supabase
    .from('summit_tracks')
    .upsert({ name, label: label.trim(), color, is_discipline: true });
  if (error) throw new Error(`Could not save track: ${error.message}`);
}

export async function deleteTrackOption(name: string): Promise<void> {
  if (!supabase) {
    removeDemoTrack(name);
    return;
  }
  const { error } = await supabase
    .from('summit_tracks')
    .delete()
    .eq('name', name);
  if (error) throw new Error(`Could not delete track: ${error.message}`);
}
