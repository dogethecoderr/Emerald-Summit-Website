# Emerald Summit — Web Prototype 🐉

A React web app used to **test, visualize, and integrate features** for the Emerald Summit — the Tri-Valley's largest student-run STEAM summit.

> **This is not the production app.** The app actually used at the Emerald Summit is a **separate, standalone Flutter mobile app** (iOS + Android), maintained in its own repository. That Flutter app is the real product. **This repository is a web version** — a fast, browser-based environment for prototyping UX, visualizing ideas, and integrating/testing features (and the shared backend) before they are built into the mobile app. The two codebases are independent.

| | |
|---|---|
| **Event** | Emerald Summit '27 |
| **When** | January 2027 |
| **Where** | Emerald High, Dublin CA |
| **This repo** | Web prototype — testing, visualization, and feature integration |
| **Production app** | Separate Flutter mobile app (iOS + Android), in its own repo |
| **Owner** | EHS Academic Foundation · EAF Tech Team |

---

## Why this repo exists

The Emerald Summit runs corporate-style and is driven entirely by students, with six disciplines, 20+ tracks, and 30+ visiting experts across a high-school campus. The production experience is a native mobile app, but iterating on native is slow.

This web version gives the team a place to move fast:

- **Prototype UX quickly** in the browser with instant hot-reload
- **Visualize features** (schedule builder, announcements, directory, judging, dashboards) end to end
- **Integrate and test the shared Supabase backend** — auth, roles, row-level security, and migrations — against a real UI
- **Validate the design system and flows** before the corresponding work is built into the Flutter app

Feature work and data models are prototyped here and then carried over into the mobile app.

---

## Tech stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui** (Radix primitives) — the "Emerald Mist" design system
- **framer-motion** for the animated landing/intro
- **React Router** for routing
- **@hello-pangea/dnd** for the drag-and-drop schedule builder
- **Supabase** (`@supabase/supabase-js`) for auth + Postgres + row-level security
- **Vitest** + **React Testing Library** + **jsdom** for component tests

---

## Roles

Users sign in and pick a role, which is stored on their record and enforced with Supabase row-level security. The prototype currently models these roles (see `src/models/roles.ts`):

| Role | What they do |
|---|---|
| **Participant** | Build a schedule, register for tracks, follow their day |
| **Attendee** | Explore the summit and browse updates (no competitor schedule) |
| **Volunteer** | Manage an assigned track, check participants in, support attendees |
| **Expert** | View judging assignments and navigate between rooms |
| **Ambassador** | Edit activity pages, post announcements, log volunteer hours |
| **Admin** | Post and edit announcements, share files, broadcast Summit news |

Every role except **Ambassador** can sign in; ambassadors are still coordinated offline and exist only so directory listings label them correctly. **Experts** also need an admin's approval before their email works; see [Expert sign-up and approval](#expert-sign-up-and-approval).

---

## Getting started

### Prerequisites

- **Node.js 18+**
- A **Supabase** project (copy `.env.example` to `.env.local` and fill in your keys). Without one, only demo mode (below) can sign in.
- For expert sign-in by email, the approvals Apps Script deployed and its URL in `VITE_APPROVALS_URL` (see `apps-script/README.md`).

**Demo mode** (`src/lib/demoMode.ts`) is for development and testing only. It is on under `npm run dev` and off in production builds (Vercel runs `vite build`), so the "Use demo mode" option isn't shipped to real users. Set `VITE_ENABLE_DEMO_MODE=true` on a deploy to turn it on there, for example on Vercel's Preview environment only. A demo session lives in this browser's localStorage (`bypass_session` with `demo: true`, `bypass_profile`) and never reaches the database. It starts at profile setup like a first Google sign-in, so every registration page can be viewed. A **Skip** button there moves on, and Continue changes only the local profile. `saveProfile` and `updateProfileSettings` refuse to write while any local session is active. A demo session left in a browser is dropped when it loads in a build with demo mode off. The expert email sign-in also uses a local session but isn't demo mode, so it works in every build.

