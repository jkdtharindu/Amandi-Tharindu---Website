# Startup Prompt

Paste this at the start of a new chat session on this project.

---

Start Working — New Session

STEP 0 — Doc map: know what's canonical before reading anything.
- **Canonical, actively maintained (read these):** root `MEMORY.md`, `TASKS.md`, `README.md`, `UBIQUITOUS_LANGUAGE.md`, `HITL.md`, `BRANCH_STRATEGY.md`.
- **Known-stale duplicates — do not read for current state, do not edit:** `docs/MEMORY.md`, `docs/README.md`, `docs/TASKS.md`, `docs/WEDDING_UBIQUITOUS_LANGUAGE.md`. A 2026-08-29 consolidation copied these under `docs/` but every session since kept editing the root copies; the `docs/` copies have had zero commits since 2026-08-30. See MEMORY.md 2026-09-04.
- **Canonical, docs/-only (no root duplicate exists — this is its real home, not a spot-check tier):** `docs/amandi-tharindu-wedding-PRD.md`. Actively maintained — new feature specs (§14, §15, §16 as of 2026-09-05) are added here directly, each dated. Read it as fact, not with the same suspicion as the tier below.
- **Docs-only (no root duplicate) but not guaranteed current — spot-check before trusting:** `docs/WEDDING_UI_UX_SPEC.md`, `docs/WEDDING_API_DOCUMENTATION.md`, `docs/WEDDING_MODEL_SELECTION.md`, `docs/AGENTS.md`.
- **`docs/WEDDING_DATABASE_SCHEMA.md` is unreliable, but no longer uniformly stale as of 2026-09-05** — most of it is a pre-migration aspirational doc dated 2026-08-29 ("migrations never applied") describing a schema that does not match what was actually built (different table names, `SURNAME-NNN` code format, Supabase-Auth admin model, etc.). `seating_tables`/`table_seats`/`probable_attendees` sections were retroactively added 2026-09-05 and should be accurate. **Still confirm any schema fact against `migrations/*.sql` directly rather than trusting this file's age as a signal** — a doc can be edited on the same day for one section and stale everywhere else.
- **Real schema source of truth: `migrations/*.sql`, read directly.** Never infer schema from prose. Run `ls migrations` to get the current file list — do not assume the count below is still accurate:
  - 001 guests · 002 rsvp_responses · 003 admin/theme/sections · 004 theme palette+font · 005 messaging · 006 invitation code format · 007 table arrangements · 008 couple-name-order fix · 009 celebration_events.
- If any task touches a specific table/column, open the relevant migration file(s) — don't quote a markdown schema doc as fact.

STEP 0.5 — Check for a live dev server before assuming a clean environment.
- This project gets worked on from multiple sessions/worktrees. Before running `npm run dev`,
  check whether a server is already listening on its port (`.claude/launch.json` lists the
  configured ports, e.g. `wedding-next` on 3010) — Next.js refuses a second dev server on the
  same project directory even when you pick a different port.
- If one is already running, it may belong to another active session, not a stale leftover.
  Ask the user before stopping it; don't kill it on your own judgment.
- If you need to verify something in the browser without disturbing another session's server,
  a throwaway instance with `DATABASE_URL=` (forces in-memory mode) and overridden
  `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH` on a free port is a safe way to click-test without
  touching the real database or the other session's login state.

STEP 0.6 — Know the "Grill Me session" convention before scoping anything new.
- `docs/amandi-tharindu-wedding-PRD.md` records ambiguous or newly-proposed features as a
  dated "Grill Me session" — clarifying questions asked and answered — before acceptance
  criteria are written (see §14, §15, §16). When a request is underspecified, ask first using
  this same pattern, then write the spec with today's date, rather than guessing.

STEP 1 — Read project state cheaply. Don't read whole files unless necessary; grep to verify individual facts.
- Read `TASKS.md`: current status, "Current focus," Model Assignment Convention, Next Actions, open blockers.
- Read the most recent 2–3 dated entries in `MEMORY.md`: recent decisions, past mistakes, last session's summary.
- Read `BRANCH_STRATEGY.md` for the current primary branch and merge protocol.
- Read `HITL.md`: what requires an explicit "⚠️ HITL CHECKPOINT" pause before acting.

STEP 2 — Don't trust the md files blindly; spot-check them against actual code and schema.
- Pick 2–3 of the most recent `[✔]`/`[x]` "done" or "merged" claims in TASKS.md and verify they're true in the working codebase — files/routes exist, and the described behavior is reachable from the **real production entrypoint** (`npm start` → `next start` → `app/`), not the legacy Express prototype (`src/server.js`, only reachable via `npm run start:legacy`/`npm run smoke`).
- For anything schema-related, confirm against `migrations/*.sql` per Step 0, not any markdown description.
- If a claim doesn't hold up, flag it — don't act on it as fact, and don't silently "fix" the docs without saying so first.

STEP 3 — Check git/branch/worktree state with concrete commands, not assumptions.
```
git status
git branch -a --sort=-committerdate
git worktree list
git ls-remote --heads origin
```
- This repo uses Claude Code worktrees under `.claude/worktrees/<branch>` — a `+` prefix in `git branch -a` output means "checked out in another worktree," **not** "unmerged." Check `git worktree list` before flagging a branch as abandoned.
- Don't trust `git branch --merged` formatting alone on a long list — confirm per-branch with:
  `git merge-base --is-ancestor <branch> main && echo merged || echo "NOT merged"`
- `git ls-remote --heads origin` can surface a remote branch that local cleanup missed (a branch fully merged but never `git push origin --delete`d) — treat that as harmless housekeeping, not drift, once you've confirmed it's merged.
- Flag any branch/worktree with commits older than 2 weeks that is not merged or archived, per `BRANCH_STRATEGY.md`.
- Note any uncommitted changes, distinguishing "looks intentional/pending a decision" from genuinely unrecognized.
- Check for open PRs waiting on a merge/close decision (`gh pr list` if available).
- Whether the live database schema matches the migrations on this branch — **read-only check only, never run migrations to find out**; if there's no live DB connection available in this session, say so explicitly rather than assuming it matches.

STEP 4 — Determine next task and model.
- What TASKS.md says is next (check "Current focus" and the first unstarted `Next Action`).
- Check for a documented `Model:` tag on that item (Model Assignment Convention, TASKS.md). If none exists, propose one — **Opus 5** for architecture/security/schema-design decisions or anything touching HITL enforcement, **Sonnet 5** for well-scoped feature/CRUD/config work, **Haiku 4.5** for small mechanical fixes — and confirm with the user before writing code.
- If the next item has open product questions blocking it (check TASKS.md/MEMORY.md for "not started, needs user decision" notes), surface those questions instead of guessing an answer.

STEP 5 — Report back, then wait.
- Summarize Steps 0–4 concisely: doc-trust caveats found, git/branch/worktree state, any schema drift, proposed starting point + model + reasoning.
- Explicitly surface anything left open from the previous session first (uncommitted work, unmerged/undeleted branches, stale docs discovered) — before proposing new work.
- Wait for explicit go-ahead before writing any code, unless the user's message already specifies exactly what to build.
