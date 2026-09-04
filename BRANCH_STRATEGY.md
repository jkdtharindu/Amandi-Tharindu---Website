# Branch Strategy & Merge Protocol

**Status:** Active SOP (enforced starting 2026-09-04)

## Overview

This project has a history of branch divergence (e.g., `feature/ui-wrapping` built in parallel with `feature/nextjs-supabase-migration` but was never merged, causing 5+ days of schema/code drift). This document prevents that by enforcing a clear branch lifecycle and merge discipline.

## Primary Branch Rules

### Active Development Branch
- **Current:** `feature/nextjs-supabase-migration`
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

## Current State (as of 2026-09-04)

**Issue identified:** `feature/ui-wrapping` (last commit 2026-08-30) contains:
- Migrations 003–008 (8 total, vs. 2 on primary branch)
- Complete Theme Editor, Section Manager, Table Arrangement features
- Supabase Storage adapter
- **Status:** Unmerged, partially applied to live database (migrations 004–008 were run, code was not merged in)

**Decision required:** Merge or archive this branch. Until then, TASKS.md and future sessions should treat it as a known drift issue.

## References
- TASKS.md — tracks feature slices and completion status
- MEMORY.md — records decisions and past issues
- HITL.md — gates database migrations on live databases
