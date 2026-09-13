# Vibe Check Abbreviations

Short trigger phrases that ask the AI to run a specific, structured feedback pass over
whatever code, diff, or feature is currently in view. Each phrase maps to one section below
— that section is the complete criteria for that pass. See `CLAUDE.md` for the instruction
that makes the mapping automatic.

| Say this | Section | What it does |
|---|---|---|
| "Roast me" / "roast this" | [Roast Me](#roast-me) | Harsh, specific critique — finds every real flaw, doesn't soften it |
| "Toast me" / "toast this" | [Toast Me](#toast-me) | Genuine positive pass — names what's actually solid and should be left alone |
| "Grill me" | [Grill Me](#grill-me) | Interrogates a proposed feature with clarifying questions *before* it's built — this is the existing "Grill Me session" convention, not a new one |

## Ground rules for all of these

- **Run immediately, don't ask which section applies.** The trigger phrase *is* the
  selection. If the user says "roast me," jump to Roast Me and start — don't ask "roast
  what, the whole app or this file?" Default to the most recent diff or the file/feature
  under active discussion; ask only if there's genuinely nothing in view to check.
- **These are feedback passes, not actions.** Running a Roast/Toast/Grill pass never itself
  triggers `HITL.md` — it only reads and reports. If the pass surfaces something that
  *should* change (a fix, a migration, a deploy), that follow-up action still goes through
  the normal HITL and confirmation rules; the check itself does not.
- **Stay specific to this codebase.** Cite actual files, lines, and this project's own
  stated scope (Tier 1 per `docs/VIBE_CODING_PRODUCTION_CHECKLIST.md`) rather than generic
  advice that would apply to any project.

---

## Roast Me

Trigger: "roast me", "roast this", "roast the [feature/file/PR]".

A harsh, specific, no-softening critique. The point of a roast is that it hurts a little
because it's true and useful — not because it's mean for its own sake. Every line has to be
backed by a concrete reason; a roast that's just insults with no substance is a failed roast.

### What to roast

Go through these in order, and stop padding once you run out of real material — a short,
sharp roast beats a long one full of filler:

1. **Correctness.** Bugs, wrong assumptions, edge cases that will actually happen with this
   project's real data (guest lists, RSVP codes, invitation states) — not hypothetical
   enterprise-scale scenarios.
2. **Security, sized to this project's actual tier.** Check against the Tier 1 items in
   `docs/VIBE_CODING_PRODUCTION_CHECKLIST.md` — input validation, secrets, auth, rate
   limiting on anything public. Do NOT roast the absence of Tier 2/3 items (load testing,
   distributed tracing, multi-tenancy) — that's not a flaw here, it's correctly out of scope,
   and roasting it anyway is itself a mistake the checklist warns against.
3. **Lazy AI patterns.** Dead code, copy-pasted blocks that should be one function, error
   handling for things that can't happen, comments that just restate the code, abstractions
   built for a "someday" that isn't in the PRD.
4. **Inconsistency with this codebase specifically.** Does it match `UBIQUITOUS_LANGUAGE.md`
   terms? Does it duplicate something that already exists elsewhere in the app? Does it
   contradict a documented decision in `MEMORY.md`?
5. **What a senior engineer would wince at** if they read this diff cold, with no context on
   why it was written this way.

### Format

- Rank findings worst-first. Lead with the thing that would actually cause a problem for a
  real guest or the site owner, not the thing that's easiest to spot.
- Name the file and line. "This is sloppy" is not a roast, it's a vibe — `app/foo.ts:42
  swallows the DB error and returns 200 anyway` is a roast.
- If there's genuinely nothing wrong, say that plainly instead of inventing nitpicks to fill
  space. A roast with nothing to roast is a compliment — don't dress it up as one.
- End with the single worst offender, called out by name, if there's more than one finding.

---

## Toast Me

Trigger: "toast me", "toast this", "toast the [feature/file/PR]".

The mirror of Roast Me: a genuinely positive pass, not empty flattery. The bias when
reviewing AI-written code is to always go hunting for what's wrong — that's useful, but it
also means solid, correctly-scoped decisions rarely get acknowledged, which makes it hard to
tell "good enough, leave it" from "nobody's looked yet." A toast fixes that.

### What to toast

1. **What's genuinely well done**, named specifically — not "good job on the RSVP flow" but
   *what* about it is good: "the invitation-code lookup is a single indexed query, no N+1,
   and it fails closed on a bad code instead of leaking whether the code almost matched."
   Praise that could apply to any code is not a toast.
2. **What's correctly "good enough" and should be left alone.** Per
   `docs/VIBE_CODING_PRODUCTION_CHECKLIST.md`'s own framing, this is a Tier 1 project —
   correctly *not* building rate-limit sharding, read replicas, or a load-testing harness is
   a good decision, not a gap. Call out places where the right amount of engineering was
   applied, especially if a Roast pass (or instinct) might mistake "simple" for "unfinished."
3. **Good trade-offs under real constraints** — a deliberate scope cut recorded in
   `MEMORY.md`, a simpler pattern chosen over a fancier one that would've added risk for no
   real benefit, matching an existing convention instead of introducing a new one.
4. **Progress worth noticing** — something that was broken, ambiguous, or missing before this
   session and now genuinely isn't.

### Format

- Be specific and be honest — if something is only mediocre, don't inflate it to "great."
  A toast that praises everything equally is as useless as a roast that finds fault in
  everything equally; both stop giving useful signal.
- It's fine for a toast to be short. Three true, specific things beat ten generic ones.
- If a Roast pass was run recently on the same code, the toast doesn't need to relitigate
  those findings — it's fine for something to have real flaws *and* real strengths at once.

---

## Grill Me

Trigger: "grill me".

This is **not** a new criteria set — it's a pointer to the convention this project already
uses, so that "grill me" dispatches correctly alongside Roast Me and Toast Me instead of
being handled ad hoc.

A "Grill Me session" means: before writing a spec or building a proposed feature, ask
clarifying questions about it — don't guess at ambiguous requirements. The answers get
written down with today's date as a dated "Grill Me session," and acceptance criteria follow
from those answers. See:

- `STARTUP_PROMPT.md` Step 0.6 — states the convention and when to use it.
- `docs/amandi-tharindu-wedding-PRD.md` §14–§16 — worked examples of dated Grill Me sessions
  (clarifying questions asked, owner's answers, resulting spec).
- `MEMORY.md` and `UBIQUITOUS_LANGUAGE.md` — reference past Grill Me decisions when a new one
  touches related ground, so answers don't contradict an earlier one without noticing.

### What to do when "grill me" is said

1. Identify the feature or change being discussed that's still ambiguous.
2. Ask the specific questions whose answers would change the design — not generic
   discovery questions, and not questions already answered elsewhere in the docs above.
3. Record the answers as a dated "Grill Me session" in the relevant spec (PRD section, or
   wherever that feature's spec lives), matching the existing format.
4. Only then write acceptance criteria or start building.

If "grill me" is said about existing code rather than a proposed feature, that's closer to a
Roast — check whether Roast Me is what's actually wanted before defaulting here.

---

## Adding a new abbreviation

1. Add a new `## <Name> Me` section below, following the shape of Roast Me or Toast Me.
2. Add one row to the dispatch table at the top of this file.
3. Add one line to the dispatch list in `CLAUDE.md`.

That's the whole mechanism — no code, no config, just one section plus two index entries.
