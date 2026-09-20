# Startup Prompt

Paste this at the start of a new chat session on this project.

---

Start Working — New Session

STEP 0 — Doc map: know what's canonical before reading anything.
- **Canonical, actively maintained (read these):** root `MEMORY.md`, `TASKS.md`, `README.md`, `UBIQUITOUS_LANGUAGE.md`, `HITL.md`, `BRANCH_STRATEGY.md`.
- **Known-stale duplicates — do not read for current state, do not edit:** `docs/MEMORY.md`, `docs/TASKS.md`, `docs/WEDDING_UBIQUITOUS_LANGUAGE.md`. A 2026-08-29 consolidation copied these under `docs/` but every session since kept editing the root copies. **One exception, until multi-admin is settled:** the 2026-09-20 multi-admin session added notes to these three `docs/` copies and not to the root ones, so they are kept for now — read them only for those multi-admin notes, then move the notes into the root files or drop them, and delete the copies. See MEMORY.md 2026-09-04.
- **Canonical, docs/-only (no root duplicate exists — this is its real home, not a spot-check tier):** `docs/amandi-tharindu-wedding-PRD.md` and `docs/BACKUP_RECOVERY.md`. Both actively maintained. New PRD feature specs (§14, §15, §16 as of 2026-09-05) are added directly to the PRD, each dated. `docs/BACKUP_RECOVERY.md` is the operational procedure for backups, encryption and restores, and carries a "what is proven, and what is not" table plus the owner's open checklist — read that table before repeating any claim about backups being safe. Read both as fact, not with the same suspicion as the tier below.
- **Also canonical, docs/-only, both merged to `main` 2026-09-09:** `docs/VIBE_CODING_PRODUCTION_CHECKLIST.md` and `docs/DEPLOYMENT.md`.
  - The checklist's **"How to Use This Checklist"** section is the part to read first: it sorts every item into three tiers by project size and states plainly that applying the whole document to a small project is itself a mistake. This project is **Tier 1**. TASKS.md Next Action 8 cites that table as the basis for right-sizing security work. (This file previously listed the checklist as "referenced but not on `main`" — that was true until 2026-09-09 and is now wrong; it is merged.)
  - `docs/DEPLOYMENT.md` is the deployment runbook. **The site deployed for real 2026-09-10** — live at `https://amandi-tharindu-website.vercel.app` — and the doc's §9 records what that actually looked like versus what was predicted before it happened; read §9 before trusting any other section's procedure as untested. Its §1 is load-bearing: `NEXT_PUBLIC_SITE_URL` must be set before any guest is messaged, or every invitation link points at `localhost` (it is set correctly on the live deploy). **Next Action 18a (the Neon database password) is fully closed as of 2026-09-13** — the password was rotated, and a follow-up `DATABASE_URL` misconfiguration in Vercel Production (a bare password pasted instead of the full connection string, which took the live database down entirely for several hours) was also found and fixed the same day. See MEMORY.md's 2026-09-13 entries for the full sequence if a similar Vercel-env-var issue recurs.
