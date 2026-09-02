import 'package:flutter/material.dart';

import '../data/sample_data.dart';
import '../models/models.dart';

/// "Resources" tab — a searchable document library (spec section 04 —
/// Resources hub).
class ResourcesScreen extends StatefulWidget {
  const ResourcesScreen({super.key});

  @override
  State<ResourcesScreen> createState() => _ResourcesScreenState();
}

class _ResourcesScreenState extends State<ResourcesScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final results = SampleData.resources
        .where((r) =>
            r.title.toLowerCase().contains(_query.toLowerCase()) ||
            r.category.toLowerCase().contains(_query.toLowerCase()))
        .toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Resources')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              onChanged: (v) => setState(() => _query = v),
              decoration: InputDecoration(
                hintText: 'Search documents…',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          Expanded(
            child: results.isEmpty
                ? const Center(child: Text('No documents match your search.'))
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: results.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) =>
                        _ResourceTile(doc: results[i]),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ResourceTile extends StatelessWidget {
  const _ResourceTile({required this.doc});
  final ResourceDoc doc;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
        child: Icon(doc.icon, color: Theme.of(context).colorScheme.primary),
      ),
      title: Text(doc.title),
      subtitle: Text(doc.category),
      trailing: const Icon(Icons.download_outlined),
      onTap: () {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(content: Text('Opening "${doc.title}"…')),
          );
      },
    );
  }
}
