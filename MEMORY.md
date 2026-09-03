This file is append-only for decisions.
Do not rewrite history — add new entries with dates.

Project: Amandi & Tharindu Wedding Website
Start date: 2026-08-09

1) Architectural decisions (with date and reason)

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 


2) Technology choices and why alternatives were rejected

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 


3) Past mistakes and corrections (things the AI got wrong before)

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 


4) Deprecated patterns (old approaches we've moved away from)

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 


[2026-09-03] Decision: Admin authentication uses env-credential (ADMIN_EMAIL + scrypt ADMIN_PASSWORD_HASH) instead of Supabase Auth.
Reason: ADMIN_EMAIL and ADMIN_PASSWORD_HASH were already provisioned in .env before the admin slice was built; a single-admin account doesn't need a full auth provider.
Alternative considered: Supabase Auth (the mechanism AGENTS.md and the PRD name) — rejected for this slice because it adds provider setup for a single account; "forgot password" has no email flow as a result. Follow-up noted in TASKS.md to revisit before wider access is needed.

[2026-09-03] Decision: WhatsApp RSVP reminders use a wa.me deep link (admin edits a preview, then opens WhatsApp and presses Send there) instead of the Twilio WhatsApp Business API named in the PRD.
Reason: Twilio needs a business account, pre-approved message templates, and costs per message; the wa.me approach needs no credentials, costs nothing, and keeps the actual send under the admin's manual control inside WhatsApp itself rather than a programmatic call from this app.
Alternative considered: Twilio WhatsApp API (PRD P1-06/P1-07 spec) — rejected for this slice as disproportionate to "let the admin nudge one pending guest." Full spec (bulk send, message templates, persisted MessageLog, delivery tracking) remains unbuilt; see amandi-tharindu-wedding-PRD.md P1-06/P1-07 note added same date.

[2026-09-03] Decision: Guest invitation code format changed from `[SURNAME]-[3-digit-sequence]` (e.g. SILVA-001) to `[CATEGORY]-[FIRST_NAME]-[random-3-digits]` (e.g. NEI-RU-628).
Reason: explicit user request — the old format was sequential per surname and easy to enumerate (SILVA-001, SILVA-002, ...); the new format mixes in the relationship category and randomizes the suffix instead of incrementing it.
Alternative considered: fully random 8-character alphanumeric code — rejected in favor of a structured-but-unguessable format per the user's explicit spec (3 category letters + 2 first-name letters + 3 random digits).

[2026-09-03] Decision: Guest relationship/group categories are configurable via a GUEST_CATEGORIES environment variable (src/admin/categories.js) instead of a hardcoded constant.
Reason: user wants the ability to add custom categories without a code change.
Alternative considered: a database-backed categories table — rejected for now because it needs a migration (HITL-gated); the env var reuses the existing ADMIN_EMAIL-style config pattern and needs no schema change.

5) Last session summary (leave blank — Claude will fill this in)

[2026-09-03] Summary: Verified the P0 admin panel (auth, guest CRUD, RSVP dashboard) built in the prior session end-to-end in the browser, then shipped three follow-on changes: (1) invitation codes now use `[CATEGORY]-[FIRSTNAME]-[random]` instead of `[SURNAME]-[sequence]`, (2) guest categories are configurable via GUEST_CATEGORIES, (3) a WhatsApp RSVP-reminder button (preview, edit, then open in WhatsApp — no auto-send) on pending guests in the guest table. 79/79 tests passing, build clean. The admin-panel commit and the code-format/category/WhatsApp changes are not yet committed (working tree only) as of this entry.
