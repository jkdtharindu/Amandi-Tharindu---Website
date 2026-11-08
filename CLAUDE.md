@AGENTS.md

## Communication Style
- Explain things in clear, simple English — short, direct sentences over long or technical ones.
- Avoid unnecessary jargon. If a technical term is unavoidable, briefly say what it means in plain language.
- When giving feedback or a summary, lead with the plain-language takeaway before any technical detail.

## Vibe Check Abbreviations
When the user says one of these trigger phrases (in any phrasing — "roast this," "give it a
roast," etc.), immediately open `docs/VIBE_CHECKS.md`, jump to the matching section, and run
its criteria against whatever code/diff/feature is currently in view. Do not ask which
section applies — the phrase itself selects it. Full ground rules and how to add new ones
are in that file.

- **"Roast me"** → Roast Me section — harsh, specific critique of real flaws
- **"Toast me"** → Toast Me section — genuine positive pass on what's solid
- **"Grill me"** → Grill Me section — the existing pre-build clarifying-questions convention
  (see `STARTUP_PROMPT.md` Step 0.6) — not a code critique

## Doc Update Trigger
When the user asks to "update the md file(s)," "update the markdown," or "sync the docs" —
any phrasing, at any point in a session, not just at the end — immediately open `UPDATE_ME.md`
and follow it. It uses this chat's own conversation as the source of truth for what changed,
cross-checked against git state, and writes straight into the relevant docs. Don't wait for
session end and don't ask which file — the phrase is the trigger.

## User Guide Trigger
When the user asks for a user guide, user manual, how-to, admin instructions, or a PDF guide for
any feature — any phrasing — immediately open `docs/USER_GUIDE_PLAYBOOK.md` and follow it. Every
guide uses the same format: real screenshots of the running website with sample data, numbered
markers, a step-by-step page per task, caution boxes, and a "Not built yet" box for any gap. Don't
ask which format; the playbook is the format.

## Shared State Doc
Before changing anything that crosses the Admin portal (`app/admin/**`) and the Guest portal
(`app/(public)/**`) — shared data shapes, RSVP status derivation, cache revalidation, or
theme/section/celebration-event content — read `SHARED_STATE.md` first. If the change makes
anything in that file wrong, update the file in the same commit.
