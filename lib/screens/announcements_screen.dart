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
class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  late Future<List<Announcement>> _future;

  @override
  void initState() {
    super.initState();
    // Only hit the backend when configured; otherwise the screen renders
    // sample data and never touches this future.
    _future = SupabaseConfig.isConfigured
        ? _load()
        : Future<List<Announcement>>.value(const []);
  }

  Future<List<Announcement>> _load() => AnnouncementsRepository.fetch();

  void _refresh() => setState(() => _future = _load());

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
              onPressed: _refresh,
            ),
        ],
      ),
      body: SupabaseConfig.isConfigured
          ? _buildLive()
          : _buildFallback(
              const _SourceBanner(
                live: false,
                text: 'Sample data — Supabase not configured yet',
              ),
              SampleData.announcements,
            ),
    );
  }

  Widget _buildLive() {
    return FutureBuilder<List<Announcement>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _buildError(snapshot.error.toString());
        }
        final items = snapshot.data ?? [];
        return _buildFallback(
          _SourceBanner(
            live: true,
            text: 'Live from Supabase · ${items.length} '
                'announcement${items.length == 1 ? '' : 's'}',
          ),
          items,
          emptyNote:
              'Connected to Supabase, but the announcements table is empty. '
              'Add a row in the Supabase Table editor and tap refresh.',
        );
      },
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
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
            label: const Text('Try again'),
          ),
        ],
      ),
    );
  }

  Widget _buildFallback(Widget banner, List<Announcement> items,
      {String? emptyNote}) {
    return Column(
      children: [
        banner,
        Expanded(
          child: items.isEmpty && emptyNote != null
              ? Padding(
                  padding: const EdgeInsets.all(24),
                  child: Center(
                    child: Text(emptyNote, textAlign: TextAlign.center),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, i) =>
                      _AnnouncementCard(item: items[i]),
                ),
        ),
      ],
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
