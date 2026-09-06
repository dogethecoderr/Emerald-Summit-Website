# `.agents/` — Google Antigravity agent workspace

This folder belongs to **Google Antigravity** (the agentic IDE) used by a collaborator (**Arush**) to run autonomous AI coding agents against this project. It is **not** part of the web app's source, build, or runtime.

> **TL;DR:** Nothing in here is required for the project to build or run, and nothing in here is required for Arush to keep using Antigravity. Everything currently in this folder is a **historical record** (artifacts) of one completed agent run. It is safe to delete; it's kept only for provenance.

---

## What this folder is for

Antigravity natively scans a project's `.agents/` directory. It can hold two very different kinds of content:

1. **Configuration** — files that *power* future agent work and that Antigravity reads on startup:
   - `AGENTS.md` — agent personas / operating instructions
   - `skills/` — modular `SKILL.md` instruction manuals
   - `workflows/` — scripts that chain agent tasks
   - `rules/` — project rules
   - MCP / model config (`mcp.json`, `models.json`, etc.)

   > None of these configuration files currently exist in this repo. Antigravity's actual config lives in Arush's global scope (e.g. `~/.agents/`, `~/.gemini/`) and/or is regenerated per task, so removing this folder would **not** break his setup.

2. **Run artifacts** — disposable outputs the agents drop for the human and for successor agents to read: briefings, plans, progress logs, handoff reports, and audit reports. **Everything currently in this folder is this second kind.**

---

## What's in here right now

These are artifacts from a **single completed multi-agent run on 2026-07-27**. The task (see `ORIGINAL_REQUEST.md`) was to add a *"Mentor Dashboard"* and *"Parent Spectator View"*.

> ⚠️ **These artifacts are stale.** After the run, the feature was renamed: the *Mentor* concept became the **Volunteer** role/dashboard (`src/pages/VolunteerDashboard.tsx`) and the *Parent* concept became the **Attendee** role. So files here that mention `MentorDashboard.tsx`, `ParentSpectatorView.tsx`, a `mentor`/`parent` role, or `/mentor` and `/parent` routes describe an **older naming that no longer exists** in the code. They also reference a different machine's Windows paths (`c:\Users\arush\Downloads\Emerald-Summit-App-main`).

| Path | What it is |
|---|---|
| `ORIGINAL_REQUEST.md` | The original task prompt given to the agent system |
| `orchestrator/` | The "manager" agent: its briefing, plan, progress, and handoff |
| `sentinel/` | Watchdog agent that monitored the run and triggered the final audit |
| `teamwork_preview_explorer_m1_*/` | Explorer agents that scouted routing, design system, and test setup |
| `teamwork_preview_worker_m2/` | The agent that actually wrote the code + tests for the run |
| `teamwork_preview_reviewer_*/` | Code-review agents |
| `teamwork_preview_challenger_*/` | Agents that stress-tested security and design-system adherence |
| `teamwork_preview_auditor_1/` | Forensic auditor |
| `victory_auditor/` | Independent auditor that issued the final "VICTORY CONFIRMED" report |

Each agent folder generally contains `BRIEFING.md` (its instructions), `progress.md` (its checklist), and `handoff.md` (its report to the next agent).

---

## Are these files necessary?

- **For the project to build / run?** No. Nothing in `src/` imports or reads `.agents/`. The web app builds and runs identically with or without this folder.
- **For Arush to keep working with Antigravity?** No. These are outputs of a *finished* task, not configuration. Antigravity loads agent config from global scope and regenerates fresh artifacts on each new run.
- **Why keep them, then?** Purely as a record of how the Volunteer/Attendee feature was originally built. They can always be recovered from git history if deleted later.