### Run the app

```bash
npm install
npm run dev
```

Then open the printed local URL (Vite defaults to `http://localhost:5173`).

The dev server honours a `PORT` environment variable, so a second instance — another checkout, or a teammate's session on the same machine — can run alongside the first instead of colliding on 5173:

```bash
PORT=5174 npm run dev
```

### Scripts

```bash
npm run dev       # Start the Vite dev server
npm run build     # Type-check (tsc) and build for production
npm run preview   # Preview the production build locally
npm run test      # Run the Vitest component tests
```

Tests never reach a real Supabase project: any test that renders a check-in path mocks `src/lib/supabase` (with a fake client, or `null` for the offline mock roster), since `.env` would otherwise point it at the live backend. Suites that call `vi.restoreAllMocks()` in `beforeEach` mock `html5-qrcode` with a plain class rather than `vi.fn().mockImplementation(...)`, because the restore strips `vi.fn` implementations and the scanner modal then shows its camera-error fallback a moment after opening.

---

## Project structure

```
src/
├── main.tsx              # App entry point
├── App.tsx               # Routes (React Router)
├── pages/                # Route-level pages (Home, Schedule, Directory, Judging, dashboards, …)
├── components/           # Shared UI, including shadcn/ui primitives in components/ui
├── context/              # React context providers (Auth, Schedule, Announcements)
├── hooks/                # Reusable hooks (e.g. useRequireProfile)
├── models/               # Domain models (roles, disciplines, sessions, people, …)
├── services/             # Backend integration (auth, announcements, approvals)
└── index.css             # Tailwind + design-system globals

supabase/
└── migrations/           # Postgres schema + row-level security migrations

apps-script/              # Google Apps Script backend for the expert sign-up sheet
```

> The `.agents/` folder is a collaborator's Google Antigravity agent workspace and is unrelated to the web app — see `.agents/README.md`.

---

## Backend

Supabase provides hosted Postgres, authentication, file storage, realtime, and row-level security. Schema and policies live in `supabase/migrations/`. Row-level security keys off `users.role` so each role only reads and writes what it should. These same tables and policies are the shared source of truth that the production Flutter app integrates against.

Apply pending migrations to the linked project with:

```bash
npx supabase db push
```

Features that depend on a migration degrade to local/mock data until it is pushed, and say so in the UI rather than failing silently.

---

## Volunteer and admin allowlist

Who may hold the **volunteer**, **ambassador**, or **admin** role comes from two private Google Sheets, copied from the mobile app's sheets:

| Sheet | Columns |
|---|---|
| Emerald Summit Website - Allowed Volunteers | `email`, `subtype` (`eaf_ambassador` / `parent_volunteer` / `student_volunteer`), `disciplines` (ids, or `all`), `can_edit_sessions`, `can_post_announcements`, `can_check_in_front_desk` |
| Emerald Summit Website - Allowed Admins | `email` |

A blank capability cell uses the subtype default: EAF ambassadors can edit sessions; everything else is off until set `TRUE`. Session editing and announcement rights only apply to the listed disciplines, so set them only on rows that have one.

**How it's enforced.** The `sync-allowlist` Edge Function reads both sheets through a Google service account and copies them into `role_allowlist` every minute. A trigger on `users` (`users_role_allowlist`) then:

- turns any volunteer, ambassador, or admin who isn't listed into a participant;
- allows ambassador only for volunteer rows with subtype `eaf_ambassador`;
- copies each volunteer's subtype, disciplines, and flags onto their row;
- pins the row's email to the sign-in email, so nobody can borrow an admin's address.

Editing a sheet takes effect within a minute. Removing someone demotes them. If a sheet suddenly reads back empty, or loses more than half its rows (and at least 5), the sync refuses to remove anyone and reports why. This port, from the mobile repo's `sync-allowlist`, drops the app's in-app admin notice.

