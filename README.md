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
- A **Supabase** project (copy `.env.example` to `.env.local` and fill in your keys). Without one, the app runs in a local auth-bypass mode for prototyping.
- For expert sign-in by email, the approvals Apps Script deployed and its URL in `VITE_APPROVALS_URL` (see `apps-script/README.md`).

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
| `can_edit_sessions`, `can_post_announcements` | Shown as badges in the hub. Nothing uses them yet: the website's sessions are still sample data, and only admins post announcements. |

Bypass Login's demo volunteer gets every permission, so the whole hub can be previewed without the sheets.

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

**Testing it.** Sign in with **Continue with Google**. Bypass Login is a local demo session that never reaches the database, so it skips the sheets. A new Google account that picks Volunteer or Admin keeps that role only if its email is on the matching sheet. Otherwise it becomes a participant and sees "You aren't eligible to sign up as a volunteer/an admin." The role picked on the login page applies to existing accounts too: anyone can switch to Participant or Attendee, but Volunteer, Ambassador, and Admin need the email on that sheet (`20261028160000_switch_role_at_sign_in.sql`). If the switch is refused, the person is signed out and lands on the roles page with that message. Google sign-in returns to the address it started from, so that address (for example `http://localhost:5173/**`) must be in **Authentication → URL Configuration → Redirect URLs**. Expert sign-in uses the approvals sheet's email flow instead of Google.

Relevant files: `supabase/migrations/20261028120000_role_allowlist.sql`, `supabase/migrations/20261028140000_front_desk_check_in.sql`, `supabase/migrations/20261028160000_switch_role_at_sign_in.sql`, `supabase/functions/sync-allowlist/index.ts`, `src/services/auth.ts` (`getCurrentProfile`, `takeDeniedRole`), `src/models/roles.ts` (`roleLabelFor`), `src/pages/LoginPage.tsx`, `src/pages/VolunteerDashboard.tsx`.

---

## Announcements

Admins author the announcements every other role reads. The feed is one live list shared by the Announcements tab, the dashboard panel, and the sidebar's pinned badge.

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

## Portal layout

Every signed-in page sits inside one portal shell (`src/components/AppShell.tsx`):

- **Navy sidebar** with the Summit logo, an event card, and navigation grouped into *My Summit*, *Event*, and *Account* (filtered by role). Participants and ambassadors get a "My QR Pass" card above their profile. The profile card at the bottom opens the roles page while staying signed in. Beside it, a red sign-out button shows just an icon and expands to "Sign out" on hover or keyboard focus. Settings has sign out too.
- **Top bar** with a breadcrumb, a global search, a chip naming the viewer's role, and an announcements bell that shows a red dot when there are unread announcements. The search (⌘K / Ctrl+K) finds pages the viewer can open plus sessions by title, speaker, or room.
- **Mobile** uses the same navy for a compact top bar and a bottom tab bar. The top bar's switch icon opens the roles page.

**Roles page** (`/roles`, `src/pages/RolesPage.tsx`). A navy panel beside a list of roles, shown at `/home` when signed out and reachable from the sidebar when signed in. Each role is a row with a solid role-colored icon tile, and the current role is a navy row, deliberately unlike the tinted session cards. **One role at a time:** signed in, only your current role continues straight to the dashboard ("Continue as …"). Every other role goes to its sign-in page, which notes that signing in ends your current role. Signing in again replaces the session: a Google sign-in clears a demo session, and a demo or expert sign-in ends the Google session. The account then moves to the new role if the sheets allow it. If they don't, you're signed out and the roles page shows "You aren't eligible to sign up as …", so you never fall back into the old role. Visiting the sign-in page for the role you already hold goes straight to the dashboard. Volunteer, Admin, and Expert are marked "Approval needed". The rule is enforced in the app; the database still accepts a direct role change by API, as long as the sheets allow the new role.

The dashboard (`/home`, `src/pages/HomePage.tsx`) opens with a time-of-day greeting on a slowly drifting emerald gradient (paused for reduced-motion users) and an "Up next" card. Below that is a large **Your day** card: the reserved sessions in time order, then **Tracks**, a sideways-scrolling row of every session as tinted cards, with a Build your schedule button once you have sessions. Beside it, a right rail holds the Next up and Check-in tiles (Check-in has its own QR pass button) and announcements. On wide screens (1280px+), Your day sets the row's height and announcements scroll inside the rail; narrower screens stack the rail underneath. Horizontal dividers within the content column then separate the top section, **Explore the verses**, and a row of four quick links.

**Explore the verses** (`src/components/verse/`) ports the mobile app's Discover screen and discipline pages, using the same palettes and animations (from `discipline_vibe.dart` and `discipline_effects.dart` in genzarjun/Emerald-Summit-App-MOBILE). Each of the six verses gets a dark card in its own colors, with a live motif drawn on a canvas behind the text:

| Verse | Motif |
|---|---|
| TechVerse | Circuit pulses |
| VentureVerse | A rising chart with embers |
| BioSphere | Drifting cells |
| NovaSphere | Stars, orbits, and a shooting star |
| CivicVerse | Gavel ripples between columns |
| ImagineX | Paint blobs shifting hue |

Clicking a card opens the verse's page the way the app does: a circle of its color grows from the click point, the full-size motif plays, and a liquid border flows around the edge, pouring in from the top. The page shows the verse's sessions, seats, and which are on your day. Back or Escape reverses the circle. Motifs pause when off screen or in a hidden tab, and show a single still frame under reduced motion. Palettes live in `src/models/verseVibes.ts`; keep them in step with the app's `discipline_vibe.dart`.

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

The app talks to the sheet through a small Apps Script web app (`apps-script/approvals.gs`) whose URL goes in `VITE_APPROVALS_URL`. Setup steps, including the trigger that sends approval emails, are in `apps-script/README.md`. Without that variable, the email step says the backend isn't configured, and Bypass Login still works.

The survey questions live in `src/models/approvalSurveys.ts`, and the script finds sheet columns by header name. Gating volunteers the same way means adding a `volunteer` entry there and a `Volunteers` tab to the sheet.

This is a prototype: the typed email is trusted without verification, and approved users get the same local session as Bypass Login. Once Google sign-in is turned back on, the same check should run against the verified Google email.

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
