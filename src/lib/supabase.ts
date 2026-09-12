import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Null when the environment is not configured.
 *
 * This module is pulled in from AuthContext at the root of the tree, so
 * throwing here took the entire app down at module load — the landing page
 * included — on any deploy without the two VITE_SUPABASE_* variables set.
 * Failing soft instead keeps the site up and leaves bypass sign-in working;
 * the real sign-in paths check for null and say what is missing.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

/** True when real (non-bypass) auth can actually be attempted. */
export const isSupabaseConfigured = supabase !== null;
