# Startup Prompt

Paste this at the start of a new chat session on this project.

---

Start Working — New Session

STEP 1 — Read project state cheaply. Don't read whole files unless necessary; grep to verify individual facts.
- Read TASKS.md: current status, priorities, "Next Actions," open blockers.
- Read the most recent 2–3 dated entries in MEMORY.md: recent decisions, past mistakes, last session's summary.
- Read BRANCH_STRATEGY.md (or equivalent SOP) if present.
- Read HITL.md: what requires explicit approval before acting.

STEP 2 — Don't trust the md files blindly; spot-check them against the actual code.
- Pick 2–3 of the most recent "[✔] done" or "merged" claims in TASKS.md and verify they're actually true in the working codebase — files/routes exist, and the described behavior is reachable from the real production entrypoint, not just a legacy or test-only path.
- If a claim doesn't hold up, flag it — don't act on it as fact, and don't silently "fix" the docs without saying so first.

STEP 3 — Check git/branch state.
- Current branch: ahead/behind origin, and any uncommitted changes — including ones left over from a prior session. Distinguish "looks intentional/pending a decision" from genuinely unrecognized.
- Any unmerged branches older than 2 weeks, and what's on them.
- Any other active sessions/worktrees, and any open PRs waiting on a merge/close decision.
- Whether the live database schema matches the migrations present on this branch (read-only check only — don't run migrations to find out).

STEP 4 — Determine next task and model.
- What TASKS.md says is next.
- Check for a documented `Model:` recommendation (Model Assignment Convention in TASKS.md). If none exists, propose one — Opus for architecture/security/schema decisions, Sonnet for well-scoped feature/CRUD/config work, Haiku for small mechanical fixes — and confirm with me before writing code.

STEP 5 — Report back, then wait.
- Summarize all of the above concisely.
- Explicitly surface anything left open from the previous session first (uncommitted docs, unmerged PRs, branches pending cleanup) — before proposing new work.
- State your proposed starting point and model recommendation, with reasoning.
- Wait for my explicit go-ahead before writing any code, unless I've already told you exactly what to build.
