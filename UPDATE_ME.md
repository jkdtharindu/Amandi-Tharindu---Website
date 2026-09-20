# Update Me

Say "update the md file(s)", "update the markdown", or "sync the docs" at any point in a
session — not just at the end — and this file runs. It's the lightweight sibling of
`SESSION_END_PROMPT.md`: that one is a full session-close audit (tests, build, lint, docs,
push). This one answers a narrower question — **does what's written in the docs still match
what actually happened in this chat?** — and fixes it immediately, using the conversation
itself as the source of truth.

Pairs with:
- `STARTUP_PROMPT.md` — reads project state before working starts.
- `SESSION_END_PROMPT.md` — the full close-out pass. Run that instead of this one when the
  session is actually ending — it covers everything this file does, plus tests/build/lint and
  the push question.

---

## Trigger phrases

"update the md file(s)", "update markdown", "run the update", "sync the docs" — any close
phrasing counts. The phrase itself is the trigger. Don't ask which file or what changed —
that's what this process figures out.

## What "the context window" means here

Read back through **this conversation** first — not a fresh `git log` archaeology exercise —
for:
- What was actually decided, built, fixed, or explicitly deferred.
- Any HITL checkpoint that was raised in this chat, and how it was answered.
- Anything the user said that changes scope, priority, or a prior assumption.
- Any bug, risk, or open question surfaced but not yet resolved.

Then cross-check that against reality before writing anything down:
```
git status
git diff --stat
git log --oneline -5
```
The chat tells you *what happened and why*; git tells you *what's actually on disk*. Write
down only what both agree on. If the chat claims something git doesn't back up (e.g. "we
fixed X" but the file is unchanged, or "tests pass" with no test run in this session), flag
the mismatch instead of recording it as fact.

## Where it goes

Match the existing home for each kind of fact — don't invent a new place for it:
- **`TASKS.md`** — "Current focus," "Priority," and Next Actions. Update these first; it's
  the most-read file, and most sessions only need this one touched.
- **`MEMORY.md`** — only if this chat made a real architectural/technology decision,
  corrected a past mistake, or deprecated a pattern. It is a decision log, not a session
  diary — routine work doesn't get an entry (see the file's own stated rule).
- **`MVP.md`** — only if launch-blocking scope changed (something added to, or checked off,
  "What's left before launch").
- **`SHARED_STATE.md`** / **`UBIQUITOUS_LANGUAGE.md`** — only if this chat changed how data
  flows between the admin and guest portals, or introduced/renamed a domain term.

If nothing in this chat actually changed any of the above, say so and don't force an entry —
the same rule `SESSION_END_PROMPT.md` states for its own pass.

## Model

**Haiku 4.5** by default — this is mechanical synthesis of a conversation that already
happened, not a design decision. Escalate to **Sonnet 5** if the update requires judgment
about an ambiguous or contested point (e.g. reconciling two different accounts of what was
actually agreed). See `TASKS.md`'s Model Assignment Convention — this file follows the same
convention, it doesn't set its own.

## Rules

1. **Write, don't propose.** Per `HITL.md`, doc-only edits are not a HITL action — don't ask
   permission first, just write the files and show what changed afterward.
2. **Don't wait for the session to end.** This is meant to run mid-conversation, right after a
   decision is made, as many times as asked.
3. **Don't pad.** A one-line addition to "Current focus" is a complete, correct run of this
   file. Don't manufacture a `MEMORY.md` entry just to look thorough.
4. **Report what changed.** After writing, state plainly which files were touched and what
   was added or changed in each, so the user can tell at a glance without re-reading a diff.