**What each column does on the website.**

| Sheet | Effect |
|---|---|
| Subtype | Labels the person as EAF Ambassador, Student volunteer, or Parent volunteer in the sidebar, the top bar, and the Volunteer Hub. Ambassadors sign in as Volunteer; Ambassador isn't a sign-in choice. |
| Disciplines | Scopes the Volunteer Hub roster to participants in those disciplines (`all` shows everyone). With no disciplines and no front desk, the hub asks them to get disciplines added to the sheet. |
| `can_check_in_front_desk` | Unlocks summit-wide check-in: the whole roster, the QR scanner, and the Check In / Undo buttons. Everyone else sees their roster read-only. The database enforces it (`20261028140000_front_desk_check_in.sql`): front-desk volunteers may change another person's `checked_in_at` and nothing else, and nobody checks themselves in. |
| `can_edit_sessions` | Lets the person add, edit, and delete tracks and sessions in the verses on their row (see **Editing tracks and sessions**). Blank means yes for EAF ambassadors and no for everyone else. |
| `can_post_announcements` | Shown as a badge in the hub. Nothing uses it yet: only admins post announcements. |

Demo mode's volunteer gets every permission, so the whole hub can be previewed without the sheets. These flags only drive the page in that browser: with no Supabase session, row-level security refuses every write.

**One-time setup** (project `spsxfbvamwxsmtjkwxko`):

1. In Google Cloud, enable the **Google Sheets API**, create a service account, and download a JSON key. Share both sheets with the service account's `client_email` as **Viewer**.
2. Log in and link: `npx supabase login`, then `npx supabase link --project-ref spsxfbvamwxsmtjkwxko`.
3. Apply `supabase/migrations/20261028120000_role_allowlist.sql` on its own: paste it into the SQL editor, or run `npx supabase db query --linked -f <file>`. It creates the table, the trigger, and the once-a-minute cron job. Don't use `db push` here. This project's earlier migrations were applied by hand, so it has no migration history and `db push` would try to replay all of them.
4. Set the function's secrets (the private key stays on your machine; never commit it):
   ```bash
   npx supabase secrets set \
     VOLUNTEERS_SHEET_ID=1NMQ1C3hCARPW6TBcQMHfhDD4K3EupNqNJqjkfG56LLQ \
     ADMINS_SHEET_ID=1ZjCvL_COOEq94JMtwDywOj1vn08mIYzuBbZ3kYgTkSw \
     GOOGLE_SERVICE_ACCOUNT_EMAIL="<client_email>" \
     GOOGLE_PRIVATE_KEY="<private_key, keeping the \n escapes>" \
     ALLOWLIST_SYNC_SECRET="<output of: select secret from private.allowlist_sync;>"
   ```
5. Deploy: `npx supabase functions deploy sync-allowlist --no-verify-jwt`.
6. Check it once with `select private.flush_allowlist_sync();` and then `select * from role_allowlist;`.
7. Re-check existing accounts, so anyone who already holds a gated role without being on a sheet is demoted: `update public.users set updated_at = now() where role in ('volunteer', 'ambassador', 'admin');`. Do this only after step 6 shows both lists filled.

**Testing it.** Sign in with **Continue with Google**. Demo mode is a local session that never reaches the database, so it skips the sheets. A new Google account that picks Volunteer or Admin is created only if its email is on the matching sheet. Otherwise no account is created, and it is signed out with "You aren't eligible to sign up as a volunteer/an admin." The role picked on the login page applies to existing accounts too: anyone can switch to Participant or Attendee, but Volunteer, Ambassador, and Admin need the email on that sheet (`20261028160000_switch_role_at_sign_in.sql`). If the switch is refused, the person is signed out and lands on the roles page with that message. Google sign-in returns to the address it started from, so that address (for example `http://localhost:5173/**`) must be in **Authentication → URL Configuration → Redirect URLs**. Expert sign-in uses the approvals sheet's email flow instead of Google.

