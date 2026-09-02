# Emerald Summit '27

The companion mobile app (iOS + Android) for **Emerald Summit '27** — the
Tri-Valley's student-run STEAM summit at Emerald High, Dublin CA
(January 2027). Built with Flutter.

> **Status: UI skeleton.** All screens, navigation, and interactions work
> against in-memory **sample data**. The Supabase/Firebase backend, auth,
> push notifications, and server-side PDF generation described in the spec
> (section 05) are the next phase and are not wired up yet.

## What's implemented
Five-tab app matching the spec's core participant features:

- **My Day** — the participant's personal schedule, built from sessions they
  add. Empty-state → browse flow.
- **Discover** — catalog of the six disciplines → each discipline's sessions →
  a rich session "marketing page." **Add to my day** enforces the real rules:
  no double-booking (time-conflict dialog) and capacity caps (full/waitlist).
- **News** — the announcements feed, with pinned items and audience tags.
- **Resources** — searchable document hub.
- **Profile** — contact card with role badge, notifications toggle, and
  volunteer hours with a "Download certificate" action.

Brand colors and type follow spec section 03 (Emerald `#0C7A55`, Deep Emerald
`#0A5F43`, Ink `#16211C`, Mist `#EEF5F1`, system fonts).

## Project layout
```
lib/
  main.dart                 App entry + MaterialApp/theme
  theme.dart                Brand palette & Material 3 theme
  app_state.dart            In-memory state (schedule, toggles) + rules
  models/models.dart        Discipline, Session, Announcement, ResourceDoc
  data/sample_data.dart     Placeholder content (swap for backend later)
  screens/
    root_nav.dart           Bottom navigation shell
    schedule_screen.dart    My Day
    discover_screen.dart    Six disciplines
    discipline_screen.dart  Sessions in a discipline
    session_detail_screen.dart  Marketing page + add/remove
    announcements_screen.dart
    resources_screen.dart
    profile_screen.dart
test/widget_test.dart       Widget tests
```

## Run it locally
```bash
flutter pub get
flutter run                 # choose a device when prompted
```

## Test & analyze
```bash
flutter test
flutter analyze
```

## Deploy to TestFlight
See [TESTFLIGHT.md](TESTFLIGHT.md). Bundle ID: `com.emeraldsummit.emeraldSummit`.

## Roadmap (from the spec, not yet built)
Backend on Supabase/Firebase with row-level security by role; magic-link /
Google auth; team formation; spectator seats; expert & parent roles;
check-in dashboard; pre-summit milestone reminders; sponsor blocks;
post-event social posts; server-rendered certificate/feedback PDFs.

## Android (later)
The `android/` project is scaffolded. Building it needs the Android SDK
(install Android Studio, then `flutter doctor`). Then `flutter run -d android`.
