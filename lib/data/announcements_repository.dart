import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/models.dart';
import '../supabase_config.dart';

/// Fetches announcements. When Supabase is configured it reads live from the
/// `announcements` table; otherwise it's the caller's job to fall back to
/// sample data. This is the connectivity test for the backend.
class AnnouncementsRepository {
  /// Pulls announcements newest-first, pinned ones surfaced to the top.
  static Future<List<Announcement>> fetch() async {
    if (!SupabaseConfig.isConfigured) {
      throw StateError('Supabase is not configured');
    }
    final rows = await Supabase.instance.client
        .from('announcements')
        .select()
        .order('pinned', ascending: false)
        .order('created_at', ascending: false);

    return rows.map((r) => Announcement.fromMap(r)).toList();
  }
}
