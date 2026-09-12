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

Every role except **Ambassador** can sign in; ambassadors are still coordinated offline and exist only so directory listings label them correctly.

---

## Getting started

### Prerequisites

- **Node.js 18+**
- A **Supabase** project (copy `.env.example` to `.env.local` and fill in your keys). Without one, the app runs in a local auth-bypass mode for prototyping.

### Run the app

```bash
npm install
npm run dev
```

Then open the printed local URL (Vite defaults to `http://localhost:5173`).

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
├── services/             # Backend integration (auth)
└── index.css             # Tailwind + design-system globals

supabase/
└── migrations/           # Postgres schema + row-level security migrations
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

**Local fallback.** Writes need a real Supabase session, because row-level security has no credentials to check under bypass sign-in. With bypass — or with no backend configured at all — posts are kept in the browser's own storage and broadcast across that browser's tabs, and the composer says so rather than failing against an invisible policy. Admins also see a banner when the backend is configured but unreachable, quoting the error instead of silently showing stale content.

Relevant files: `src/services/announcements.ts`, `src/context/AnnouncementsContext.tsx`, `src/components/AnnouncementComposer.tsx`, `src/components/AnnouncementsPanel.tsx`, `src/components/AttachmentPreview.tsx`.

---

## Brand

| Name | Hex | Use |
|---|---|---|
| Emerald | `#0C7A55` | Primary actions |
| Deep Emerald | `#0A5F43` | Pressed / accents |
| Ink | `#16211C` | Text |
| Mist | `#EEF5F1` | Surfaces |

---

## License

Proprietary — EHS Academic Foundation. All rights reserved.
