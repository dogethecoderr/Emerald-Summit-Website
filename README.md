# Emerald Summit — Web Prototype 🐉

A React web app used to **test, visualize, and integrate features** for the Emerald Summit — the Tri-Valley's largest student-run STEAM summit.

> **This is not the production app.** The app actually used at the Emerald Summit is a **separate, standalone Flutter mobile app** (iOS + Android), maintained in its own repository. That Flutter app is the real product. **This repository is a web version** — a fast, browser-based environment for prototyping UX, visualizing ideas, and integrating/testing features (and the shared backend) before they are built into the mobile app. The two codebases are independent.

| | |
|---|---|
| **Event** | Emerald Summit '27 |
| **When** | Saturday, January 23, 2027 |
| **Where** | Emerald High, Dublin CA |
| **This repo** | Web prototype — testing, visualization, and feature integration |
| **Production app** | Separate Flutter mobile app (iOS + Android), in its own repo |
| **Backend** | Shared with the app: Supabase project `dgrskmykbkvphnaasfzl`, owned by the app repo |
| **Owner** | EHS Academic Foundation · EAF Tech Team |

---

## Why this repo exists

The Emerald Summit runs corporate-style and is driven entirely by students, with six disciplines, 20+ tracks, and 30+ visiting experts across a high-school campus. It is not a competition: students come to share project ideas, work on them together, and get feedback from the experts. The website's copy follows that, with no competing, judging, winners or awards. The production experience is a native mobile app, but iterating on native is slow.

This web version gives the team a place to move fast:

- **Prototype UX quickly** in the browser with instant hot-reload
- **Visualize features** (schedule builder, announcements, directory, expert sessions, dashboards) end to end
- **Integrate and test the shared Supabase backend** — auth, roles, row-level security, and migrations — against a real UI
- **Validate the design system and flows** before the corresponding work is built into the Flutter app

Feature work and data models are prototyped here and then carried over into the mobile app.

---

## Tech stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui** (Radix primitives) — the "Emerald Mist" design system
- **Phosphor icons** (`@phosphor-icons/react`), duotone everywhere like the app's `duotone_icon.dart`. Every icon comes from `src/components/icons.tsx`; import from there, not from the package.
- **framer-motion** for the animated landing/intro
- **React Router** for routing
- **@hello-pangea/dnd** for the drag-and-drop schedule builder
- **Supabase** (`@supabase/supabase-js`) for auth + Postgres + row-level security
- **Vitest** + **React Testing Library** + **jsdom** for component tests

---

## Roles

Roles are the app's roles, stored in `profiles.role` on the shared backend. The website shows some of them under older names (`src/models/roles.ts`, `storedRole` and `profileFromRow` in `src/services/auth.ts` translate):

| Stored role | Website label | Who |
|---|---|---|
| `participant` | Participant | Students who bring a project or present. Anyone can pick it. |
| `parentSpectator` | Attendee | Parents and spectators. Adding a session always spectates. |
| `expert` | Expert | Judges and speakers. Picking it sets `expert_status = pending` until an admin approves (`review_expert`, on the website's Expert approvals page or in the app). |
| `volunteer` | Volunteer | Only if the email is on the Allowed Volunteers sheet. `volunteer_subtype` (`eaf_ambassador`, `student_volunteer`, `parent_volunteer`) and the `can_*` flags come from the sheet. |
| `admin` | Admin | Only if the email is on the Allowed Admins sheet. |

**Ambassador isn't a role.** An EAF ambassador is a volunteer whose subtype is `eaf_ambassador`. The website still lists Ambassador in `USER_ROLES` so labels read right, but nobody signs in as one.

The server owns `role`, `volunteer_subtype`, `managed_disciplines`, the `can_*` flags and `expert_status`. A trigger puts `role` back to `participant` unless the allowlist allows it, so after writing a role the website re-reads the profile to see what was kept.

---

## Getting started

### Prerequisites

- **Node.js 18+**
- The shared backend's URL and **publishable** key: copy `.env.example` to `.env.local` and ask Arjun for the key (it's the same one the app's `env.json` uses). Never put the secret or `service_role` key in `.env*` or in Vercel: every `VITE_*` value ships to every visitor. Without the keys, nobody can sign in; the public pages still work.

**There is no demo mode.** It used to make a fake local session that never reached the database; on the shared backend that only showed screens whose data never loads, so it was removed. Use a test account (below) instead. Any `bypass_*` keys an older build left in a browser are cleared when the site loads.

### Run the app

```bash
npm install
npm run dev
```

Then open the printed local URL (Vite defaults to `http://localhost:5173`).

### Test accounts

Test accounts sign in with a shared password instead of an emailed code, like the app's dev builds. The switch is in code, `isDevLoginEnabled` in `src/lib/devLogin.ts`, not a Vercel variable, so nobody has to change the deploy settings. It's `true`, the live site included, because every test account still needs the password and the site isn't marketed widely yet. To turn it off, set it to `false` and push to `main`. A real email never sees a password box: the function only says `test: true` for emails on its test list.

1. Type the test account's email in the normal email box and press **Send sign-in code**. The page first asks the shared `dev-login` Edge Function whether it's a test account (`check: true`). If not, or if the call fails, a normal code is sent.
2. For a test account, a password box appears instead. The function checks the password and returns a one-time code, which the page verifies, so it's a real Supabase session.
3. The account skips role picking, like `_autoOnboardTestAccount` in the app: admin if on the admin list, else volunteer if on the volunteer list, else from the email (`expert`, `spectator` or `parent`, otherwise participant). A toast says which role it got.

The password is never stored (not in `localStorage`, the URL, the repo or Vercel). People type it. After five wrong passwords in a row, the browser stops asking for 15 minutes ("Too many wrong passwords. Try again in N minutes.") without calling the function; a right password resets the count. That only slows someone typing into the page. The real lockout is in the `dev-login` function (app repo, `dev_login_lockout.sql`): 5 wrong passwords from one address in 15 minutes, or 50 from anywhere in an hour, and it answers `429`, which the page shows as "Too many wrong passwords. Try again later." Each wrong password there also waits 1.5 seconds. The test accounts and the password are set up in the app repo (SUPABASE.md §3b). Code: `isTestAccount`, `signInWithTestAccount` and `autoOnboardTestAccount` in `src/services/auth.ts`, the password step in `src/pages/LoginPage.tsx`, the flag in `src/lib/devLogin.ts`.

The dev server honours a `PORT` environment variable, so a second instance — another checkout, or a teammate's session on the same machine — can run alongside the first instead of colliding on 5173:

```bash
PORT=5174 npm run dev
```

### Google sign-in

The website uses **Google's own sign-in button** (Google Identity Services), the same kind of sign-in as the app's native Google button. Google's popup gives the page a signed ID token, and the page hands it to Supabase with `signInWithIdToken`. Nothing leaves the site, and Google's popup names **this website**, not the Supabase project URL. Supabase links identities by verified email, so **Google (website or app) and the emailed code reach the same account and the same data**.

- Code: `src/lib/googleIdentity.ts` loads Google's script and holds the client ID; `src/components/GoogleSignInButton.tsx` draws the button; `signInWithGoogleIdToken` in `src/services/auth.ts` finishes it. A random nonce goes to Google hashed (SHA-256) and to Supabase raw, so a token can't be reused from another sign-in.
- Client: the app's **Web** OAuth client `665674617320-97u477dvell0tsalugj3i3p7eifkk7qr` (the app's `GOOGLE_WEB_CLIENT_ID`) in Google Cloud project `inspiring-chess-491023-g8` (number `665674617320`). Client IDs are public, so it's in code.
- **Every address that shows the button must be under that Web client's *Authorized JavaScript origins*** in Google Cloud. `https://emerald-summit.vercel.app` is there. To try Google sign-in locally, add `http://localhost` and `http://localhost:5173` too. A new domain (say `emeraldsummit.org`) needs adding before it goes live, and the popup will then show that domain.
- Supabase's Google provider must list the Web client in *Client IDs* (it does, first, followed by the Android `…igtl…` and iOS `…khls…` IDs the app needs). Supabase rejects a token whose audience isn't on that list.
- **Fallback:** if Google's script can't load (an ad blocker, a network filter), the page shows its own "Continue with Google" button, which uses the older redirect sign-in (`signInWithOAuth`, website → Supabase → Google → back). That route shows Google the Supabase URL and needs: the Supabase callback `https://dgrskmykbkvphnaasfzl.supabase.co/auth/v1/callback` under the Web client's *Authorized redirect URIs*, the Web client's secret in Supabase, Site URL `https://emerald-summit.vercel.app`, and `https://emerald-summit.vercel.app/**` in Supabase's Redirect URLs. All of that was set up on 2026-11-11.
- If a redirect sign-in comes back with an error, the roles page says so ("Google sign-in didn't finish (…)", `takeOAuthError`). If Supabase refuses a token from the button, a toast says why and the button resets.

