# Emerald Summit '27

The companion mobile app (iOS + Android) for **Emerald Summit '27** — the
Tri-Valley's student-run STEAM summit at Emerald High, Dublin CA
(January 2027). Built with Flutter.

> **Status: UI skeleton + auth live.** All screens and interactions work; most
> run on in-memory **sample data**, but the **News** feed reads live from
> **Supabase**, and **passwordless email sign-in (OTP) + role-based accounts**
> are **built and tested end-to-end** (sign-up → onboarding → app). Next up:
> moving per-user data (schedules) into Supabase. Push notifications and
> server-side PDF generation (spec section 05) are still to come.

## What's implemented
Five-tab app matching the spec's core participant features:

- **My Day** — the participant's personal schedule, built from sessions they
  add. Empty-state → browse flow.
- **Discover** — catalog of the six disciplines → each discipline's sessions →
  a rich session "marketing page." **Add to my day** enforces the real rules:
  no double-booking (time-conflict dialog) and capacity caps (full/waitlist).
- **News** — the announcements feed (pinned items, audience tags). Reads
  **live from Supabase** (`announcements` table) with pull-to-refresh; falls
  back to sample data when the backend isn't configured. Each announcement is
  *designed* to also fire a **push notification** to its audience — not built
  yet (see Roadmap).
- **Resources** — searchable document hub.
- **Profile** — contact card with role badge, notifications toggle, sign-out,
  and volunteer hours with a "Download certificate" action.

**Accounts & sign-in** (live when Supabase is configured):
- **Passwordless email OTP.** A user enters their email, gets a numeric code,
  and types it in — no password is ever created or stored. First-time sign-in
  creates the account. In sample mode (no backend) the app skips auth and opens
  straight to the demo data.
- **Role-based onboarding.** First run collects name + **role** (participant,
  ambassador, expert, parent, organizer), then asks **role-specific** details:
  ambassadors get the full contact/emergency-contact questionnaire; experts are
  kept light (org + expertise only). Fields are declared per role in
  [lib/models/user_profile.dart](lib/models/user_profile.dart), so the sign-up
  flow customizes itself.
- **The account is tied to the email**, not the device. The session persists
  across app restarts and auto-refreshes; signing in on another device (or
  after reinstalling) pulls the same profile, role, and data back down. Only
  deleting the app forces a fresh sign-in. This is also what makes the later
  **switch from OTP to Google seamless** — same email → same account.

Brand colors and type follow spec section 03 (Emerald `#0C7A55`, Deep Emerald
`#0A5F43`, Ink `#16211C`, Mist `#EEF5F1`, system fonts).

## Project layout
```
lib/
  main.dart                 App entry + MaterialApp/theme
  theme.dart                Brand palette & Material 3 theme
  app_state.dart            In-memory state (schedule, toggles) + signed-in profile
  models/models.dart        Discipline, Session, Announcement, ResourceDoc
  models/user_profile.dart  UserProfile + SummitRole + per-role onboarding fields
  data/sample_data.dart     Placeholder content (swap for backend later)
  data/profile_repository.dart  Read/write the signed-in user's profile row
  screens/
    root_nav.dart           Bottom navigation shell
    auth/
      auth_gate.dart        Routes sign-in → onboarding → app
      sign_in_screen.dart   Passwordless email OTP
      onboarding_screen.dart  Name + role + role-specific details
    schedule_screen.dart    My Day
    discover_screen.dart    Six disciplines
    discipline_screen.dart  Sessions in a discipline
    session_detail_screen.dart  Marketing page + add/remove
    announcements_screen.dart
    resources_screen.dart
    profile_screen.dart
test/widget_test.dart       Widget tests
```

## Backend
- **Supabase** (hosted Postgres + auth + storage) is the chosen backend
  (Firebase was considered; Supabase won). Client via `supabase_flutter`.
