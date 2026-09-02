import 'package:flutter/material.dart';

import '../app_state.dart';
import '../data/sample_data.dart';
import '../models/models.dart';
import 'discover_screen.dart';
import 'session_detail_screen.dart';

/// "My Day" tab — the participant's personal schedule, built from the
/// sessions they've added (spec section 04 — Build your own schedule).
class ScheduleScreen extends StatelessWidget {
  const ScheduleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Day'),
        bottom: const _EventBanner(),
      ),
      body: ListenableBuilder(
        listenable: appState,
        builder: (context, _) {
          final sessions = appState.mySessions;
          if (sessions.isEmpty) return const _EmptyPlan();
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            itemCount: sessions.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, i) => _ScheduleCard(session: sessions[i]),
          );
        },
      ),
    );
  }
}

class _EventBanner extends StatelessWidget implements PreferredSizeWidget {
  const _EventBanner();

  @override
  Size get preferredSize => const Size.fromHeight(28);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, bottom: 10),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(
          '${SampleData.eventDate}  ·  ${SampleData.eventVenue}',
          style: TextStyle(
            color: Colors.white.withValues(alpha: .85),
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}

class _EmptyPlan extends StatelessWidget {
  const _EmptyPlan();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.event_available,
                size: 64, color: theme.colorScheme.primary),
            const SizedBox(height: 16),
            Text('Your day is a blank slate',
                style: theme.textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              'Browse the six disciplines and add sessions to build your '
              'personal schedule. We\'ll flag time clashes and full tracks.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const DiscoverScreen()),
              ),
              icon: const Icon(Icons.explore),
              label: const Text('Browse sessions'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({required this.session});
  final Session session;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => SessionDetailScreen(session: session),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(session.timeLabel.split(' – ').first,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: theme.colorScheme.primary,
                        fontWeight: FontWeight.bold,
                      )),
                  Text(session.timeLabel.split(' – ').last,
                      style: theme.textTheme.bodySmall),
                ],
              ),
              const SizedBox(width: 16),
              Container(
                width: 3,
                height: 44,
                color: theme.colorScheme.primary.withValues(alpha: .3),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(session.title, style: theme.textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text('${session.disciplineName} · ${session.room}',
                        style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}