Relevant files: `supabase/migrations/20261028120000_role_allowlist.sql`, `supabase/migrations/20261028140000_front_desk_check_in.sql`, `supabase/migrations/20261028160000_switch_role_at_sign_in.sql`, `supabase/functions/sync-allowlist/index.ts`, `src/services/auth.ts` (`getCurrentProfile`, `takeDeniedRole`), `src/models/roles.ts` (`roleLabelFor`), `src/pages/LoginPage.tsx`, `src/pages/VolunteerDashboard.tsx`.

---

## Announcements

Admins author the announcements every other role reads. The feed is one live list shared by the Announcements tab, the dashboard panel, and the sidebar's pinned badge. It starts empty ("No announcements yet."); the sample posts in `MOCK_ANNOUNCEMENTS` only illustrate the `/app` showcase. The table, its policies, and the `announcement-media` bucket come from `supabase/migrations/20260911120000_create_announcements.sql`, applied to the live project on 2026-11-01 (it now also revokes Supabase's default grants, TRUNCATE included). The browser's offline copy moved to the key `local_announcements_v2`, leaving behind old copies that held the sample posts.

**Authoring (admins only).** The composer creates and edits posts with a category, an audience, and an optional pin-to-top. Attachments come in by drag-and-drop or a file picker:

| Attachment | How it appears in the feed |
|---|---|
| Image | Inline, full width, click to open |
| Video | Inline `<video>` player |
| Audio | Inline `<audio>` player |
| PDF / document | Download row with type and size |
| Link / form | Row that opens in a new tab |

Files upload to the public `announcement-media` Supabase Storage bucket (100 MB per file); only admins can write to it.

**Live across profiles.** The client subscribes to Postgres changes on `announcements`, so a post, edit, pin, or delete reaches every connected profile without a refresh.

**Unread.** Each account's unread announcements show a red count on the sidebar's Announcements link, a red dot on the bell, and an "N unread" chip on the panel. Unread posts are tinted red with a "New" label. Clicking one, or its "Mark as read" button, marks it read, and the Announcements tab has "Mark all as read". Read state is kept in the browser per account (`AnnouncementsContext`), so it doesn't follow someone to another device.

**Local fallback.** Writes need a real Supabase session, because row-level security has no credentials to check under bypass sign-in. With bypass — or with no backend configured at all — posts are kept in the browser's own storage and broadcast across that browser's tabs, and the composer says so rather than failing against an invisible policy. Admins also see a banner when the backend is configured but unreachable, quoting the error instead of silently showing stale content.

Relevant files: `src/services/announcements.ts`, `src/context/AnnouncementsContext.tsx`, `src/components/AnnouncementComposer.tsx`, `src/components/AnnouncementsPanel.tsx`, `src/components/AttachmentPreview.tsx`.

---

## People, check-in, and resources

**Directory and Volunteer Hub** (`src/services/people.ts`). Both list real accounts from `public.users`: the Directory shows everyone, and the hub's roster shows participants and attendees, scoped as the Allowed Volunteers sheet says. Signed-out and demo sessions can't read `users`, so their lists are empty. The database has no per-field visibility yet, so everyone's email, phone, and bio show as private on cards. The sample `MOCK_PEOPLE` stand in only when no backend is configured at all (tests, offline prototyping).

**Check-in.** The hub's Check In / Undo buttons write `users.checked_in_at` (`setCheckedIn`), as the QR scanner does. Only front-desk volunteers and admins may (`20261028140000_front_desk_check_in.sql`). A refused write matches no row; it's reported as an error, and the button reverts. It used to look like a success. With a backend, a scan or typed ID that isn't a real account is "Participant not found"; it no longer falls back to the sample people.

**Resources** (`src/models/resources.ts`, `RESOURCES`). Empty until there are real files: the page says "No resources posted yet." Add an entry with a `url` (a public file or Drive link) for each, and its card opens it in a new tab.

