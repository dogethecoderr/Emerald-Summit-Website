import 'package:flutter/material.dart';

import '../data/announcements_repository.dart';
import '../data/sample_data.dart';
import '../models/models.dart';
import '../supabase_config.dart';
import '../theme.dart';

/// "News" tab — the announcement feed (spec section 04 — Announcements).
///
/// When Supabase is configured this pulls live from the `announcements`
/// table; otherwise it falls back to local sample data. A banner at the top
/// makes the data source obvious — this is the backend connectivity test.
///
/// Refresh works two ways: pull down on the list, or tap the app-bar button.
/// Both call [_load], which re-fetches from Supabase and updates the feed.
class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  List<Announcement> _items = const [];
  Object? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    if (SupabaseConfig.isConfigured) {
      _load();
    } else {
      _items = SampleData.announcements;
    }
  }

  /// Re-fetches announcements from the backend. Safe to call repeatedly —
  /// used by both pull-to-refresh and the app-bar refresh button.
  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await AnnouncementsRepository.fetch();
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Announcements'),
        actions: [
          if (SupabaseConfig.isConfigured)
            IconButton(
              icon: const Icon(Icons.refresh),
              tooltip: 'Reload from backend',
              onPressed: _loading ? null : _load,
            ),
        ],
      ),
      body: SupabaseConfig.isConfigured ? _buildLive() : _buildSample(),
    );
  }

  // ---- Not configured: static sample data --------------------------------
  Widget _buildSample() {
    return Column(
      children: [
        const _SourceBanner(
          live: false,
          text: 'Sample data — Supabase not configured yet',
        ),
        Expanded(child: _list(_items)),
      ],
    );
  }

  // ---- Configured: live from Supabase ------------------------------------
  Widget _buildLive() {
    // First load, nothing to show yet.
    if (_loading && _items.isEmpty && _error == null) {
      return const Center(child: CircularProgressIndicator());
    }
    // Errored with no data to fall back on.
    if (_error != null && _items.isEmpty) {
      return _buildError(_error.toString());
    }

    return Column(
      children: [
        _SourceBanner(
          live: true,
          text: 'Live from Supabase · ${_items.length} '
              'announcement${_items.length == 1 ? '' : 's'}',
        ),
        // Thin progress bar while a refresh is in flight over existing data.
        if (_loading)
          const LinearProgressIndicator(minHeight: 2)
        else
          const SizedBox(height: 2),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: _items.isEmpty
                ? _emptyState()
                : _list(_items, alwaysScrollable: true),
          ),
        ),
      ],
    );
  }

  Widget _list(List<Announcement> items, {bool alwaysScrollable = false}) {
    return ListView.separated(
      physics: alwaysScrollable
          ? const AlwaysScrollableScrollPhysics()
          : null,
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, i) => _AnnouncementCard(item: items[i]),
    );
  }

  /// Connected but the table returned no rows. Kept scrollable so
  /// pull-to-refresh still works from the empty state.
  Widget _emptyState() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 80, 24, 24),
          child: Center(
            child: Text(
              'Connected to Supabase, but the announcements table is empty. '
              'Add a row in the Supabase Table editor, then pull down to '
              'refresh.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildError(String message) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.cloud_off, size: 56, color: theme.colorScheme.error),
          const SizedBox(height: 16),
          Text("Couldn't reach the backend",
              style: theme.textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
            label: const Text('Try again'),
          ),
        ],
      ),
    );
  }
}

/// Small banner showing where the data came from.
class _SourceBanner extends StatelessWidget {
  const _SourceBanner({required this.live, required this.text});
  final bool live;
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = live ? theme.colorScheme.primary : theme.colorScheme.tertiary;
    return Container(
      width: double.infinity,
      color: EmeraldTheme.mist,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Icon(live ? Icons.cloud_done : Icons.storage,
              size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text,
                style: theme.textTheme.labelMedium?.copyWith(color: color)),
          ),
        ],
      ),
    );
  }
}

class _AnnouncementCard extends StatelessWidget {
  const _AnnouncementCard({required this.item});
  final Announcement item;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (item.pinned) ...[
                  Icon(Icons.push_pin,
                      size: 16, color: theme.colorScheme.primary),
                  const SizedBox(width: 6),
                ],
                Expanded(
                  child: Text(item.title, style: theme.textTheme.titleMedium),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(item.body, style: theme.textTheme.bodyMedium),
            const SizedBox(height: 12),
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: EmeraldTheme.mist,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(item.audience,
                      style: theme.textTheme.labelSmall
                          ?.copyWith(color: theme.colorScheme.primary)),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    [item.author, item.timeAgo]
                        .where((s) => s.isNotEmpty)
                        .join(' · '),
                    style: theme.textTheme.bodySmall,
                    textAlign: TextAlign.end,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
