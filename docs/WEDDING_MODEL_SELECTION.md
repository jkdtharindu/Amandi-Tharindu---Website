# Claude Model Selection Guide — Amandi & Tharindu Wedding Website

**MANDATORY CHECKLIST:** Before Claude starts work on any slice or subtask, Claude MUST:
1. **Identify the slice/task** from this file
2. **Announce the recommended model** (Opus 5 / Sonnet 5 / Haiku 4.5)
3. **Ask you to confirm:** "What model do you currently have selected?"
4. **Wait for your confirmation** before proceeding
5. **Do NOT start coding** until you confirm the model matches

This is a mandatory quality gate to ensure code quality and efficiency. 

This file is the wedding project's own copy of this pattern — see the generic
`MODEL_SELECTION.md` in Knowledge, which is Senhill's and should not be used for this project.

---

## Model Overview

| Model | Best For | Speed | Reasoning | Cost |
|-------|----------|-------|-----------|------|
| **Opus 5** | High-complexity tasks, multi-constraint validation, large UI systems | Slower | Excellent | Higher |
| **Sonnet 5** | Most tasks, APIs, business logic, tests | Fast | Very Good | Medium |
| **Haiku 4.5** | Simple CRUD, docs, straightforward work | Very Fast | Good | Low |

---

## Slice Assignments & Model Requirements

### ✅ COMPLETED (Slices 1–9) — retroactive assignment

