/// Supabase connection settings.
///
/// Values are injected at build time from a gitignored `env.json` file via
/// `--dart-define-from-file=env.json`, so no keys ever live in source control.
/// See `env.example.json` for the template and README "Configuration".
///
/// The publishable key is safe to ship in the app (Row Level Security protects
/// the data). NEVER put a `secret` key (`sb_secret_...`, formerly
/// `service_role`) in `env.json` — that key bypasses RLS and belongs on a
/// server only.
class SupabaseConfig {
  static const String supabaseUrl =
      String.fromEnvironment('SUPABASE_URL', defaultValue: '');

  static const String supabasePublishableKey =
      String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY', defaultValue: '');

  /// Whether real credentials were provided at build time. When false, the app
  /// runs entirely on local sample data and skips Supabase initialization —
  /// e.g. if you forget the `--dart-define-from-file=env.json` flag.
  static bool get isConfigured =>
      supabaseUrl.isNotEmpty && supabasePublishableKey.isNotEmpty;
}
