import 'package:flutter/material.dart';

import '../data/sample_data.dart';
import '../models/models.dart';
import '../theme.dart';
import 'discipline_screen.dart';

/// "Discover" tab — a browsable catalog of all six disciplines
/// (spec section 04 — Build your own schedule).
class DiscoverScreen extends StatelessWidget {
  const DiscoverScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Discover')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Six disciplines',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            'Tap a discipline to explore its sessions and add them to '
            'your day.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            // Slightly taller cards give the two-line names + tagline room to
            // breathe on iOS, where the system font is wider than Android's.
            childAspectRatio: 0.80,
            children: [
              for (final d in SampleData.disciplines)
                _DisciplineCard(discipline: d),
            ],
          ),
        ],
      ),
    );
  }
}

class _DisciplineCard extends StatelessWidget {
  const _DisciplineCard({required this.discipline});
  final Discipline discipline;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => DisciplineScreen(discipline: discipline),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              CircleAvatar(
                backgroundColor: EmeraldTheme.mist,
                child: Icon(discipline.icon, color: theme.colorScheme.primary),
              ),
              const SizedBox(height: 12),
              Text(
                discipline.name,
                style: theme.textTheme.titleMedium,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                discipline.tagline,
                style: theme.textTheme.bodySmall,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 8),
              Text(
                '${discipline.sessions.length} '
                'session${discipline.sessions.length == 1 ? '' : 's'}',
                style: theme.textTheme.labelMedium
                    ?.copyWith(color: theme.colorScheme.primary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
