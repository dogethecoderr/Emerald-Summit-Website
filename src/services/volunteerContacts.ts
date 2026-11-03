import { supabase } from '../lib/supabase';

export interface VolunteerContact {
  id: string;
  name: string;
  role: string;
  subtype: string | null;
  phone: string;
}

/** The mobile app's role-gated RPC exposes only team names and phone numbers. */
export async function fetchVolunteerContacts(): Promise<VolunteerContact[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('fetch_volunteer_hub');
  if (error) throw new Error(error.message);
  return ((data ?? []) as {
    id: string;
    full_name: string | null;
    role: string;
    subtype: string | null;
    phone: string | null;
  }[]).map((row) => ({
    id: row.id,
    name: row.full_name?.trim() || 'Summit volunteer',
    role: row.role,
    subtype: row.subtype,
    phone: row.phone?.trim() || '',
  }));
}
