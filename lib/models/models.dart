import 'package:flutter/material.dart';

/// One of the six STEAM disciplines at the summit (spec section 04).
class Discipline {
  const Discipline({
    required this.id,
    required this.name,
    required this.tagline,
    required this.icon,
    required this.sessions,
  });

  final String id;
  final String name;
  final String tagline;
  final IconData icon;
  final List<Session> sessions;
}

/// A single session/activity a participant can add to their day plan.
class Session {
  const Session({
    required this.id,
    required this.title,
    required this.disciplineName,
    required this.track,
    required this.room,
    required this.expertName,
    required this.start,
    required this.end,
    required this.capacity,
    required this.enrolled,
    required this.description,
    this.sponsor,
  });

  final String id;
  final String title;
  final String disciplineName;
  final String track;
  final String room;
  final String expertName;
  final String start; // "HH:mm" 24h
  final String end; // "HH:mm" 24h
  final int capacity;
  final int enrolled;
  final String description;
  final String? sponsor;

  bool get isFull => enrolled >= capacity;
  int get seatsLeft => capacity - enrolled;

  int get startMinutes => _toMinutes(start);
  int get endMinutes => _toMinutes(end);

  /// True if this session's time block overlaps [other]'s.
  bool overlaps(Session other) =>
      startMinutes < other.endMinutes && other.startMinutes < endMinutes;

  String get timeLabel => '${_display(start)} – ${_display(end)}';

  static int _toMinutes(String hhmm) {
    final parts = hhmm.split(':');
    return int.parse(parts[0]) * 60 + int.parse(parts[1]);
  }

  static String _display(String hhmm) {
    final parts = hhmm.split(':');
    var h = int.parse(parts[0]);
    final m = parts[1];
    final period = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h == 0) h = 12;
    return '$h:$m $period';
  }
}

/// Announcement feed item (spec section 04 — Announcements).
class Announcement {
  const Announcement({
    required this.id,
    required this.title,
    required this.body,
    required this.author,
    required this.audience,
    required this.timeAgo,
    this.pinned = false,
  });

  final String id;
  final String title;
  final String body;
  final String author;
  final String audience;
  final String timeAgo;
  final bool pinned;

  /// Builds an [Announcement] from a Supabase row. Columns map 1:1 except
  /// [timeAgo], which is derived from the `created_at` timestamp.
  factory Announcement.fromMap(Map<String, dynamic> row) {
    return Announcement(
      id: row['id'].toString(),
      title: (row['title'] ?? '') as String,
      body: (row['body'] ?? '') as String,
      author: (row['author'] ?? 'Summit') as String,
      audience: (row['audience'] ?? 'Everyone') as String,
      pinned: (row['pinned'] ?? false) as bool,
      timeAgo: _relativeTime(row['created_at'] as String?),
    );
  }

  static String _relativeTime(String? iso) {
    if (iso == null) return '';
    final then = DateTime.tryParse(iso);
    if (then == null) return '';
    final diff = DateTime.now().difference(then);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}

/// A document in the resources hub (spec section 04 — Resources hub).
class ResourceDoc {
  const ResourceDoc({
    required this.id,
    required this.title,
    required this.category,
    required this.icon,
  });

  final String id;
  final String title;
  final String category;
  final IconData icon;
}
