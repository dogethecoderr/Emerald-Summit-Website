// The bell's Notifications list on the shared backend. Rows are written only
// by the backend (notifications_setup.sql in the app repo); the website reads
// them, marks them read, and asks for due session reminders, like the app.
import { supabase } from '../lib/supabase';
import { notificationFromRow, type AppNotification } from '../models/notifications';

/** The signed-in person's notes, newest first. Throws on a failed read. */
export async function fetchNotifications(limit = 100): Promise<AppNotification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => notificationFromRow(r as Record<string, unknown>));
}

/** Marks [ids] read, or every unread note when ids is omitted. Never throws. */
export async function markNotificationsRead(ids?: string[]): Promise<void> {
  if (!supabase || (ids && ids.length === 0)) return;
  try {
    await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null });
  } catch {
    // The list already shows them read; the next load corrects it if this failed.
  }
}

/** Adds any "starts within the hour" reminders that are due. Never throws. */
export async function queueMyReminders(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc('queue_my_session_reminders');
  } catch {
    // Reminders are a nicety; the next run tries again.
  }
}

/** Calls onChange whenever one of this person's notes is added or changed. */
export function subscribeToNotifications(userId: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel(`public:notifications:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
