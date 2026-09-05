import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Session;

import 'data/profile_repository.dart';
import 'data/sample_data.dart';
import 'models/models.dart';
import 'models/user_profile.dart';

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
  double volunteerHours = 6.5;

  // ---- Signed-in user ------------------------------------------------------
  // When Supabase is configured, [profile] is loaded from the backend after
  // sign-in. In sample mode (no backend) it stays null and the demo values
  // below are shown instead, so the UI skeleton still runs standalone.
  UserProfile? profile;
  bool profileLoading = false;

  static const String _demoName = 'Alex Rivera';
  static const String _demoRole = 'Participant';

  String get userName =>
      (profile?.fullName.isNotEmpty ?? false) ? profile!.fullName : _demoName;

  String get userRole => profile != null ? profile!.role.label : _demoRole;

  bool get isOnboarded => profile?.onboarded ?? false;

  /// Loads the signed-in user's profile from Supabase. Called by the auth
  /// gate once a session exists.
  Future<void> loadProfile() async {
    profileLoading = true;
    notifyListeners();
    try {
      profile = await ProfileRepository.fetchMine();
    } finally {
      profileLoading = false;
      notifyListeners();
    }
  }

  /// Saves the finished onboarding profile and marks the user onboarded, so
  /// the auth gate moves them into the app.
  Future<void> completeOnboarding(UserProfile updated) async {
    updated.onboarded = true;
    await ProfileRepository.save(updated);
    profile = updated;
    notifyListeners();
  }

  /// Signs the user out and clears their in-memory state.
  Future<void> signOut() async {
    await Supabase.instance.client.auth.signOut();
    profile = null;
    _mySessionIds.clear();
    notifyListeners();
  }

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