## Landing hero

The hero (`src/pages/WelcomePage.tsx`) opens with the "Summit '27 · …" pill; the round logo that sat above it is gone (the nav bar still carries it), and the column stays centered. The "Emerald High School, Dublin, CA" chip is a link that opens the venue in Google Maps in a new tab (`VENUE_MAP_URL`, a Maps search for that address), as does the address under **When & where** further down.

## Landing sky

The hero (`src/components/SkyVideo.tsx`) plays the arrival as a pre-rendered video while scrolling is locked. It then hands over to the live sky (`src/components/MountainSkyline.tsx`), which is tuned to stay out of scrolling's way:

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
- **Demo mode** is a quiet "Use demo mode" option, shown only where demo mode is on.

Small screens drop the aside and show the logo above the form.

**Student registration** (`/profile`, `src/pages/ProfileSetupPage.tsx`). Participants register in three steps, with step dots and a Back link. Name and email are required; everything else is optional:

1. **About you:** full name, email, phone ("optional, recommended for notifications"), grade (9th to 12th), school (defaults to Emerald High School), and a short bio (30 words). The email is the sign-in address, shown filled in and read-only, because `enforce_role_allowlist` pins `users.email` to it.
2. **Team:** Solo or In a group. A group adds a team name and up to 4 teammates' names (everyone except you).
3. **Project:** planned verse, a planned track within it (from `src/models/tracks.ts`), project title, and an overview (75 words).

The planned verse goes in the existing `users.discipline` column, and it's the only one of these shown anywhere in the app. Picking a track doesn't reserve any sessions; students build their schedule themselves afterwards. Other roles see only the first step (name, email, phone, discipline, bio). The answers are saved together on Finish.

Grade, school, team, teammates, track, and project go in their own table, **`student_registrations`** (`supabase/migrations/20261101120000_student_registrations.sql`, one row per participant keyed by `user_id`). They aren't stored on `users`, because any signed-in person can read every `users` row (that's how the directory works). Row-level security on the new table:

| Who | Access |
|---|---|
| The student | Create, read, and update their own row (`user_id = auth.uid()`) |
| Admins (`public.is_admin()`, role from the Allowed Admins sheet) | Read every row |
| Everyone else signed in, signed out, or in demo mode | Nothing |
| Service role / Supabase dashboard | Everything; read or export it in **Table Editor → student_registrations** |

Signed-in users are granted only select, insert, and update. The migration revokes Supabase's default grants first, because those include TRUNCATE, which RLS doesn't cover. The table also checks the grade range, team size, and overview length. There's no in-app admin view yet. The migration was applied to the live project on 2026-11-01. On a project where it hasn't run, `saveProfile` skips these details with a console warning (PostgREST answers `PGRST205`), and registration still finishes. In demo mode they're kept in this browser (`bypass_registration`), and Skip moves to the next step, or on the last step finishes registration in that browser.

## Portal layout

Every signed-in page sits inside one portal shell (`src/components/AppShell.tsx`):

- **Navy sidebar** with the Summit logo, an event card, and navigation grouped into *My Summit* (Dashboard, Verses, then Schedule or Volunteer Hub), *Event*, and *Account* (filtered by role). Participants and ambassadors get a "My QR Pass" card above their profile. The profile card at the bottom opens the roles page while staying signed in. Its ⇆ icon shows a "Switch role" label above it on hover or keyboard focus. Beside it, a red sign-out button shows just an icon and expands to "Sign out" on hover or keyboard focus. Settings has sign out too. One click signs out of a demo session too: `signOut()` ends the local session first and tells `AuthContext` at once. It used to wait for Supabase's sign-out event, which is ignored while a local session exists.
- **Top bar** with a breadcrumb, a global search, a chip naming the viewer's role, and an announcements bell that shows a red dot when there are unread announcements. The search (⌘K / Ctrl+K) finds pages the viewer can open plus sessions by title, speaker, or room.
- **Mobile** uses the same navy for a compact top bar and a bottom tab bar. The top bar's switch icon opens the roles page.