- **Docs-only (no root duplicate) but not guaranteed current — spot-check before trusting:** `docs/WEDDING_UI_UX_SPEC.md`, `docs/WEDDING_MODEL_SELECTION.md`, `docs/AGENTS.md`. For the list of API routes, read `app/api/` directly — the old prose API doc was removed 2026-09-20.
- **Written 2026-09-20 by a different session and not verified:** `docs/ADMIN_USER_MANUAL.md`, `docs/IMPLEMENTATION_SUMMARY.md` and `docs/FRONTEND_INTEGRATION_CHECKLIST.md` describe the multi-admin work, which is committed locally but unpushed, un-migrated and (as of that day) failing 9 tests. Read them as a plan, not a description of the live site. The PRD sections added the same day for multi-admin and for TASKS.md Actions 65, 66 and 68 are specs, not built features.
- **There is no prose schema doc.** `docs/WEDDING_DATABASE_SCHEMA.md` was removed 2026-09-20 — it described a schema that did not match what was built. It is still in git history, but do not restore it or quote it.
- **Real schema source of truth: `migrations/*.sql`, read directly.** Never infer schema from prose. Run `ls migrations` to get the current file list — do not assume the count below is still accurate:
  - 001 guests · 002 rsvp_responses · 003 admin/theme/sections · 004 theme palette+font · 005 messaging · 006 invitation code format · 007 table arrangements · 008 couple-name-order fix · 009 celebration_events · 010 probable_attendees (all ten confirmed applied to the live database on 2026-09-10 — `schema_migrations` matched the file list exactly, no drift) · 011 image_url · 012 invitees · 013 wedding_time · 014 theme text/surface colours · 015 couple profiles · 016 gallery_photos (011-016 confirmed applied 2026-09-15, verified read-only via a clean production build against the real `DATABASE_URL`) · 017 add `[Code]` to `reminder_2` and 018 `message_logs.guest_id` cascade (both applied per the owner on 2026-09-20 — owner-reported, not independently verified) · 019 sync guest headcounts (a data repair, pushed; not confirmed applied) · 020-022 multi-admin: `assigned_to_party` on `guests` and `seating_tables`, and `message_events` (written and committed locally, **not applied, not pushed** — TASKS.md Action 69; `ls migrations` for the current list).
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
  `.claude/launch.json` has this ready as `wedding-inmemory` (port 3020). After `preview_stop`,
  check port 3020 — the `next dev` process it started can survive; stop it by PID once you have
  confirmed its command line is `next dev -p 3020`. Since the site gate (PRD §15), every
  guest page shows the gate until you sign in; the in-memory guest is code `SILVA-001`.
  The entry's `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH` login is a throwaway for the in-memory server only. The unpushed multi-admin work reads separate bride/groom login settings instead, so re-check that this login still works once that lands.

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
- **A worktree whose branch is merged is not necessarily safe to delete.** Run `git status --porcelain` *inside* the worktree as well — the branch and its working tree are separate questions, and a worktree is exactly where uncommitted work sits. On 2026-09-10 a worktree was reported as "fully merged" and approved for deletion while holding the only copy of an uncommitted `Countdown.tsx` fix; `git worktree remove` would have needed `--force`, which is the moment such work disappears quietly. See MEMORY.md 2026-09-10.
- Don't trust `git branch --merged` formatting alone on a long list — confirm per-branch with:
  `git merge-base --is-ancestor <branch> main && echo merged || echo "NOT merged"`
- `git ls-remote --heads origin` can surface a remote branch that local cleanup missed (a branch fully merged but never `git push origin --delete`d) — treat that as harmless housekeeping, not drift, once you've confirmed it's merged.
- Flag any branch/worktree with commits older than 2 weeks that is not merged or archived, per `BRANCH_STRATEGY.md`.
- Note any uncommitted changes, distinguishing "looks intentional/pending a decision" from genuinely unrecognized.
- Check for open PRs waiting on a merge/close decision (`gh pr list` if available).
- Whether the live database schema matches the migrations on this branch — **read-only check only, never run migrations to find out**; if there's no live DB connection available in this session, say so explicitly rather than assuming it matches.

STEP 4 — **[PRIORITIZED] Determine claude model for this session.**
- Check for a documented `Model:` tag in TASKS.md on the next item (Model Assignment Convention, TASKS.md).
- If no model is specified, **propose one now** — **Opus 5** for architecture/security/schema-design decisions or anything touching HITL enforcement, **Sonnet 5** for well-scoped feature/CRUD/config work, **Haiku 4.5** for small mechanical fixes.
- **Confirm the model choice with the user before proceeding.** Do not assume the default model is correct for this task.

STEP 5 — Determine next task.
- What TASKS.md says is next (check "Current focus" and the first unstarted `Next Action`).
- If the next item has open product questions blocking it (check TASKS.md/MEMORY.md for "not started, needs user decision" notes), surface those questions instead of guessing an answer.

STEP 6 — Report back, then wait.
- Summarize Steps 0–5 concisely: doc-trust caveats found, git/branch/worktree state, any schema drift, proposed starting point + model + reasoning.
- Explicitly surface anything left open from the previous session first (uncommitted work, unmerged/undeleted branches, stale docs discovered) — before proposing new work.
- Wait for explicit go-ahead before writing any code, unless the user's message already specifies exactly what to build.
