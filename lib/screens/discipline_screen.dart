import 'package:flutter/material.dart';

import '../app_state.dart';
import '../models/models.dart';
import 'session_detail_screen.dart';

/// Lists the sessions within one discipline.
class DisciplineScreen extends StatelessWidget {
  const DisciplineScreen({super.key, required this.discipline});
  final Discipline discipline;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(discipline.name)),
      body: ListenableBuilder(
        listenable: appState,
        builder: (context, _) => ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: discipline.sessions.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, i) =>
              _SessionTile(session: discipline.sessions[i]),
        ),
      ),
    );
  }
}

class _SessionTile extends StatelessWidget {
  const _SessionTile({required this.session});
  final Session session;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final registered = appState.isRegistered(session.id);
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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(session.title,
                        style: theme.textTheme.titleMedium),
                  ),
                  if (registered)
                    Icon(Icons.check_circle,
                        color: theme.colorScheme.primary, size: 20),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  _MetaChip(icon: Icons.schedule, label: session.timeLabel),
                  _MetaChip(icon: Icons.place, label: session.room),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                session.isFull
                    ? 'Full · waitlist only'
                    : '${session.seatsLeft} seats left',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: session.isFull
                      ? theme.colorScheme.error
                      : theme.colorScheme.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(width: 4),
        Text(label, style: theme.textTheme.bodySmall),
      ],
    );
  }
}