**History (fixed 2026-11-11):** Google sign-in on Vercel failed because Supabase's *Client IDs* listed the Android client first (the redirect flow always sends the first one, and Android clients can't hold redirect URIs), and the Site URL was still `http://localhost:3000` with the Vercel address not on the redirect list.

### Scripts

```bash
npm run dev       # Start the Vite dev server
npm run build     # Type-check (tsc) and build for production
npm run preview   # Preview the production build locally
npm run test      # Run the Vitest component tests
```

Tests never reach a real Supabase project: any test that renders a check-in path mocks `src/lib/supabase` (with a fake client, or `null` for the offline mock roster), since `.env` would otherwise point it at the live backend.

---

## Project structure

```
src/
├── main.tsx              # App entry point
├── App.tsx               # Routes (React Router)
├── pages/                # Route-level pages (Home, Schedule, Discover, Announcements, Archie, session pages, admin tools, …)
├── components/           # Shared UI, including shadcn/ui primitives in components/ui
├── context/              # React context providers (Auth, Schedule, Announcements)
├── hooks/                # Reusable hooks (e.g. useRequireProfile)
├── models/               # Domain models (roles, disciplines, sessions, people, …)
├── services/             # Backend integration (auth, announcements, approvals)
└── index.css             # Tailwind + design-system globals

apps-script/              # Old Google Apps Script for the expert sign-up sheet (no longer called)
```

> The `.agents/` folder is a collaborator's Google Antigravity agent workspace and is unrelated to the web app — see `.agents/README.md`.

---

## Backend

The website uses the **app's** Supabase project (`dgrskmykbkvphnaasfzl`), so an account, a registration, an announcement or a check-in made on one shows up on the other. The app repo owns the schema, the policies, the RPCs and the Edge Functions. Its [app README (genzarjun/Emerald-Summit-App-MOBILE)](https://github.com/genzarjun/Emerald-Summit-App-MOBILE#website-sync-one-backend-for-the-app-and-the-website) section is the source of truth for this work. Read it before changing anything that talks to the database.

**Rules:**