**Roles page** (`/roles`, `src/pages/RolesPage.tsx`). A navy panel beside a list of roles, shown at `/home` when signed out and reachable from the sidebar when signed in. Each role is a row with a solid role-colored icon tile, and the current role is a navy row, deliberately unlike the tinted session cards. **One role at a time:** signed in, only your current role continues straight to the dashboard ("Continue as …"). Every other role goes to its sign-in page, which notes that signing in ends your current role. Signing in again replaces the session: a Google sign-in clears a demo session, and a demo or expert sign-in ends the Google session. The account then moves to the new role if the sheets allow it. If they don't, you're signed out and the roles page shows "You aren't eligible to sign up as …", so you never fall back into the old role or into participant. `getCurrentProfile` (`src/services/auth.ts`) does the checking. It throws `SignInRefusedError` whenever the role the server kept isn't the one picked. `AuthContext` then signs out and exposes the message as `signInError`. A new account asking for Volunteer or Admin is checked against its own `role_allowlist` rows first, so a refused sign-up creates no `users` row. A role that never signs in with Google (Expert) is refused without touching the database. The two profile loads on page load (`getSession` and `onAuthStateChange`) share one request, so only one of them reads the picked role. If the account can't be loaded at all, you're signed out with "We couldn't load your account." Visiting the sign-in page for the role you already hold goes straight to the dashboard. Volunteer, Admin, and Expert are marked "Approval needed". The rule is enforced in the app; the database still accepts a direct role change by API, as long as the sheets allow the new role.

The dashboard (`/home`, `src/pages/HomePage.tsx`) opens with a time-of-day greeting on a slowly drifting emerald gradient (paused for reduced-motion users) and an "Up next" card. Below that is a large **Your day** card: the reserved sessions in time order, then **Tracks**: the app's tracks (areas within each verse, such as Genetics, Mock Trial, or CADathon, from `src/models/tracks.ts`), as cards in each verse's colors that open that verse's page. They're labeled as Summit '26's list until the '27 tracks are set. A Build your schedule button appears once you have sessions. Beside it, a right rail holds the Next up and Check-in tiles (Check-in has its own QR pass button) and announcements. On wide screens (1280px+), Your day sets the row's height and announcements scroll inside the rail; narrower screens stack the rail underneath. Horizontal dividers within the content column then separate the top section, **Explore the verses**, and a row of four quick links.

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

**Verses tab** (`/verses`, `src/pages/VersesPage.tsx`). Its own entry in the sidebar under *My Summit* and in the phone tab bar. The six verses fill the page as tall panels in a row, each in its verse's colors with its motif playing behind it. One panel is open at a time: the one under the pointer, or focused by keyboard (arrow keys, Home, and End walk the row). The rest narrow to a badge, a number, and the verse's name running up the panel. Opening animates the panels' widths. The open panel shows the verse's number (01 / 06), name, description, track and session counts with seats open, what's on your day, a chip per track (opens that track's page), and an Enter button (opens the verse page). On a touch screen the first tap opens a panel. Phones get the six as stacked, always-open cards. The dashboard's **Explore the verses** row stays as a shortcut.

**Editing tracks and sessions** (`src/services/summitContent.ts`, `src/components/verse/ContentEditors.tsx`, `supabase/migrations/20261101140000_summit_tracks_sessions.sql`). Tracks and sessions live in two tables, `summit_tracks` (keyed by verse and name) and `summit_sessions` (applied to the live project on 2026-11-01), seeded once from `src/models/tracks.ts` and `sessions.ts`. Who can change them is decided by `public.can_edit_verse(verse)`, and the app hides the controls to match (`canEditVerse`):