- **Live now:**
  - The `announcements` table feeds the News tab (read-only, behind a
    public-read RLS policy). Schema in
    [supabase/announcements_setup.sql](supabase/announcements_setup.sql).
  - **Auth + `profiles` table.** Email OTP via Supabase Auth; each account gets
    a `profiles` row (`id` = `auth.users.id`, plus `full_name`, `role`, a
    `details` jsonb bag for role-specific answers, `onboarded`). RLS scopes every
    row to `auth.uid()` so users only ever touch their own profile; a trigger
    auto-creates the row on sign-up. Schema + required dashboard steps in
    [supabase/profiles_setup.sql](supabase/profiles_setup.sql).
    - **Custom SMTP is required** for OTP and is **configured** (Google
      Workspace, sending from the org address). Hard-won setup notes:
      - New free-tier projects can only edit email templates once custom SMTP
        is on (also needed for production — the built-in email service is
        test-only and rate-limited).
      - Gmail/Workspace SMTP needs an **App Password** (2-Step Verification on),
        pasted **without spaces**, and the **sender address must equal the
        authenticated account** or Gmail rejects with a `535`/sender error.
      - **Edit BOTH email templates** to include `{{ .Token }}`: **"Confirm
        signup"** is what *new* users get on first sign-in; **"Magic Link"** is
        what *returning* users get. Editing only one leaves the other path
        emailing a bare link with no code.
      - Set **Email OTP Length** (Auth → Providers → Email) to **6**; the app's
        code field tolerates up to 10 so a mismatch never truncates silently.
  - App-side auth lives in [lib/screens/auth/](lib/screens/auth/) (`auth_gate`
    routes sign-in → onboarding → app) with [lib/data/profile_repository.dart](lib/data/profile_repository.dart).
- Note the dev project has "auto-expose new tables" **off**, so every table's
  SQL must `grant` privileges to the right role explicitly (`anon` for public
  reads, `authenticated` for per-user tables).
- **Keys:** use the **publishable** key (`sb_publishable_…`), not the deprecated
  anon key; never the secret / `service_role` key in the app.
- Separate Supabase projects for **dev/testing** and **production** (prod added
  later; the free tier allows two).

## Configuration (Supabase keys)
Secrets are **not** stored in source. Real values live in a gitignored
`env.json`, injected at build time. To set up:

```bash
cp env.example.json env.json     # then edit env.json with your real values
```

Fill in your **Project URL** and **publishable key** (Supabase → Settings →
API). `env.json` is gitignored; `env.example.json` is the committed template.
Never put a `secret` / `service_role` key in either file — it must not ship in
a client app.

Without `env.json` (or the flag below) the app runs on local **sample data**.

## Run it locally
```bash
flutter pub get
flutter run --dart-define-from-file=env.json      # choose a device when prompted
```

> The `--dart-define-from-file=env.json` flag applies to **every** build/run
> command that should talk to the backend — `flutter run`, `flutter build apk`,
> `flutter build ipa`, etc. Omit it and the app falls back to sample data.
> In Android Studio/VS Code, add it under the run configuration's
> "Additional args" so it's automatic.

## Test & analyze
```bash
flutter test
flutter analyze
```

## Deploy to TestFlight
See [TESTFLIGHT.md](TESTFLIGHT.md). Bundle ID: `com.emeraldsummit.emeraldSummit`.

## Milestones
- ✅ **UI skeleton** — all five tabs and interactions on sample data.
- ✅ **First backend read** — News feed live from Supabase.
- ✅ **Auth & accounts** — passwordless email OTP + role-based onboarding,
  tested end-to-end. *(done)*
- ⏳ **Next: per-user data in Supabase** — move the schedule ("My Day") and the
  sessions/disciplines catalog out of in-memory sample data into Supabase
  tables, with a `user_sessions` join table (user ↔ session) behind RLS keyed
  to `auth.uid()`. This delivers the payoff of having accounts: a user's
  schedule follows them across devices and re-installs, and capacity counts
  become real/shared instead of local. Natural follow-on: enable **Realtime**
  so schedules and the News feed update without a manual refresh.

## Roadmap (later, from the spec)
- **Google sign-in** — add the **native** flow (`google_sign_in` →
  `supabase.auth.signInWithIdToken`) alongside the existing OTP. Native avoids
  custom URL schemes/deep links; it needs Google Cloud OAuth client IDs (iOS
  bundle ID, Android package + SHA-1) and the Supabase Google provider enabled.
  Because accounts are keyed to email, users keep the same profile/data when
  they switch from OTP to Google — Supabase auto-links identities that share a
  confirmed email (OTP and Google both produce one), so no extra config needed.
- **Per-role data & permissions** — use `profiles.role` in RLS policies so each
  role sees the right data (e.g. ambassadors' contact info, organizer-only
  screens). Onboarding already captures the role.
- **Push notifications** — every announcement fans out to a push notification
  (and email) for its audience; plus per-user "next session" reminders.
- **Realtime** — live-update the News feed as announcements are inserted, so no
  manual refresh is needed.
- Team formation; spectator seats; check-in dashboard; pre-summit milestone
  reminders; sponsor blocks; post-event social posts; server-rendered
  certificate / feedback PDFs.

## Android (later)
The `android/` project is scaffolded. Building it needs the Android SDK
(install Android Studio, then `flutter doctor`). Then `flutter run -d android`.
