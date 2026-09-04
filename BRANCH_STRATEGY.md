# Branch Strategy & Merge Protocol

**Status:** Active SOP (enforced starting 2026-09-04)

## Overview

This project has a history of branch divergence (e.g., `feature/ui-wrapping` built in parallel with `feature/nextjs-supabase-migration` but was never merged, causing 5+ days of schema/code drift). This document prevents that by enforcing a clear branch lifecycle and merge discipline.

## Primary Branch Rules

### Active Development Branch
- **Current:** `main`, directly, until the next feature branch is opened. `feature/nextjs-supabase-migration` (the previous primary) merged into `main` via PR #4 on 2026-09-04 (commit 3560128) and was deleted, both locally and on origin.
- Only one primary feature branch at a time.
- All in-progress work targets this branch (or a short-lived feature branch off it).
- Code + database must stay in sync: no migration is applied to the live database unless its migration file exists **committed** on this branch.

### Branch Lifetime Limits
- Feature branches off the primary branch: **max 2 weeks** before merge or deletion.
- If a branch is not merged within 2 weeks, it must be either:
  1. **Merged** into the primary branch (preferred), or
  2. **Explicitly archived** — move to `archive/` prefix (e.g., `archive/feature/old-idea-2026-08-30`) and document why in TASKS.md or this file.
- No "forgotten" branches lying around with committed work.

### Database Migrations

**Golden rule:** A migration file must be:
1. **Authored** on the active primary branch.
2. **Committed** to that branch.
3. **Only then applied** to the live database (via HITL checkpoint).

If a migration exists on an unmerged branch and was applied to the live database without the corresponding code being merged in, that's a **schema/code drift bug** — treat it with the same urgency as a data corruption. Document it in MEMORY.md and resolve within one session.

### Merging Protocol

When merging a feature branch into the primary:
1. Verify all tests pass on the feature branch (`npm test`).
2. Verify the build succeeds (`npm run build`).
3. Create a pull request (even locally, describe it in git log).
4. If migrations are included, confirm they're idempotent and the commit message names them.
5. Merge via `git merge --no-ff` (preserves history that a merge happened) or create a squash commit if the branch history is messy.
6. **Do not fast-forward** — fast-forward merges hide that parallel work existed.
7. Update TASKS.md to mark the slice/feature as complete.

### Archive Protocol

If a branch is abandoned:
1. Rename it to `archive/feature/<name>-<date>` (e.g., `archive/feature/experimental-auth-2026-08-30`).
2. **Do not delete** — keep it for historical reference.
3. Add an entry to MEMORY.md under "Abandoned Branches" with:
   - Branch name
   - Why it was abandoned (didn't pan out, superseded by other work, etc.)
   - Date archived
   - Any key commits to reference if the idea is revisited later

### Cross-Session Coordination

When multiple Claude sessions are working on the same repo:
1. **Do not make assumptions** about what other sessions have done — check `git status`, `git log --all`, and `git branch -a` before starting new work.
2. **Run `git fetch --all`** at the start of a session to see remote branches.
3. If you discover unmerged work in a parallel branch:
   - Do not duplicate it — investigate first.
   - Do not merge branches yourself — surface the situation to the user for a decision.
4. **Stash before switching branches** — never lose in-progress work due to a branch switch.

## Preventing Drift

### Pre-Session Checklist
- [ ] What is the primary feature branch? (`git branch -a` to confirm)
- [ ] What branches exist locally and on origin? (`git branch -a`)
- [ ] Are there any branches older than 2 weeks that are not merged/archived? (If yes, flag to the user)
- [ ] Is the live database schema ahead of the primary branch's migration files? (Check by reading the live table schema vs. the latest migration file)

### Red Flags
- A migration file exists on `origin/` but not on the primary branch.
- A feature branch has commits authored more than 2 weeks ago and is not merged.
- Multiple branches have recent commits that touch the same files (indicates parallel work that should have been merged earlier).
- Database has a column/table that doesn't match any migration file in `migrations/`.

## Current State (as of 2026-09-04, end of day)

**Resolved — `feature/ui-wrapping` divergence:** merged into `feature/nextjs-supabase-migration` earlier today (commit 4a9f07a), bringing in migrations 003–008, Theme Editor, Section Manager, Table Arrangement, and the Supabase Storage adapter. No longer a known drift issue.

**Resolved — a second, independent divergence found the same day:** while opening PR #4 (`feature/nextjs-supabase-migration` → `main`), GitHub reported a merge conflict — `main` had, in parallel and without visibility into this branch, built its own competing Theme Editor (different files, different `theme_settings` schema, both migrations numbered `003`). Resolved by keeping this branch's schema (already live) and porting `main`'s working UI onto it. Full writeup: MEMORY.md 2026-09-04 ("Past mistakes"). PR #4 merged to `main` (commit 3560128); `feature/nextjs-supabase-migration` deleted after.

**Later the same day — branch audit and cleanup:** a docs-accuracy audit (separate from the two divergences above) triggered a full review of every branch's actual content rather than assuming staleness from commit topic/age (per this doc's own Pre-Session Checklist). Found: `claude/mobile-only-session-qj1ixz` contained genuine unmerged work (rate-limiting/security-headers/request-logging middleware, RLS policies) rather than being a stale duplicate; the other two candidates (`claude/review-md-files-project-1nfubd`, `claude/token-context-usage-jtjdsp`) were confirmed genuinely superseded. All three archived to `archive/` (not deleted) per this doc's Archive Protocol — see MEMORY.md 2026-09-04 "Abandoned Branches" for the full reasoning per branch. Separately, four branches confirmed fully merged into `main` (`master`, `feature/ui-wrapping`, `work/next-slice`, `claude/admiring-lichterman-242e4f`) were deleted outright — no archive needed since `git branch -d`'s merge check makes that safe.

**No known open drift as of this entry.** `main` is the sole active line of development until a new feature branch is opened.

## References
- TASKS.md — tracks feature slices and completion status
- MEMORY.md — records decisions and past issues
- HITL.md — gates database migrations on live databases
