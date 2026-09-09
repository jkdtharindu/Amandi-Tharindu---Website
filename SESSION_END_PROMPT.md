# Session End Prompt

Paste this at the end of a working session on this project, before closing the chat.

Pairs with `STARTUP_PROMPT.md` — that one reads state before working; this one records what
changed. Don't re-run STARTUP_PROMPT.md's full audit here: you already know what happened this
session because you just did it. This is about writing it down, not rediscovering it.

---

Do the end-of-session documentation pass.

## Priority order — do these in this order, and do not stop early

1. **Write the docs.** MEMORY.md and TASKS.md updates are *written to disk*, not proposed.
   A session that ends with "here's what I would write" has not done this pass.
2. **Record what's next.** Every piece of work scoped, discovered, or deliberately deferred
   this session exists as a TASKS.md Next Action before the session ends.
3. **Report git state explicitly.** Name the unpushed commits by hash. Never leave the push
   question implicit or unanswered.
4. **Verify.** Tests, build, and `npm run check-docs` all run and reported honestly.

Only step 3's *push itself* waits for the human. Steps 1, 2 and 4 are the assistant's job to
complete, not to offer.

---

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
- Root `MEMORY.md` is canonical. `docs/MEMORY.md` is a stale duplicate — never edit it.
- MEMORY.md is append-only and has exactly four sections: Architectural decisions, Technology
  choices, Past mistakes and corrections, Deprecated patterns. It is a decision log, not a
  session diary — routine feature work with no notable decision, trade-off, or mistake does
  **not** get an entry.
- If this session made an architectural/technology decision, corrected a past mistake, or
  deprecated an approach, write the entry matching the file's existing format exactly:
  ```
  [YYYY-MM-DD] Decision|Mistake: <what>
  Reason: <why>
  Alternative considered|Correction: <what else was weighed, or how it was fixed>
  ```
- Record mistakes with the same candour as decisions, including ones made earlier in this same
  session. A correction caught before the user saw it is still worth writing down — the point
  is that the next session doesn't repeat it.
- Also append a dated entry to section 5 (Last session summary) covering what shipped, what was
  deliberately not done, and what the owner must pick up.

STEP 2 — Update TASKS.md.
- Check off items actually completed this session (`[x]`/`[✔]`) — only after confirming tests
  were written, run, and are green (per the file's own stated rule). Don't mark done on
  intention alone. If something is done-with-caveats, state the caveat in the line itself
  rather than rounding it up to done.
- Add new backlog entries / Next Actions for anything scoped or designed this session but not
  yet built — tag each with a proposed `Model:` per the Model Assignment Convention, and flag
  it as unconfirmed. Keep Next Actions in numeric order.
- Update "Current focus" and "Priority" in Project Status, and the "PRD Alignment Summary" if a
  PRD section was added or changed. Priority should name the single item whose failure mode is
  worst, not just the next chronological one.

STEP 3 — Flag or fix doc drift discovered this session — and feed it back into STARTUP_PROMPT.md.
- If you found a stale doc claim while working (a schema doc that doesn't match
  `migrations/*.sql`, a "not yet built" note for something that shipped), either fix it inline
  with a dated note, or file it as a Next Action. Say which you did.
- **Fix drift immediately, rather than filing it, when leaving it broken would block the next
  session or the next PR** — a failing CI gate, a script that cannot succeed, a command whose
  output is unusable. File the rest.
- If the drift changes how a future session should classify a file, update STARTUP_PROMPT.md's
  Step 0 doc map itself — that map should stay accurate for the *next* session.

STEP 4 — Run the sanity checklist before finishing. Report each as pass/fail, not as intent.
- [ ] `npm test` — run, and the actual count reported
- [ ] `npm run build` clean
- [ ] `npm run check-docs` passes (it runs on every PR; a failure here blocks the merge)
- [ ] Lint on changed files. Note that repo-wide lint output is dominated by
      `.claude/worktrees/` noise — report problems in *changed files*, never a raw total
- [ ] New or changed domain concepts added to `UBIQUITOUS_LANGUAGE.md`
- [ ] Any schema change lives in a real migration file, and any doc describing that table
      updated to match (or explicitly flagged as not yet updated)
- [ ] A new category of sensitive action (deploys, migrations, restores, deletes, external
      sends) is reflected in `HITL.md` if this session introduced one
- [ ] `BRANCH_STRATEGY.md` still accurate if branch/merge process changed this session

STEP 5 — Write the changes, then report. Do not ask permission to write documentation.
- Write the MEMORY.md and TASKS.md changes. These are doc-only edits, which `HITL.md`
  explicitly exempts from the HITL checkpoint — asking first just costs the user a round trip.
- Show what was written afterwards, so it can be checked and corrected.
- **Then state git state plainly and answer the push question in the same breath:** list the
  unpushed commits by hash and one-line message, and ask once whether to push. `git push` to
  main is HITL-gated and genuinely does need confirmation — but the asking is a single clear
  question at the end, not a reason to leave the documentation unwritten.
- The session is not finished while any of the following is true: MEMORY.md/TASKS.md still hold
  only proposals, discovered work exists nowhere in TASKS.md, or the user has to ask "did you
  actually write it?"