No model checks needed going forward for these — already shipped. Assignments below are inferred
from the actual complexity of each slice (per `TASKS.md`'s Current Slice Details), since no
model was tracked for the project until now.

- **Slice 1 (Guest login by code):** **Sonnet 5** — straightforward lookup + session creation,
  single code path, no multi-constraint logic. Sonnet-appropriate.
- **Slice 2 (Guest login by name):** **Sonnet 5** — same shape as Slice 1 plus a fallback branch.
- **Slice 3 (Ambiguous-name recovery):** **Sonnet 5** — adds a UI selection step and a
  candidates-vs-exact-match branch, but no deep validation logic. Still Sonnet-appropriate.
- **Slice 4 (Personalized invitation + accept/decline):** **Opus 5 recommended in hindsight** —
  this slice combines template rendering, name-overlay positioning from admin-configured
  settings, HTML escaping, and two RSVP paths (accept with capped participant count, decline
  with messaging). It also shipped with a P0 production bug (`getCookieValue()` undefined on
  this page — see `MEMORY.md`, 2026-08-23) that API-level tests didn't catch. Flagging this
  retroactively as a slice that warranted the extra scrutiny an Opus pass or wider verification
  would have given it.
- **Slice 5 (RSVP change/update):** **Sonnet 5** — overwrite-not-duplicate logic is a single
  clear rule, low complexity.
- **Slice 6 (Sticky RSVP bar):** **Haiku 4.5** — presentational, conditional visibility only,
  no business logic of its own.
- **Slice 7 (Admin authentication):** **Sonnet 5** — session/CSRF/auth patterns are
  well-established; no novel reasoning required, but security-sensitive enough to warrant
  Sonnet over Haiku.
- **Slice 8 (Admin Theme Editor):** **Opus 5 recommended in hindsight** — six independent form
  groups, validation, CSS-custom-property cascade to the entire public site, and a WCAG
  contrast calculation (`readableTextColor()`). This slice also shipped **write-only**
  (`getThemeSettings()` was never read by the public site) and needed a same-day fix — the kind
  of cross-cutting integration gap Opus is better at catching before ship. See Review Findings
  Backlog in `TASKS.md`.
- **Slice 9 (Admin Section Manager):** **Sonnet 5** — CRUD + visibility toggle per page/section
  type, same write-only defect as Slice 8 but simpler surface area once the Theme Editor's
  cascade pattern existed to follow.

**Pattern worth naming:** both cross-cutting "does the saved value actually reach the public
site" defects (Slices 8 and 9) happened on Sonnet 5 without a wider verification pass. This
doesn't necessarily mean Opus 5 would have caught them — but per the exception-handling rule
below, future admin-surface slices with a public-facing rendering dependency should either use
Opus 5 or explicitly scale up verification to include a rendering-level (not just API-level)
assertion, per the lesson recorded in `MEMORY.md` (2026-08-23): *"API-level tests are not
sufficient evidence that a user flow works."*

---

### 🔜 NOT STARTED — forward recommendations

#### **Slice 10: Guest Management (P0-07)** → **OPUS 5 REQUIRED**
- **What:** Add/edit/soft-delete guests, auto-generate unique codes, filterable list by RSVP
  status and relationship group.
- **Why Opus 5 (not optional):**
  - Flagged in `TASKS.md` as the single highest-priority gap — the site cannot run a wedding
    without it, so defects here are costly
  - Code generation must not collide with the ~350 existing family-unit codes
  - Soft-delete must not break existing sessions/RSVPs tied to a guest record
  - Interacts directly with the login flows built in Slices 1–3 — regression risk is real
  
**⚠️ MANDATORY BEFORE START:**
Claude announces: "This is Slice 10 (Superseded by Slice 18). Recommended model: **Opus 5**. What model do you currently have selected?"
Wait for confirmation before proceeding.
- **Subtasks & their models:**
  - Guest CRUD + code generation: Opus 5
  - List/filter UI: Sonnet 5
  - Tests (unit + rendering-level, not just API-level): Opus 5
  - Docs update: Haiku 4.5

#### **Slice 11: RSVP Dashboard (P0-08)** → **SONNET 5 RECOMMENDED**
- **What:** Real-time stats (invited/accepted/declined/pending + headcount), chart, CSV export.
- **Why Sonnet 5:**
  - Read-only aggregation over data Slice 10 will already validate — no new business rules
  - Established pattern (dashboard/reporting) with low ambiguity

**⚠️ MANDATORY BEFORE START:**
Claude announces: "This is Slice 11 (Superseded by Slice 19). Recommended model: **Sonnet 5**. What model do you currently have selected?"
Wait for confirmation before proceeding.
- **Subtasks & their models:**
  - Aggregation queries: Sonnet 5
  - Chart + CSV export: Sonnet 5
  - Tests: Sonnet 5
  - Docs: Haiku 4.5

#### **Slice 12: Admin Messaging Center (P1-06, P1-07, P1-08)** → **OPUS 5 REQUIRED**
- **What:** Group selection, template preview/send via WhatsApp/SMS/Email, message logs with
  retry, auto thank-you on RSVP acceptance.
- **Why Opus 5 (not optional):**
  - Three external integrations (Twilio WhatsApp, Twilio SMS, Resend email) in one feature
  - Placeholder substitution (`[Name]`, `[Code]`, `[Link]`, `[Date]`, `[Venue]`) must be
    correct for every template and every channel — guest-facing, hard to un-send
  - Retry/failure handling adds real state complexity
  - **HITL-gated regardless of model** — this sends real messages to real guests. See
    `HITL_NOTES_WEDDING.md`. Model choice does not change the approval requirement.

**⚠️ MANDATORY BEFORE START:**
Claude announces: "This is Slice 12 (Messaging Center). Recommended model: **Opus 5**. What model do you currently have selected?"
Also confirm: "This slice is HITL-gated and requires explicit owner approval before any real sends to guests. Confirm you've read HITL_NOTES_WEDDING.md."
Wait for both confirmations before proceeding.
- **Subtasks & their models:**
  - Template engine + placeholder substitution: Opus 5
  - Channel adapters (Twilio/Resend): Sonnet 5 (established SDK patterns)
  - Message log + retry UI: Sonnet 5
  - Tests, including a sandbox mode with no real sends: Opus 5
  - Docs: Haiku 4.5

#### **Slice 18: Guest session fix + Guest Management + Postgres persistence (P0-07)** → **OPUS 5 REQUIRED**
- **What:** Merge and implement Guest Management (code generation, CRUD, soft-delete, filters) + session fix for `/invitation/:code`. Wire Postgres persistence (migrations 005-007).
- **Why Opus 5 (not optional):**
  - Schema migration with interrelated tables (guests, admin_users, theme_settings expansion)
  - Partition enforcement via RLS policies (groom/bride guest isolation)
  - Soft-delete logic that preserves RSVP data but blocks login
  - Code generation collision avoidance across ~350 existing codes
  - Regression risk: touches Slices 1–3 guest-access flows
  - Top P0 blocker — defects here delay the entire project
  
**⚠️ MANDATORY BEFORE START:**
Claude announces: "This is Slice 18 (Guest Management + Session Fix + Postgres Persistence). This is the CRITICAL NEXT slice. Recommended model: **Opus 5**. What model do you currently have selected?"
Wait for confirmation before proceeding.

#### **Slice 19: RSVP Dashboard (P0-08)** → **SONNET 5 RECOMMENDED**
- **What:** Real-time stats (total invited, accepted families, accepted headcount, declined, pending), visual chart, CSV export. Depends on Slice 18 for real guest/RSVP data.
- **Why Sonnet 5:**
  - Read-only aggregation over validated data from Slice 18
  - Established reporting pattern, low complexity
  - No new business rules or multi-constraint validation
  
**⚠️ MANDATORY BEFORE START:**
Claude announces: "This is Slice 19 (RSVP Dashboard). This builds immediately after Slice 18. Recommended model: **Sonnet 5**. What model do you currently have selected?"
Wait for confirmation before proceeding.

#### **ThemePalette / FontChoice picker (supersedes part of Slice 8, requested 2026-08-23)** → **SONNET 5 recommended**
- **What:** Replace raw hex/font-name text inputs with curated, pre-verified swatch/font
  pickers. Five palettes already defined and contrast-verified per PRD §4.1 — this is UI wiring
  onto an already-decided data set, not new design decisions.
- **Why Sonnet 5:** The hard part (palette selection + WCAG verification) is already done and
  recorded in `MEMORY.md` (2026-08-23); remaining work is form/UI implementation against an
  existing pattern (`themeRepo`, `buildStyles`).
- **Claude MUST check:** "Have you verified Sonnet 5 is selected?"

---

## How Claude Should Behave

### ✅ BEFORE starting any slice or subtask:
1. **Identify the slice/subtask** — which one is it, from `TASKS.md`?
2. **Look up the model** — check this file for the assigned/recommended model
3. **Ask the user:**
   > "I'm about to work on [Slice X: Description]. This should use **[MODEL NAME]**. Have you
   > verified [MODEL NAME] is selected in your Claude settings?"
4. **Wait for confirmation** — do not proceed until user confirms
5. **Proceed** — once confirmed, start the work

### ✅ WHEN suggesting a subtask:
1. **Analyze the subtask** — what does it need?
2. **Determine the model** — should be the same as parent slice, but if different, flag it
3. **Tell the user explicitly:**
   > "This subtask (`name`) needs **[MODEL NAME]**. Is [MODEL NAME] currently selected?"

### ⚠️ IF the user overrides the recommended model (exception handling):
1. **Don't silently comply.** Name the gap out loud.
2. **Compensate in verification, not in scope.** If under-spec (lighter model than recommended),
   widen the test/verification pass — and for this project specifically, that means adding a
   rendering-level assertion, not just an API-level one, given the Slice 8/9 write-only history.
3. **Log the exception** in this file (as a `>` note on the slice) and in `TASKS.md`'s entry for
   that slice. The recommendation itself stays as the default for next time.
4. **Do not treat this as license to skip the check next time.**

### ❌ NEVER:
- Start work without asking about model selection
- Assume the model from the last task is still selected
- Proceed if the user doesn't confirm

---

## Summary Table (Quick Reference)

| Slice | Task | Model | Status |
|-------|------|-------|--------|
| 1 | Guest login by code | Sonnet 5 | ✅ Done |
| 2 | Guest login by name | Sonnet 5 | ✅ Done |
| 3 | Ambiguous-name recovery | Sonnet 5 | ✅ Done |
| 4 | Personalized invitation + RSVP accept/decline | Opus 5 (hindsight) | ✅ Done, had a P0 bug |
| 5 | RSVP change/update | Sonnet 5 | ✅ Done |
| 6 | Sticky RSVP bar | Haiku 4.5 | ✅ Done |
| 7 | Admin authentication | Sonnet 5 | ✅ Done |
| 8 | Admin Theme Editor | Opus 5 (hindsight) | ✅ Done, shipped write-only, fixed same day |
| 9 | Admin Section Manager | Sonnet 5 | ✅ Done, shipped write-only, fixed same day |
| — | ThemePalette / FontChoice picker | Sonnet 5 | 🟠 Not built |
| 10 | Guest Management (P0-07) | **Opus 5** | ❌ Top priority, not started |
| 11 | RSVP Dashboard (P0-08) | Sonnet 5 | ❌ Not started |
| 12 | Admin Messaging Center (P1-06/07/08) | **Opus 5** + HITL | ❌ Not started |

---

## Historical Context

- No model was formally tracked for Slices 1–9; this file's "completed" assignments are
  retroactive, inferred from actual shipped complexity, not a record of what was really used.
- Model selection is now a **mandatory checkpoint** before work starts on Slice 10 onward.
- Subtasks inherit the parent slice's model unless explicitly flagged otherwise.

---

## For Claude: Activation Checklist

Before you output any code or take any action on a slice:

```
[ ] Slice identified: _______________
[ ] Model assigned: _______________
[ ] User asked & confirmed: _______________
[ ] Proceed with work: _______________
```

**This is not optional.**