- **No schema from this repo.** There is no `supabase/` folder here any more (it held the website's old project, `spsxfbvamwxsmtjkwxko`). Never run `supabase db push`, `db reset` or `link` against the shared project from this repo. A schema change is a new `.sql` file in the app repo's `supabase/`, run by Arjun.
- **Additive only.** The app on people's phones reads these columns. Never rename or drop a column or change what an RPC returns.
- **Write through the app's RPCs.** `register_for_session` (with `p_intent`), `set_session_manage`, `mark_session_attendance` and the rest. Several tables have no direct write grant on purpose.
- **RLS and the RPCs are the security.** If a call is refused, the website is doing something the app doesn't allow either. Match the app; don't ask for a looser policy.

**What the website reads and writes today:** `profiles` (own row), `disciplines` (catalog; admins also insert) and `sessions_with_counts`, `sessions` (editors, including `allow_eighth_graders` once that column exists), `registrations` and `session_volunteers` (schedule), `rooms`, `volunteer_hour_logs`, `expert_feedback`, `eaf_future_interest`, `announcements`, `announcement_reads` and `announcement_dismissals` plus the `announcement_attachments` bucket, the `session_photos` bucket (list for everyone; upload and delete for session editors) and `sessions.hero_image_url`, the `gallery_photos` bucket (Home slideshow, list only), `role_allowlist`, and these RPCs: registration (`register_for_session`, `update_my_registration`, `fetch_my_project`, `find_team`, `transfer_team_ownership`, `remove_team_member`, `session_experts`), organizing (`set_session_manage`, `fetch_session_roster`, `mark_session_attendance`, `remove_session_registration`, `allow_back_to_session`, `fetch_session_removals`, `fetch_session_volunteers`, `fetch_volunteers`, `assign_volunteer_to_session`, `preview_manager_assignment`, `assign_manager_replacing_conflicts`, `unassign_volunteer_from_session`, `session_time_conflicts`, `notify_session_time_conflicts`), admin (`fetch_expert_requests`, `review_expert`, `fetch_summit_metrics`), your own check-in status (`my_summit_checkin`), and `fetch_volunteer_hub`, `preview_role_change`, `acknowledge_expert_decline`, `submit_expert_feedback`, `set_eaf_future_interest`, `fetch_summit_status`, and the website switches on `summit_settings`.

**Not on the website yet:** Archie (the AI assistant and its insights page; the Archie tab shows "Coming soon", because every chat costs a Claude API call) and front-desk check-in (it scans QR passes with the phone camera, so Profile lists it as "Mobile app only"). Everything else the app does is here (checked Nov 13, 2026). Push notifications stay app-only; the website shows a banner instead (see **Announcements**).

---

## Sessions

Every session has a page at `/sessions/:id` (`src/pages/SessionPage.tsx`), ported from the app's session screen; session cards and schedule entries link to it, and a card's + opens it with the add choices.

- **Add to my day** offers each role the app's choices (`addModesForRole` in `src/models/registration.ts`): participants and volunteers participate or spectate, experts serve as an expert or spectate, admins can also manage the session, and parents and spectators are added as spectators straight away.
- **Participating** opens the registration form (`src/components/session/RegistrationForm.tsx`): solo or team, the project name (in the session's own wording), a team code to join or a new team to create, and the session's own questions. Registered participants see their project card with the team code and members, and can edit the registration, leave the team, transfer ownership or remove a member. A team owner with teammates picks a new owner before leaving or removing the session.
- **Organizer tabs.** Admins, the session's managers and its editors also get Participants and Experts (grouped by project, with attendance for admins and managers, and **Remove** for anyone who can see the list), Volunteers (admins assign and remove) and Metrics (schools and grades).
- **Photos.** The page's top photo is the session's hero, or its first photo when no hero is set, and every other photo sits in a **Gallery** strip under the page sections, as in the app. Signed-in people also get **Sessions similar to this** at the bottom: other sessions in the discipline that aren't on their day, aren't full and fit an open slot (`src/models/suggested.ts`, the app's `suggestedSessions`), each card showing its hero or first photo, with an Add that opens that session's choices.
- **Editing** (`src/components/verse/SharedSessionForm.tsx`) writes the app's fields: start and end, capacity, team size, participant deadline, **Let 8th graders participate**, the project question's wording, extra questions and page sections, plus a **Session page** block with the hero photo and gallery (`src/components/session/SessionPhotosEditor.tsx`). Moving a session's time warns about schedule clashes and notifies the people affected. Rooms stay locked (`SESSION_ROOMS_ENABLED` in `src/models/sessions.ts`), so the session page hides the room; lists still show it, as in the app.

**Session photos** (`src/services/sessionPhotos.ts`) work the way the app's do. Each session has a folder named after its id in the public `session_photos` bucket. Admins and the discipline's session editors can upload and delete there (Storage RLS from the app repo's `session_pages_setup.sql` checks `can_manage_discipline`, so anyone else is refused even with the editor open). In the editor:

- **Set hero photo** / **Replace** uploads a photo and makes it the hero; the choice is saved with **Save**, into `sessions.hero_image_url`. A replaced hero stays in the gallery.
- The **+** tile adds a photo to the gallery, and a photo's **×** deletes the file. Uploads and deletes happen straight away, not on Save.
- A brand-new session has no folder yet, so the block says "Save the session first, then reopen it to add photos."
- Photos are shrunk to 2000 px on the long edge as an 85% JPEG before upload, like the app (GIFs and anything the browser can't decode go up as they are), named `p_<millis>.jpg` so the folder sorts in upload order, and sent with a one-year `cacheControl`. The bucket takes JPEG, PNG, WebP, HEIC and GIF up to 10 MB.
- Every Storage image is lazy-loaded with a width and height, to keep within the free plan's egress.

**Managing replaces a clash.** A person does one thing at a time at the summit, and managing takes precedence. `assign_volunteer_to_session` and `set_session_manage` still refuse anyone who's busy at that time (the app relies on that), and the website then asks the admin whether to replace what the person was doing:

- In the **Volunteers** tab (`src/components/session/SessionVolunteers.tsx`), and in an admin's own **Add to my day → Manage this session** (`src/pages/SessionPage.tsx`), a refusal calls `preview_manager_assignment` and opens **Replace what they're doing?** (`src/components/session/ReplaceScheduleDialog.tsx`). It lists everything that comes off their day (`describeReplacement` in `src/services/organizer.ts`):
  - their sign-up for this same session: "Their sign-up to participate in this session. They'll manage it instead.";
  - a session at the same time they're signed up for, as a participant, spectator or expert;
  - a session at the same time they manage ("They'll stop managing it.");
  - what happens to their team: an owner's team passes to the teammate who joined first, teammates are told, and a team with no one else is deleted.
- **Assign and replace** (or **Manage instead** for the admin themself) calls `assign_manager_replacing_conflicts`, which removes those sign-ups and managed sessions and assigns them, all at once. The person gets one notice naming what was taken off their day; the old "You're managing …" notice for a session they stopped managing stays in their feed and bell as a dated record; an admin managing it themself gets none. Removed sign-ups aren't blocked, so they can sign up for those sessions again later.
- The SQL is the app repo's `volunteer_conflict_override.sql`, run on the shared project on Nov 13, 2026. On a backend without it, the preview call fails and the website shows the old refusal, so nothing breaks.
- The mobile app doesn't do this yet (it's on the app README's website to-do list).

**Making a signed-up volunteer the manager.** Admins can see which volunteers are already signed up for a session and make one its manager in a click, without the volunteer removing it from their day first. No new SQL: it uses `fetch_session_roster` (filtered to `role = 'volunteer'`), `preview_manager_assignment` and `assign_manager_replacing_conflicts` from above.

- The **Volunteers** tab (`src/components/session/SessionVolunteers.tsx`) shows admins a **Volunteers signed up for this session** list under the managers: each volunteer on the roster (participant, spectator or expert) with "Signed up as participant" (or spectator / expert) and a **Make manager** button. Volunteers who already manage it, and non-volunteers, aren't listed. Organizers and editors who aren't admins don't see it, and the roster isn't fetched for them.
- In the **Assign volunteer** picker, those volunteers come first with the same amber "Signed up as …" tag, and picking one goes to the same dialog instead of the refusal.
- **Make Sam Lee a manager?** (`src/components/session/MakeManagerDialog.tsx`) says "This will make them a manager of this session, and they will no longer be a participant of this session." (spectator / an expert for those types), then the team line from `describeTeamEffect` if they're on a team, then anything else at the same time that also comes off their day, then "They'll get a notice about the change." **Make manager** calls `assign_manager_replacing_conflicts`; the toast says "Sam Lee now manages this session and is off its roster. They've been told."
- On a backend without `volunteer_conflict_override.sql`, the preview fails and the old "They need to remove it from their day first" refusal shows.
- The app doesn't have this yet (app README to-do: **See and convert signed-up volunteers**).

**Removing someone from a session.** Anyone who can see a session's Participants and Experts tabs (admins, the volunteers assigned to it, and session editors for its discipline: `fetch_session_roster`'s gate) can take a person off it, e.g. an account that looks fake. It's in `src/components/session/SessionRoster.tsx`, with calls in `src/services/sessionRemovals.ts`; the SQL is the app repo's `session_participant_removal.sql`.

- Each roster row has a **Remove** button. The confirm dialog says what happens: they're taken off the session, get a "Removed from a session" notice in their feed, and can't sign up for it again. For a team member it adds that their teammates will be told; for a team owner, that the team passes to the teammate who joined first; and for the last one on a team, that the team is deleted too (the existing registration triggers do this, as when someone leaves).
- `remove_session_registration` deletes the registration (participant, spectator or expert) and records it in `session_removals`. A trigger on `registrations` then refuses a new sign-up with `removed_from_session`, which the session page shows as "An organizer removed you from this session, so you can't sign up for it again." You can't remove yourself.
- A **Removed** list at the bottom of the tab shows who was removed, by whom and when, with **Allow back**. That deletes the `session_removals` row; it doesn't re-register them.
- The mobile app doesn't have this yet (it's on the app README's website to-do list). `session_participant_removal.sql` was run on the shared project on Nov 13, 2026, so the buttons are live. The website still hides them whenever `fetch_session_removals` fails.

**8th graders.** Participating is for high schoolers. Each session has a **Let 8th graders participate** box in the editor (`sessions.allow_eighth_graders`, off by default), which admins and the discipline's session editors tick per session. Anyone can spectate any session; the box is only about participating.

- The grade comes from the sign-up answer (`profiles.details.grade`), read by `gradeLabel` in `src/models/metrics.ts` ("8", "8th" and "eighth" all count as 8).
- In **Add to my day**, an 8th grader sees **Participate** greyed out on a session without the box ("This session isn't open to 8th graders. You can spectate it."). Where it's ticked, they register like any high schooler, with nothing different on the page. Students in 7th grade or below can only spectate. Participants must give a grade at sign-up; a blank grade (other roles) isn't blocked. The rule is `participationGradeBlock` in `src/models/registration.ts`.
- The server enforces it too: `register_for_session` refuses with `eighth_grade_not_allowed` or `middle_school_not_allowed` (app repo, `eighth_grade_participation.sql`), and the website shows the same message as the greyed-out choice. Unticking the box later doesn't remove 8th graders who already registered.
- That SQL was run on the shared project on Nov 13, 2026. If the column is ever missing (a fresh backend), the editor's box is disabled ("Available once the Summit database is updated") and the website keeps every 8th grader to spectating; `hasEighthGradeColumn` in `src/services/summitContent.ts` checks for it.

**Profile menu** (`src/pages/SettingsPage.tsx`) has the app's items by role: Sessions I'm managing, Track volunteer hours (`/volunteer/hours`), Volunteer hub, Front desk check-in (shown, marked "Mobile app only"), Metrics (`/admin/metrics`), Expert approvals (`/admin/experts`), Manage rooms (`/admin/rooms`), Change role, and after the summit, Summit feedback or Volunteer for EAF again (`/follow-up`).

**Sign-up** (`src/pages/ProfileSetupPage.tsx`, `src/models/profileFields.ts`) asks each role the app's questions: participants pick a school from the Tri-Valley list and give a grade, experts give their expertise and a one-line bio, volunteers and admins give a mobile number. Under the participant's grade: "8th graders can participate in some sessions and spectate any of them. Middle schoolers must come with an adult." Parents and spectators get a note above their questions: "Curious minds of all ages are welcome. Middle schoolers and younger need a parent with them." A volunteer or admin with no number, or a student volunteer or EAF ambassador with no grade, is asked for it before going on. Changing role asks the new role's questions.

**Registration and session times switches.** Two columns on the shared `summit_settings` row turn website registration and session times on, without a deploy (`src/services/siteSwitches.ts`; the SQL is `website_switches.sql` in the app repo's `supabase/`). Both start `false`, and anything other than an explicit `true` (a missing column, a failed read) counts as off. The mobile app doesn't read them.

- `website_registration_open`: while false, "Add to my day" on session pages and the + on track pages are greyed out. Hovering shows "Registration will open on November 21st"; tapping shows the same message as a toast. Signing in, browsing verses, tracks and sessions, and editing or removing an existing registration still work. The server enforces it too: `register_for_session` refuses every new sign-up with the error `registration_closed` (app repo, `registration_closed_lock.sql`), which `toggleRegistration` shows as the same message. To change the date in the message, edit `REGISTRATION_CLOSED_MESSAGE` (and the hint in that SQL file).
- `website_show_session_times`: while false, session times, lengths and participant deadlines read "TBD" (Discover, track pages, session pages, My Day, Home, search, the volunteer pages), and Home has no countdown. The session editor still shows the real times.

To turn one on: `update public.summit_settings set website_registration_open = true;` (or `website_show_session_times`) in the SQL editor, or tick the box in Table Editor. People see it on their next page load.

**Summit date.** `fetch_summit_status()` (`src/services/summitStatus.ts`) gives the summit date, which stays null on the shared backend until the organizers set it. Until then the website uses its own `SUMMIT_DATE` (2027-01-23), so the Home hero shows "Sat, Jan 23" and a countdown to the first session, the same way the app's Home does, and volunteer hours count sessions on that day. A date set on the backend wins over it. The mobile app has its own date handling and is not affected. The public landing page states the date by hand: Saturday, January 23, 2027.

---

## Volunteer and admin allowlist

Who may be a volunteer or an admin comes from two Google Sheets, synced every minute into `role_allowlist` by the app repo's `sync-allowlist` Edge Function. A trigger on `profiles` then turns anyone who isn't listed back into a participant and copies each volunteer's subtype, disciplines and flags onto their row. The sheets, their columns and the sync are described in the app's README; nothing about them is set up from this repo.

**What each column does on the website.**

| Sheet | Effect |
|---|---|
| Subtype | Labels the person as EAF Ambassador, Student volunteer, or Parent volunteer in the sidebar, the top bar, and the Volunteer hub. |
| Disciplines | The disciplines whose sessions they can edit (with `can_edit_sessions`). |
| `can_check_in_front_desk` | Unlocks front-desk check-in in the mobile app (QR scanner and attendee list). The website only shows the item as "Mobile app only". |
| `can_edit_sessions` | Lets the person add, edit, and delete sessions in their disciplines (see **Editing sessions**). |
| `can_post_announcements` | Shown as a badge in the hub. |

Those flags only unlock the website's controls. The RPCs and row-level security check the same flags on the server.

**Testing it.** Use a test account (see **Test accounts**) or **Continue with Google**. A new account that picks Volunteer or Admin keeps that role only if its email is on the matching sheet; otherwise it's signed out with "You aren't eligible to sign up as a volunteer/an admin." A completed profile keeps its role when someone signs in from another role's page; Change role previews what happens to their sessions first, checks the allowlist for volunteer and admin, then asks the new role's sign-up questions. Google sign-in returns to the address it started from, so that address (for example `http://localhost:5173/**`) must be in **Authentication → URL Configuration → Redirect URLs** on the shared project.

Relevant files: `src/services/auth.ts` (`getCurrentProfile`), `src/models/roles.ts` (`roleLabelFor`), `src/pages/LoginPage.tsx`, `src/pages/VolunteerDashboard.tsx`.

---

## Announcements

**The tab is called Announcements.** It was **News**, the app's name for it, until Nov 13, 2026. The website now says Announcements everywhere: the sidebar and the phone's bottom bar (`NAV_ITEMS` in `src/components/AppShell.tsx`; it fits in full on a 320 px-wide phone), the page title (`src/pages/AnnouncementsPage.tsx`), the dashboard panel's heading (`src/components/AnnouncementsPanel.tsx`), the Home shortcut and its **Latest announcements** button, the composer's hints ("Posts appear in Announcements straight away…", "Pinned posts stay at the top of Announcements."), the remove-from-feed warning, and the header search, which finds pages by these labels. The address is still `/announcements` and nothing in the backend changed. The mobile app still says News; renaming it there is on the app README's to-do list.

Admins author the announcements every other role reads. The feed is one live list shared by the Announcements tab, the dashboard panel, and the sidebar's pinned badge. It starts empty ("No announcements yet."); `MOCK_ANNOUNCEMENTS` holds sample posts that no page shows. Posts are the app's `announcements` rows (`audience`, `pinned`, `discipline_id`, `target_user_id`, `created_by`, `attachments`), so a post from either side shows on both. The browser's offline copy uses the key `local_announcements_v2`.

**Posting.** Same rules as the app's composer: admins post to Everyone or one discipline; volunteers with `can_post_announcements` post to the disciplines they manage (`discipline_id` set), never to Everyone. A post has a subject, a message, an audience, an optional pin-to-top, and photos and files. Like the app, a post can't be edited, re-pinned or given a link after it's posted; admins can delete it. Photos and files come in by drag-and-drop or a file picker:

| Attachment | How it appears in the feed |
|---|---|
| Image | Inline, full width, click to open |
| Video | Inline `<video>` player |
| Audio | Inline `<audio>` player |
| PDF / document | Download row with type and size |
| Link / form | Row that opens in a new tab (older posts only; new posts can't add links) |

Files upload to the shared `announcement_attachments` bucket under the poster's user id (10 MB per file). Only admins and volunteers with `can_post_announcements` can write to it.

**Live across profiles.** The client subscribes to Postgres changes on `announcements`, so a new or deleted post reaches every connected profile without a refresh.

**New-post banner.** Like the app's in-app banner, a post that reaches you and arrives while the site is open shows as a toast with its title, the start of the message and an **Open** button (Announcements, or the bell's list for a personal notice). The rule is the app's (`bannerFor` in `src/models/announcements.ts`): nothing for your own posts or for a discipline you're not in, and admins see "Ms. Lee sent an announcement to the TechVerse discipline" for discipline posts. Posts already there when the page loaded never banner. Nothing mutes it, here or in the app: there's no notification setting on either (see **Notifications**).

**Unread.** Unread posts are tinted red with a "New" label and counted in an "N unread" chip on the panel. The sidebar's Announcements link has no count: the bell counts new posts (see **Notifications**). Clicking one marks it read, like opening it in the app. Read state is the app's `announcement_reads` table, used the same way: opening Announcements marks every post seen (a row with no `opened_at`), which clears the red count, and each post's dot stays until that post is opened (`opened_at` set). Reading a post on the website clears it on the phone and the reverse.

**Remove from my feed.** Kept out of sight on purpose, as in the app: each post has a **⋯** button, and its menu has **Remove this announcement from my feed**. That asks first ("Once you remove … you can't get it back in your feed. It stays in Announcements for everyone else."), because there's no undo. It hides the post for this account only (`announcement_dismissals`). Admins get **Delete for everyone** in the same menu, which also asks first.

**No backend.** With no Supabase keys at all (tests, offline work), posts and read state are kept in the browser's own storage and the page says so. Admins see a banner when the backend is configured but unreachable, quoting the error instead of silently showing stale content.

Relevant files: `src/services/announcements.ts`, `src/context/AnnouncementsContext.tsx`, `src/components/AnnouncementComposer.tsx`, `src/components/AnnouncementsPanel.tsx`, `src/components/AttachmentPreview.tsx`.


## Notifications (the bell)

The bell at the top right opens **Notifications** (`/notifications`, `src/pages/NotificationsPage.tsx`), the same list as the app's bell, with a red count of unread notes. It holds short notes about you, separate from Announcements:

- a new post that reaches you ("Priya Shah posted to TechVerse"), which opens Announcements and marks that post opened;
- personal notices (assignments, team changes, expert approval, the admins' sheet and expert-queue notices), which open their session when they have one;
- "Coming up at 10:30 AM: AI Playground" in the hour before a session you're in or managing.

**When each note arrived.** Each note shows a stamp at the right of its title (`notificationStamp` in `src/models/notifications.ts`), in the viewer's own time zone. Notes from today keep the app's relative style; once a note is from an earlier calendar day, it shows the date instead:

| When it arrived | Stamp |
|---|---|
| Today, under a minute ago | **just now** |
| Today, under an hour ago | **5m ago** |
| Earlier today | **3h ago** |
| An earlier day this year | **Thu, Nov 12** |
| Another year | **Nov 12, 2025** |

"Today" means the viewer's calendar day, not the last 24 hours: at noon, a note from 12:05 AM says **11h ago**, and a note from 11 PM yesterday says **Wed, Nov 11**, not "13h ago". The app's "2d ago" never happens on the website. Hovering the stamp shows the full date and time ("Thursday, November 12, 2026 at 9:05 AM", `notificationFullTime`), and it's a `<time datetime>` element for screen readers. The stamp comes from the note's `created_at` and is worked out when the list renders, so it doesn't tick on its own while the page sits open. The app's bell still says "2d ago" for older notes; switching those to dates is on the app README's to-do list.

Clicking a note marks it read; **Mark all as read** clears the bell. The rows are the app's `notifications` table, written only by the backend (`notifications_setup.sql` in the app repo); the website reads them (`src/services/notifications.ts`, `src/context/NotificationsContext.tsx`), marks them read (`mark_notifications_read`), keeps them live over Realtime, and every 5 minutes calls `queue_my_session_reminders` (reminders start once the backend's `summit_date` is set; the website's own `SUMMIT_DATE` doesn't count for this).

Personal notices are no longer in Announcements. Until the `notifications` table has loaded once (for example before that SQL is run), Announcements keeps showing each person their own notices, so nothing goes missing. Announcements has no count of its own any more; each post keeps its "New" label until it's opened.

There's no browser push and there won't be: it needs a service worker and a permission prompt, and iPhones only allow it for sites added to the home screen. So Profile has no notification setting at all. The app has none either: its banner always shows, and push (once built) is turned off in the phone's own Settings, which the app's Profile opens. The old **Mobile app notifications** switch was removed on Nov 13, 2026; `profiles.notifications_enabled` stays in the table, unused.

---

## People, check-in, and resources

**Sessions I'm managing** (`/volunteer`, `src/pages/VolunteerDashboard.tsx`), like the app's `my_assignments_screen.dart`: the sessions an admin assigned this volunteer to, each linking to its session page for the roster and attendance. **Volunteer hub** (`/volunteer/contacts`) is the app's contact list of volunteers and admins. Each number has the app's actions (`src/components/PhoneActions.tsx`): copy ("Number copied"), **Call** (`tel:`) and **Text** (`sms:`). The session Volunteers tab uses the same, in small. **Session rosters** list each person's school and grade, their other sign-up answers (expertise, bio, student ID…, labelled as on the sign-up form by `detailLabel` in `src/models/profileFields.ts`), their answers to the session's questions, their email and their mobile number with the same actions, which is what the app's roster person sheet shows.

**Check-in.** Front-desk check-in is only in the mobile app, because it scans QR passes with the phone camera; the website sends `Permissions-Policy: camera=()`. Everyone still has their QR pass on the website (Profile, and the sidebar for participants). The pass is the bare account id, the same as the app, so a pass on a laptop screen scans at the app's front desk. Home shows whether you've been checked in (`my_summit_checkin`).

**Resources** (`src/models/resources.ts`, `RESOURCES`). Empty until there are real files: the page says "No resources posted yet." Add an entry with a `url` (a public file or Drive link) for each, and its card opens it in a new tab.

## Landing hero

The hero (`src/pages/WelcomePage.tsx`, styles in `src/landing/landing.css`) fills the first screen with the night sky. The "Emerald Summit" wordmark sits centered in it, with the tagline above it as a spaced uppercase caption in the wordmark's pale emerald. Below it are the date, hours and place on one line (stacked on phones), then two buttons side by side: **Get started** (to sign-in) and **Learn more** (scrolls to About). A feathered pool behind those details blurs and dims the sky and ridges so they stay readable (`.lp-hero__aside::before`). The wordmark is colored: "Emerald" runs white to pale emerald, "Summit" pale emerald to green, and one highlight sweeps across both lines every 4.5 seconds (`lp-glint`; it holds still under reduced motion).

**The arrival** plays once per browser session (`src/components/introSession.ts`) while scrolling is locked. It opens on the still sky for a second, starts a slow push in toward the upper sky, so the foot of the range slips out of frame (`OPEN_HOLD_MS` and `OPEN_SUN_DELAY_MS` in `WelcomePage.tsx`; the zoom's amount, aim and length are on `.lp-sky` in `landing.css`, and it eases back out as the page settles). While the push is still under way an emerald sun (`src/landing/SunArc.tsx`) rises from behind the range just left of center, crests over the central summit and sets on the right. It is drawn as light, not a ball: a pale core that fades out with no rim, a soft halo, and a short fringe of rays. Like a real day, the sun and its rays are smallest on the horizons, grow to their fullest at the crest, and shrink again as it sets. It is kept dim enough that the sky stays a night sky. While it is up the range takes daylight: the rock brightens and picks up a little color, driven by a `--sun` value (0 on the horizons, 1 at the crest) that `WelcomePage.tsx` sets on the hero each frame and `landing.css` reads. While it climbs, the wordmark is wiped on in the middle of the screen; once it sets, the sky holds for a beat (`SETTLE_HOLD_MS` in `WelcomePage.tsx`), then the wordmark lifts a little and the details come in below it, then the nav drops in. **Skip** jumps straight to the settled page. The tunables are at the top of `SunArc.tsx`: `SUN_ARC_MS` (length), `RISE_EASE` (how much longer the rise takes than the set), `CREST_LINGER` (how much it slows at the top), `ARC_HALF_SPAN` (how far from center it rises and sets), and `ARC_TOP` (how high it crests).

**The central summit.** The far range comes to one taller peak in the middle, under the point where the sun crests. It is the `summit` option on the first ridge in `src/components/skyGeometry.ts` (`at`, `rise`, `spread`). Its top is kept to a point: `SUMMIT_MIN_SLOPE` and `SUMMIT_TIP_REACH` set how steep and how long the tip is, and `SUMMIT_FLANK_SLOPE` keeps the shoulders from climbing back up beside it.

**Nav and Contact.** The landing nav (`src/components/LandingNav.tsx`) links to About, Universes, FAQ and Contact, in the same 16px type as the Sign in button. Contact scrolls to the closing "Start the trek." band above the footer, a short strip on the sky's deep emerald (`--color-emerald-night`) that fades into the footer. It has **Get started** and a mail link to contact@ehsacademics.org (`CONTACT_EMAIL` in `WelcomePage.tsx`; the footer repeats the address).

**Hallmark checks (kept on purpose).** The rest of the landing page passes Hallmark's design lint (`sloplint`). The hero, as Akhil reworked it, does not, and the team decided to keep it as is. The lint flags: colours written directly in the hero's styles instead of as tokens; the wordmark's gradient fill and sweeping highlight; the tagline in spaced uppercase; the blurred, dimmed pool behind the date and buttons; two spacings off the 4px scale (`.lp-hero__actions`); and pill-shaped nav links and date chips. Treat these as deliberate. Don't "fix" them to satisfy the lint without checking with the team.

**Below the hero**, in order:
- **What is Emerald Summit?** A short answer, a photo mosaic of the owner's photos that swaps every 4.5 seconds while on screen (`src/components/PhotoMosaic.tsx`; the leaderboard and award photos are left out), and four figures with notes.
- **What happens on Summit day?** A Hairline figure of six stacked terraces (`public/hairline/summit.js`, mounted by `src/landing/HairlineFigure.tsx`) with Emerald High's flag on top. Hovering a terrace lifts it and shows that part of the day beside it, from Check-in at the peak down to the Landing at the base (`src/landing/dayParts.ts`). Facts nobody has announced yet, like this year's keynote speaker, show as a visible blank.
- **Which universe is yours?** The six universes on a scroll-driven orbit (`src/components/OrbitalUniverses.tsx`), with each one's tracks beside it.
- **What did the previous years look like?** A photo rail with a full-size viewer (`src/landing/PhotoRail.tsx`).
- **How do I get to Emerald High?** Date, hours, place (with a Google Maps link) and cost.
- **FAQ** (`src/components/FaqSection.tsx`). "Who can attend" says high schoolers participate, 8th graders can in some sessions, curious minds of all ages can spectate, and middle schoolers and younger come with a parent.
- **Who are you coming as?** A Hairline badge rack (`public/hairline/badges.js`) with one badge for each of the five sign-in roles; hovering a badge highlights its role in the list.

The Hairline kernel (`public/hairline/kernel.js`) is an unchanged copy of the hairline-create skill's kernel. The landing page's own tokens and styles are in `src/landing/` (`tokens.css`, `base.css`, `landing.css`), scoped under `.lp`. There is no `/app` showcase page any more; old links to it land on the home page.

## Landing sky

The hero's sky is the live canvas in `src/components/MountainSkyline.tsx` (under reduced motion, `src/components/SkyVideo.tsx` shows a still instead, which predates the central summit). It is tuned to stay out of scrolling's way:

- **Still stars are painted once.** Seven in eight of the 900 stars are drawn a single time onto the main canvas. The other ~110 twinkle on a second canvas, which redraws only the small square around each one.
- **It twinkles only at the top.** The twinkle starts 4 seconds after the page settles within 48px of the top, freezes the moment you scroll down, and starts the countdown again when you come back. It also stops in a hidden tab or when the hero is off screen.
- **It runs light.** The twinkle draws at 30fps on a 1x canvas; only the arrival sequence uses full retina resolution.
- **The rest runs as CSS.** The far ridges' drift and the summit glow's pulse are CSS animations (`ridge-drift-a/b` and `summit-glow` in `src/index.css`), so the browser runs them off the main thread. The page around the canvas is set once instead of every frame.

A settled frame costs about 0.26 ms, down from about 3.8 ms when every star was redrawn at full resolution 60 times a second. The tunables are at the top of `MountainSkyline.tsx`: `TWINKLE_EVERY`, `TWINKLE_FPS`, `TWINKLE_DELAY_MS`, and `TOP_SLACK`.

## Sign-in pages

The role sign-in (`/login/:role`), the expert application (`/apply/:role`), and profile setup (`/profile`) share `src/components/AuthLayout.tsx`. It's adapted from the "Split Login" block found on 21st.dev (Hirael login-03, MIT):

- **Navy aside:** the logo, the role's icon and name (centered a little above the middle, like the roles page heading), and flowing paths in the role's color. The paths drift with a CSS stroke animation (`auth-path` in `src/index.css`), not per-frame JavaScript. It stays in place while a long form scrolls. The outer section clips sideways overflow with `overflow-x-clip`, not `overflow-hidden`, which would break `sticky`.
- **Focused pane:** a back link and the theme button, then the form.

On the sign-in page:

- **Continue with Google** is the one primary action, with the volunteer/admin list note right under it.
- **Expert** keeps the approval sheet's email form.
- **LinkedIn** is a "Coming soon" row.
- **Test accounts** get a password box instead of a code (see **Test accounts**).

Small screens drop the aside and show the logo above the form.

**Profile setup** (`/profile`, `src/pages/ProfileSetupPage.tsx`). One page: full name, the sign-in email (read-only, because `enforce_role_allowlist` pins it), then the role's questions from **Sign-up** above. Answers are saved in `profiles.details` (jsonb), merged with whatever the app already stored there, the way the app saves its role questions. Nothing is written to a separate table.

## Portal layout

Every signed-in page sits inside one portal shell (`src/components/AppShell.tsx`):

- **Navy sidebar** with the Summit logo, an event card, and navigation grouped into *My Summit* (Home, Schedule, Discover, Announcements, Archie: the app's tab order; the app calls the fourth tab News), *Event* (Resources), and *Account* (Profile), filtered by role. Participants get a "My QR Pass" card above their profile. The profile card at the bottom opens the roles page while staying signed in. Its ⇆ icon shows a "Switch role" label above it on hover or keyboard focus. Beside it, a red sign-out button shows just an icon and expands to "Sign out" on hover or keyboard focus. Settings has sign out too.
- **Top bar** with a breadcrumb, a global search, a chip naming the viewer's role, and the bell, which opens **Notifications** and shows a red count of unread notes (see **Notifications**). The search (⌘K / Ctrl+K) finds pages the viewer can open plus sessions by title, track, room, or discipline, the fields the app's Discover search uses.
- **Mobile** uses the same navy for a compact top bar and a bottom tab bar. The bottom bar is the app's five tabs: Home, Schedule, Discover, Announcements (News in the app), Archie. Profile is the round avatar (your initials) at the right of the top bar, beside the bell, as on the app's Home. Change role and sign out are on Profile.
- **Look.** The portal shares the landing page's look: a flat background, solid cards on a hairline border (`.glass` in `src/index.css`, which no longer blurs or glows), pill-shaped buttons (`src/components/ui/button.tsx`), and page labels as plain small text above a bold title (`src/components/PageHeader.tsx`).

**Roles page** (`/roles`, `src/pages/RolesPage.tsx`). A navy panel beside a list of roles, shown at `/home` when signed out and reachable from the sidebar when signed in. Each role is a row with a solid role-colored icon tile, and the current role is a navy row. Signed in, your current role continues straight to the dashboard ("Continue as …"). Any other role opens its sign-in page, which offers **Change role to …** (`src/components/ChangeRolePanel.tsx`): it first calls `preview_role_change` and lists what happens to each of your sessions, in the app's words, then saves the role and re-reads what the server kept. A gated role that isn't on the allowlist is refused with "You aren't eligible to sign up as …". A first sign-in with a picked role goes through `getCurrentProfile` (`src/services/auth.ts`), which throws `SignInRefusedError` when the server keeps a different role; `AuthContext` then signs out and shows the message as `signInError`. A failed Google sign-in is shown the same way (see **Google sign-in**). If the account can't be loaded at all, you're signed out with "We couldn't load your account."

The dashboard (`/home`, `src/pages/HomePage.tsx`) opens with a time-of-day greeting on a slowly drifting emerald gradient (paused for reduced-motion users) and an "Up next" card. Below that is a large **Your day** card: the reserved sessions in time order, then **Tracks**: the app's tracks (areas within each verse, such as Genetics, Mock Trial, or CADathon, from `src/models/tracks.ts`), as cards in each verse's colors that open that verse's page. They're labeled as Summit '26's list until the '27 tracks are set. A Build your schedule button appears once you have sessions. Beside it, a right rail holds the Next up and Check-in tiles (Check-in has its own QR pass button) and announcements. On wide screens (1280px+), Your day sets the row's height and announcements scroll inside the rail; narrower screens stack the rail underneath. Horizontal dividers within the content column then separate the top section, **Explore the verses**, a row of four quick links, and **Links** (the app's Links card: Summit website, Instagram and the contact email, `src/components/home/LinksCard.tsx`). Between the greeting and Your day sit the app's **photo slideshow** and **quote card**. The slideshow (`src/components/home/PhotoSlideshow.tsx`) shows every photo in the `gallery_photos` bucket, a new one every 5 seconds, with dots; it pauses under the pointer, cuts instead of fading under reduced motion, loads only the photo on screen and the next one, and is hidden while the bucket is empty. Admins curate it by uploading or deleting files in the Supabase dashboard, as for the app. The quote card (`src/components/home/QuoteCard.tsx`) has the app's seven quotes and picks one by day of the year.

**Explore the verses** (`src/components/verse/`) ports the mobile app's Discover screen and discipline pages, using the same palettes and animations (from `discipline_vibe.dart` and `discipline_effects.dart` in genzarjun/Emerald-Summit-App-MOBILE). Each of the six verses gets a card in its own colors, with a live motif drawn on a canvas behind the text:

| Verse | Motif |
|---|---|
| TechVerse | Circuit pulses |
| VentureVerse | A rising chart with embers |
| BioSphere | Drifting cells |
| NovaSphere | Stars, orbits, and a shooting star |
| CivicVerse | Gavel ripples between columns |
| ImagineX | Paint blobs shifting hue |

Clicking a card opens the verse's page the way the app does: a circle of its color grows from the click point, the full-size motif plays, and a liquid border flows around the edge, pouring in from the top. The page shows the verse's sessions, seats, and which are on your day. Back or Escape reverses the circle. Motifs pause when off screen or in a hidden tab, and show a single still frame under reduced motion. Palettes live in `src/models/verseVibes.ts`; keep them in step with the app's `discipline_vibe.dart`. `VERSE_DISCIPLINES` there gives each verse its accent as `color`, and the landing hero's verse dots and orbit use it, so they match these cards. The plain `USER_DISCIPLINES` colors stay for light surfaces, where the lighter accents would be too faint.

**Track pages.** Each track has its own page inside its verse's world (same colors, motif, and border). It shows what the track covers, its formats (workshop, exhibit, or presentation, as described in the app's knowledge base), ideas for what to bring or do, the sessions in that track, and chips for the verse's other tracks. Open one from the Tracks row on the dashboard, from a session's track tag on the Schedule page, or from the chips and session tags on a verse page. The verse badge at the top goes back to the whole verse. For participants and experts, each session card on a verse page or a track page has a **+** in its top right, including when the page is opened from the Schedule page (`VersePortalProvider`'s `canAdd`). Every add-to-schedule + in the app, on these cards and on the Schedule page, is dark green (`emerald-deep`) with a white +. Hovering a card's + shows "Add to schedule" (or "Session full", disabled). Clicking it closes the verse page and goes to `/schedule` with `{ add: sessionId }` in router state. The Schedule page adds the session under its usual rules: a session that's full, or at the same time as one already on your day, isn't added, and a toast says why. Otherwise it's added, the entry in My Schedule is scrolled to, ringed, and tagged "Added" for a few seconds, and a toast confirms it. A session already on your day shows "On your day" instead of the +. Track details live in `src/models/tracks.ts` (`TRACKS`), and each mock session names its track in `trackName` (`src/models/sessions.ts`). Every track has at least one mock session, with its own seats, so each verse page lists a session per track. Like the list itself, they're Summit '26's tracks until the '27 tracks are set.

**Discover** (`/disciplines`, `src/pages/VersesPage.tsx`). The app's Discover tab, in the sidebar under *My Summit* and in the phone tab bar. The disciplines are the shared `disciplines` table in its `sort_order`, with each row's name and tagline, the same list the app shows (`replaceDisciplines` in `src/models/disciplines.ts`; the six bundled there are only the fallback before the table loads). The six keep their own colors and worlds; a discipline added later gets the emerald world with the icon its row names (the app's icon keys, mapped in `DISCIPLINE_ICONS` in `src/components/icons.tsx`). The heading counts them ("The six disciplines"). Admins get **New discipline** (`src/components/verse/NewDisciplineDialog.tsx`), the app's discipline editor: id (lowercase letters, numbers or _), name, tagline and icon, added last in sort order. Nobody can rename or delete a discipline from either client; deleting one is done in the Supabase dashboard (the app repo's `discipline_delete_dashboard_only.sql`). The disciplines fill the page as tall panels in a row, each in its colors with its motif playing behind it. One panel is open at a time: the one under the pointer, or focused by keyboard (arrow keys, Home, and End walk the row). The rest narrow to a badge, a number, and the name running up the panel. The open panel shows the number (01 / 06, counting the real list), name, description, track and session counts with seats open, what's on your day, a chip per track, and an Enter button. On a touch screen the first tap opens a panel. Phones get them as stacked, always-open cards. The dashboard's **Explore the verses** row stays as a shortcut.

**Editing sessions** (`src/services/summitContent.ts`, `src/components/verse/ContentEditors.tsx`). The catalog is the app's: `disciplines` and the `sessions_with_counts` view for reads, `sessions` for writes. There is no tracks table; a session's `track` is a text column. Times are 24-hour text with two-digit hours (`09:45`), shown in 12-hour form. Admins can edit every discipline; volunteers with `can_edit_sessions` can edit the disciplines on their sheet row. Rooms are locked: the editor can't change a session's room. Row-level security on `sessions` makes the final call.

On start, `loadSummitContent()` (called from `src/main.tsx`) replaces `TRACKS`, `UNIVERSE_TRACKS`, and `MOCK_SESSIONS` in place with the shared rows, and every save does the same. A failed read shows nothing rather than sample sessions. Without a backend the bundled lists show.

**Saved schedules** (`src/services/reservations.ts`, `src/context/ScheduleContext.tsx`). A signed-in person's schedule is their rows in the app's `registrations` table (`participation_type` participant, spectator or expert), written only through `register_for_session` with `p_intent` `add` or `remove`. The RPC enforces seats, time clashes and closed participation, and the website shows the same refusal messages. Volunteers don't pick sessions: an admin assigns them (`session_volunteers`), and those sessions show on their schedule with no remove button. When an admin assigns someone who's already busy at that time, the new managed session replaces what they had (see **Managing replaces a clash**). The Schedule page header reads **My Day**, as in the app. Under it is the app's day summary (`DaySummary`): "3 sessions · 2 hr 30 min booked" (the booked time counts sessions you registered for, not ones you manage, and is left out while times are hidden), then "5 open sessions still fit around these. Find one", counting sessions in any discipline that aren't full and don't overlap anything on your day (`openSessionsThatFit` in `src/models/suggested.ts`).

**Schedule page.** Each session card in Build Your Schedule is tinted in its verse's color with a colored left edge, and shows its track as a tag. Clicking the card, its title, or the tag opens the track's page; the add, spectate, and drag controls keep their own jobs. My Schedule tints each item in its verse's color, with a colored edge and time, and keynotes in emerald. On wide screens the session list and My Schedule split the width 3:2 (`minmax(0,3fr)` and `minmax(0,2fr)`), so the split doesn't shift as sessions are added.

## Light, dark, and system themes

Every page has a theme button (`src/components/ThemeToggle.tsx`): a sun or moon for the theme in effect that opens a Light / Dark / System menu with a check by the current choice. It's in the portal's top bar (and the mobile top bar), the landing nav, the roles page, and the sign-in pages. Settings has it too, under Preferences → Appearance. The choice is saved in `localStorage` (`theme`) and defaults to System.

- **System follows the clock:** dark from **7:00 PM to 7:00 AM**, light from 7:00 AM to 7:00 PM, in the viewer's local time. It re-checks every minute and when the tab comes back, so it flips without a reload. The hours are `DARK_FROM_HOUR` and `LIGHT_FROM_HOUR` in `src/context/ThemeContext.tsx`, and `index.html` repeats them in a small script that sets the theme before the first paint (keep the two in step).
- **Dark** is black, after the mobile app's night theme (`lib/theme.dart`): a black page with dark cards, mint for primary actions, and the navy chrome (sidebar, auth and roles panels, landing bands) turned black. The tokens are the `.dark` block in `src/index.css`. `navy` and `navy-bright` are CSS variables there, so `bg-navy` follows the theme.
- **Light** is the familiar mist theme with the navy sidebar. The verse cards, Tracks, and verse pages switch to daytime versions of each world: the same motifs, liquid border, and portal animation on a colorful pale tint of the verse's hue (TechVerse is light blue instead of deep navy), with deeper accents so they read. `vibeFor(id, theme)` in `src/models/verseVibes.ts` returns the right palette; the light palettes are the `LIGHT` table there.

The landing hero keeps its night sky in both themes.

The design source is the Figma file [Emerald Summit — Portal Redesign](https://www.figma.com/design/qqeSVs9y0OOfjFgnveZZTV). It holds the color variables and reusable components. Headings there use Plus Jakarta Sans as a stand-in for Satoshi, which Figma doesn't provide.

---

## Expert sign-up and approval

Experts sign in like everyone else (Google or an emailed code). Picking Expert sets `expert_status = pending` on the shared profile. Until an admin approves them in the app (`review_expert`), the dashboard shows the app's waiting screen (`src/components/ExpertStatus.tsx`): "Your expert account is awaiting approval", the contact email, **Check again**, **Sign up as something else** and **Sign out**. If the admin declines, the server makes the account a participant, and the next visit shows the app's one-time "Your expert request wasn't approved" note. OK calls `acknowledge_expert_decline` so it isn't shown again.

The old Google Sheet flow (`apps-script/approvals.gs`, the `/apply/expert` survey) is no longer used: `/apply/:role` redirects, and the script is kept only for reference.

---

## Brand

| Name | Hex | Use |
|---|---|---|
| Emerald | `#0C7A55` | Primary actions |
| Deep Emerald | `#0A5F43` | Pressed / accents |
| Ink | `#16211C` | Text |
| Mist | `#EEF5F1` | Surfaces |
| Navy | `#101C36` | Portal sidebar, dark buttons |

The logo is the emerald dragon inside a ring of the disciplines: `public/brand/summit-logo.png` (512px, white badge with a transparent outside), rendered by `SummitLogo` wherever the brand appears. `public/favicon.png` and `public/apple-touch-icon.png` are made from the same art.

Display type is **Satoshi** (`font-display`); body text is **Instrument Sans**.

Keep in-app copy functional: page headers carry a label and title only, with no taglines. Explanatory text stays only where it tells people how something works, such as the expert approval note on sign-in.

---

## License

Proprietary — EHS Academic Foundation. All rights reserved.
