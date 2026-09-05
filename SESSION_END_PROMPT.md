# Session End Prompt

Paste this at the end of a working session on this project, before closing the chat.

Pairs with `STARTUP_PROMPT.md` — that one reads state before working; this one records what
changed. Don't re-run STARTUP_PROMPT.md's full audit here: you already know what happened this
session because you just did it. This is about writing it down, not rediscovering it.

---

Do the end-of-session documentation pass.

STEP 0 — Scope what actually happened this session, from git, not memory.
```
git status
git diff --stat
git log --oneline -10
```
- List: files touched, tests added/changed, migrations touched, features shipped vs. only
  scoped/designed, any HITL checkpoints that were presented and answered.
- If nothing meaningful changed (pure Q&A, no edits), say so and stop — don't force an entry
  into files below for a session that didn't change anything.

STEP 1 — Write a MEMORY.md entry, only if one is warranted.
- MEMORY.md is append-only and has exactly four sections: Architectural decisions, Technology
  choices, Past mistakes and corrections, Deprecated patterns. It is a decision log, not a
  session diary — routine feature work with no notable decision, trade-off, or mistake does
  **not** get an entry.
- If this session made an architectural/technology decision, corrected a past mistake, or
  deprecated an approach, draft the entry matching the file's existing format exactly:
  ```
  [YYYY-MM-DD] Decision|Mistake: <what>
  Reason: <why>
  Alternative considered|Correction: <what else was weighed, or how it was fixed>
  ```
- Show the drafted entry to the user before appending it — MEMORY.md records agreed decisions,
  not unilateral narration of what the AI thinks happened.

STEP 2 — Update TASKS.md.
- Check off items actually completed this session (`[x]`/`[✔]`) — only after confirming tests
  were written, run, and are green (per the file's own stated rule). Don't mark done on
  intention alone.
- Add new backlog entries / Next Actions for anything scoped or designed this session but not
  yet built (e.g. a PRD section written, a migration drafted but not applied) — tag each with
  a proposed `Model:` per the Model Assignment Convention, and flag it as unconfirmed.
- Update "Current focus" / "Priority" in Project Status and the "PRD Alignment Summary" if a
  PRD section was added or changed.

STEP 3 — Flag or fix doc drift discovered this session — and feed it back into STARTUP_PROMPT.md.
- If you found a stale doc claim while working (a schema doc describing a table that doesn't
  match `migrations/*.sql`, a "not yet built" note for something that shipped, etc.), either
  fix it inline with a dated note, or record it as a caveat.
- If the drift changes how a future session should classify a file (e.g. a docs/-only file
  turns out to be actively maintained, or a previously-trusted file is now found stale),
  update STARTUP_PROMPT.md's Step 0 doc map itself — that map should stay accurate for the
  *next* session, not just describe today's discovery here.

STEP 4 — Run the sanity checklist before finishing.
- [ ] Tests added/updated and run green (`npm test`)
- [ ] Build and lint clean on any changed TypeScript/React files (`npm run build`, targeted
      `eslint` on changed files at minimum)
- [ ] New or changed domain concepts added to `UBIQUITOUS_LANGUAGE.md`
- [ ] Any schema change lives in a real migration file, and any doc describing that table
      updated to match (or explicitly flagged as not yet updated)
- [ ] A new category of sensitive action (deploys, migrations, deletes, external sends) is
      reflected in `HITL.md` if this session introduced one
- [ ] `BRANCH_STRATEGY.md` still accurate if branch/merge process changed this session

STEP 5 — Present the proposed doc changes, then wait.
- Show the exact MEMORY.md entry (if any) and the exact TASKS.md diff (checkboxes flipped,
  new entries added) before writing them — these are collaborative records, not unilateral
  edits, even though they don't require the full HITL checkpoint format (`HITL.md` explicitly
  exempts doc-only changes).
- Do not commit or push anything as part of this pass unless the user separately asks —
  writing the docs and committing them are two different requests.
