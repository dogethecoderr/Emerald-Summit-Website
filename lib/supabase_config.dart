/// Supabase connection settings.
///
/// Paste your project's values below. Both are safe to keep in client code:
/// the anon (a.k.a. publishable) key is designed to ship in the app and is
/// protected by Row Level Security on the server.
///
/// NEVER put the `service_role` (secret) key here — that key bypasses RLS and
/// must stay on a server only.
///
/// Find these in the Supabase dashboard:
///   Project → Settings → API
///     • Project URL      → [supabaseUrl]
///     • Project API keys → anon / public → [supabaseAnonKey]
class SupabaseConfig {
  static const String supabaseUrl = 'PASTE_YOUR_PROJECT_URL_HERE';
  static const String supabaseAnonKey = 'PASTE_YOUR_ANON_PUBLIC_KEY_HERE';

  /// Whether real credentials have been filled in. When false, the app runs
  /// entirely on local sample data and skips Supabase initialization.
  static bool get isConfigured =>
      !supabaseUrl.startsWith('PASTE_') && !supabaseAnonKey.startsWith('PASTE_');
}
