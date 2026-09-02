import 'package:flutter/material.dart';

import '../app_state.dart';
import '../models/models.dart';
import '../theme.dart';

/// The rich "marketing page" for a single session, with the primary
/// action to add/remove it from the day plan. Enforces the schedule
/// rules (spec section 04): no double-booking, capacity caps.
class SessionDetailScreen extends StatelessWidget {
  const SessionDetailScreen({super.key, required this.session});
  final Session session;

  void _onToggle(BuildContext context) {
    final result = appState.toggle(session);
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    switch (result.outcome) {
      case AddOutcome.added:
        messenger.showSnackBar(
          SnackBar(content: Text('Added "${session.title}" to your day')),
        );
      case AddOutcome.removed:
        messenger.showSnackBar(
          SnackBar(content: Text('Removed "${session.title}" from your day')),
        );
      case AddOutcome.full:
        _showBlockedDialog(
          context,
          'Session full',
          'This session has reached its capacity of ${session.capacity}. '
              'You can still join the waitlist on the day.',
        );
      case AddOutcome.conflict:
        _showBlockedDialog(
          context,
          'Time conflict',
          'This overlaps with "${result.conflictingTitle}", which is '
              'already on your schedule. Remove that one first to add this.',
        );
    }
  }

  void _showBlockedDialog(BuildContext context, String title, String body) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(session.disciplineName)),
      body: ListenableBuilder(
        listenable: appState,
        builder: (context, _) {
          final registered = appState.isRegistered(session.id);
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
            children: [
              Text(session.track.toUpperCase(),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.primary,
                    letterSpacing: 1,
                  )),
              const SizedBox(height: 6),
              Text(session.title, style: theme.textTheme.headlineSmall),
              const SizedBox(height: 16),
              _InfoRow(icon: Icons.schedule, text: session.timeLabel),
              _InfoRow(icon: Icons.place, text: session.room),
              _InfoRow(
                  icon: Icons.person, text: 'Expert: ${session.expertName}'),
              _InfoRow(
                icon: Icons.groups,
                text: session.isFull
                    ? 'Full (${session.enrolled}/${session.capacity})'
                    : '${session.seatsLeft} of ${session.capacity} seats left',
              ),
              const SizedBox(height: 20),
              Text('About this session', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(session.description, style: theme.textTheme.bodyLarge),
              if (session.sponsor != null) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: EmeraldTheme.mist,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.handshake,
                          size: 18, color: theme.colorScheme.primary),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(session.sponsor!,
                            style: theme.textTheme.bodyMedium),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 28),
              FilledButton.icon(
                onPressed: () => _onToggle(context),
                style: registered
                    ? FilledButton.styleFrom(
                        backgroundColor: theme.colorScheme.errorContainer,
                        foregroundColor: theme.colorScheme.onErrorContainer,
                      )
                    : null,
                icon: Icon(registered ? Icons.remove_circle : Icons.add),
                label: Text(
                    registered ? 'Remove from my day' : 'Add to my day'),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: theme.textTheme.bodyMedium)),
        ],
      ),
    );
  }
}
