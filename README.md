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
| **Admin** | Check in attendees, manage people, broadcast announcements |

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
├── context/              # React context providers (Auth, Schedule)
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

Supabase provides hosted Postgres, authentication, file storage, and row-level security. Schema and policies live in `supabase/migrations/`. Row-level security keys off `users.role` so each role only reads and writes what it should. These same tables and policies are the shared source of truth that the production Flutter app integrates against.

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
