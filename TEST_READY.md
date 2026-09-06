# Test Suite & Infrastructure — Emerald Summit Web Prototype

## Overview
The testing infrastructure for the Emerald Summit web prototype uses **Vitest**, **React Testing Library**, and **JSDOM**. The current component test suite covers the **Volunteer Dashboard** (`src/pages/VolunteerDashboard.tsx`) across Tiers 1–4.

> **History:** This test setup was originally scaffolded by an automated agent run (2026-07-27) that built a *"Mentor Dashboard"* and *"Parent Spectator View"*. Those features were later renamed — *Mentor* became the **Volunteer** role/dashboard and *Parent* became the **Attendee** role — so the earlier `MentorDashboard.test.tsx` / `ParentSpectatorView.test.tsx` suites no longer exist. This document reflects the **current** state of the code. (See `.agents/README.md` for context on that run.)

---

## 1. Test Infrastructure

- **Runner**: Vitest 2.x (`vitest run`)
- **DOM Environment**: JSDOM 24.x
- **Assertion & Queries**: `@testing-library/react` 16.x, `@testing-library/jest-dom` 6.x, `@testing-library/user-event` 14.x
- **Setup File**: `src/test/setup.ts` (imports `@testing-library/jest-dom` matchers)
- **Configuration**: `vite.config.ts` sets `test: { globals: true, environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }`, with the `@` → `./src` path alias.
- **NPM Command**: `npm run test` (runs `vitest run`)

---

## 2. Commands

- **Run tests**: `npm run test` (or `npx vitest run`)
- **Build verification**: `npm run build` (`tsc && vite build`)

---

## 3. Current Coverage

### Volunteer Dashboard (`src/pages/__tests__/VolunteerDashboard.test.tsx`)
**1 suite · 10 tests across Tiers 1–4.**

- **Tier 1 — Feature Coverage** (3 tests):
  - Renders the assigned track ("NovaSphere"), participant roster (e.g. Priya Sharma), and check-in tools.
  - Toggles check-in status when the "Check In" / "Undo Check-in" button is clicked.
  - Filters the participant list when a status tab ("Checked In") is selected.
- **Tier 2 — Boundary & Corner Cases** (5 tests):
  - Empty participant roster → "No participants assigned to this track".
  - Unassigned track (`null`) → "No assigned track found".
  - Unknown track string → falls back cleanly without throwing.
  - `null` participants prop → treated as an empty roster.
  - Search input filtering, including a "no matches" state.
- **Tier 3 — Cross-Feature & Role Gating** (1 test):
  - Enforces role gating via `useRequireRole` and hides content when a non-volunteer is redirected.
- **Tier 4 — Design System Adherence** (1 test):
  - Uses `PageHeader` eyebrow, the display font (`font-display`), and `.glass` card styling.

---

## 4. Verification

```bash
# Run the test suite
npm run test

# Type-check + production build
npm run build
```