| Who | Can edit |
|---|---|
| Admins | Every verse, keynotes included |
| Volunteers (EAF ambassadors and others) with `can_edit_sessions` on the Allowed Volunteers sheet | The verses in their row's `disciplines` (`all` = every verse); never keynotes |
| Everyone else, signed in or not | Nothing; they can read |

On a verse page, editors get **Add track** after the track chips, **Add session** beside the Sessions heading, and a pencil on each session card. A track page adds **Edit track**. The session editor sets title, track, time slot, length, who leads it, room name and room code (for walking-time warnings), description, and seats, expert spots, and spectator seats. Seat counts taken stay sample numbers. The track editor sets name, what it covers, ideas (one per line), and formats. Renaming a track moves its sessions with it (the foreign key cascades). A track that still has sessions can't be deleted. Deletes take two clicks. Escape closes an editor without closing the verse page.

The bundled lists are the live store. On start, `loadSummitContent()` (called from `src/main.tsx`) replaces `TRACKS`, `UNIVERSE_TRACKS`, and `MOCK_SESSIONS` in place with the tables' rows, and every save does the same. So everything that reads those lists picks up edits; pages that need to redraw call `useSummitContent()`. Without a backend, or before the migration runs, the bundled lists show. In demo mode, edits change only that browser's copy, and a toast says so.

**Saved schedules** (`src/services/reservations.ts`, `src/context/ScheduleContext.tsx`, `supabase/migrations/20261101160000_session_reservations.sql`). A Google-signed-in person's schedule is saved in `session_reservations`, one row per session they're competing in, spectating, or judging, and it comes back on every device and reload. The database enforces the rules, even if two people click the last seat at once:

- **Seats.** A full session is refused.
- **Time slots.** A second session in the same time slot is refused.
- **Who can take what.** Only participants compete, participants and attendees spectate, and experts judge.

Each session's seat counts (`enrolled`, `spectators`, `experts_enrolled`) are kept equal to its reservations by trigger, so every page shows live numbers. The migration resets the sample counts to zero; it was applied to the live project on 2026-11-01. A refused add or remove reverts on screen with the reason in a toast; switching between competing and spectating gives the old seat back if the new one is refused. Demo and expert (approvals-sheet) sessions have no database credentials, so their schedule stays in the tab and the counts move locally.

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

Experts sign in with their email, and an admin approves each one in a Google Sheet before that email works. The sheet is "Emerald Summit App - Experts": one row per applicant, with an **Approval Status** column of Awaiting Approval, Approved, or Rejected ("Yes"/"No" also work).

| Step | What happens |
|---|---|
| Expert enters their email on `/login/expert` | The app looks it up in the sheet |
| Email not in the sheet | They fill in the survey at `/apply/expert` (name, phone, universe, track, organization, bio, …), which adds an Awaiting Approval row. They return to the login page with a note that they will be emailed once approved |
| Email awaiting or rejected | The login page says so and does not sign them in |
| Admin sets the row to Approved | The applicant gets an email with a sign-in link |
| Email approved | They are signed in as an expert |

The app talks to the sheet through a small Apps Script web app (`apps-script/approvals.gs`) whose URL goes in `VITE_APPROVALS_URL`. Setup steps, including the trigger that sends approval emails, are in `apps-script/README.md`. Without that variable, the email step says the backend isn't configured, and demo mode still works where it's on.

The survey questions live in `src/models/approvalSurveys.ts`, and the script finds sheet columns by header name. Gating volunteers the same way means adding a `volunteer` entry there and a `Volunteers` tab to the sheet.

This is a prototype: the typed email is trusted without verification, and approved users get the same kind of local session as demo mode. Once Google sign-in is turned back on, the same check should run against the verified Google email.

Relevant files: `apps-script/approvals.gs`, `src/services/approvals.ts`, `src/models/approvalSurveys.ts`, `src/pages/LoginPage.tsx`, `src/pages/ApplyPage.tsx`.

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
