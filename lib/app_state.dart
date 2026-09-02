import 'package:flutter/foundation.dart';

import 'data/sample_data.dart';
import 'models/models.dart';

/// Result of trying to add a session to the day plan.
enum AddOutcome { added, removed, conflict, full }

class AddResult {
  const AddResult(this.outcome, [this.conflictingTitle]);
  final AddOutcome outcome;
  final String? conflictingTitle;
}

/// Simple app-wide state for the skeleton. In production this would be
/// backed by the Supabase/Firebase layer (spec section 05); here it lives
/// in memory so the UI and buttons are fully interactive.
class AppState extends ChangeNotifier {
  final Set<String> _mySessionIds = {};
  bool notificationsEnabled = true;

  // Demo profile — the signed-in user (spec: role picked on launch).
  String userName = 'Alex Rivera';
  String userRole = 'Participant';
  double volunteerHours = 6.5;

  List<Session> get mySessions {
    final list = SampleData.allSessions
        .where((s) => _mySessionIds.contains(s.id))
        .toList()
      ..sort((a, b) => a.startMinutes.compareTo(b.startMinutes));
    return list;
  }

  bool isRegistered(String id) => _mySessionIds.contains(id);

  /// Toggles a session in the plan, enforcing capacity and no-overlap
  /// rules (spec section 04 — the builder won't let you stack two
  /// sessions in the same time block or join a full track).
  AddResult toggle(Session session) {
    if (_mySessionIds.contains(session.id)) {
      _mySessionIds.remove(session.id);
      notifyListeners();
      return const AddResult(AddOutcome.removed);
    }
    if (session.isFull) {
      return const AddResult(AddOutcome.full);
    }
    for (final s in mySessions) {
      if (s.overlaps(session)) {
        return AddResult(AddOutcome.conflict, s.title);
      }
    }
    _mySessionIds.add(session.id);
    notifyListeners();
    return const AddResult(AddOutcome.added);
  }

  void setNotifications(bool value) {
    notificationsEnabled = value;
    notifyListeners();
  }
}

/// Global instance used throughout the skeleton.
final appState = AppState();
