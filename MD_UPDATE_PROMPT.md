Title: Markdown Update - Agent Prompt Template

Purpose
This template is for instructing an AI or a human editor to update repository Markdown files (`MEMORY.md`, `TASKS.md`, `HITL.md`, `AGENTS.md`, etc.) with the current version and a clear changelog entry.

When to use
- Any PR that modifies code or docs in a way that requires updating project MD artifacts (decisions, tasks, HITL, language, PRD).

Prompt template (replace bracketed fields):

---
Action: Update Markdown files
Files to update: [comma-separated list of files to edit, e.g. MEMORY.md, TASKS.md]
Current version: [vX.Y.Z or commit sha]
Date: [YYYY-MM-DD]
Author: [Your name or agent id]
Change type: [decision | bugfix | migration | policy | content]
Short summary: [One-line summary]
Detailed changes:
- [Bullet 1: what changed]
- [Bullet 2: why]
- [Bullet 3: impact and rollback plan]
Tests added/updated: [yes/no] — describe
HITL required: [yes/no] — if yes, include the exact HITL prompt text to present
Memory entry required: [yes/no] — if yes, include the MEMORY.md entry text
Files modified list (paths):
- [file path 1]
- [file path 2]

Checklist (ensure these are addressed in the MR):
- [ ] `TASKS.md` updated if scope or tasks changed
- [ ] `MEMORY.md` entry added for decisions or schema changes
- [ ] `HITL.md` reviewed/updated if action affects messaging/migrations/deploys
- [ ] `UBIQUITOUS_LANGUAGE.md` updated for domain-term changes
- [ ] Tests added or updated
- [ ] Migrations included (if DB schema changed)

Example (filled):
---
Action: Update Markdown files
Files to update: MEMORY.md, HITL.md, TASKS.md
Current version: v0.1.0
Date: 2026-08-09
Author: tharindu
Change type: migration
Short summary: Add migration to create `rsvp_responses` table and HITL requirement for running migrations
Detailed changes:
- Added SQL migration file `migrations/003_create_rsvp_responses.sql`.
- Updated `HITL.md` to require explicit approval before running migrations against non-local DBs.
- Added `MEMORY.md` entry describing the migration intent and reason.
Tests added/updated: yes — integration test skeleton for migration runner
HITL required: yes — exact prompt: "⚠️ HITL CHECKPOINT: I am about to run DB migrations against <env>. This will modify production schema and may affect guest data. Shall I proceed? (yes / no)"
Memory entry required: yes — see appended entry below.
Files modified list (paths):
- migrations/003_create_rsvp_responses.sql
- HITL.md
- MEMORY.md

Append to `MEMORY.md` (example entry):
[2026-08-09] Decision: Add `rsvp_responses` migration file and require HITL before running migrations
Reason: PRD-defined schema change; ensure human approval to avoid accidental data loss
Alternative considered: apply migrations automatically via CI (rejected due to safety)

---

Usage notes
- Always paste the completed filled template into the PR description. The CI `docs-check` script will validate that `HITL.md`/`MEMORY.md` were updated when sensitive files changed.
- For automated agents: require a human `yes` reply to any `HITL` prompt before emitting commits that change sensitive files.
