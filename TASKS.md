# Project Tasks

This file tracks the implementation plan for the Amandi & Tharindu wedding website.

✅ **BRANCH DIVERGENCE RESOLVED (2026-09-04):** Merged `feature/ui-wrapping` into `feature/nextjs-supabase-migration` (commit 4a9f07a). Brought Theme Editor (P1-10), Section Manager (P1-11), Table Arrangement (P1-14), Supabase Storage adapter, and migrations 004–008. Database already had these applied; re-running them is idempotent. See BRANCH_STRATEGY.md for SOP to prevent this in future.

✅ **PR #4 MERGED TO MAIN (2026-09-04):** `feature/nextjs-supabase-migration` merged into `main` (merge commit 3560128), after resolving a second parallel divergence — `main` had independently built its own competing Theme Editor (see MEMORY.md 2026-09-04 "Past mistakes" for the reconciliation). All work described below — Next.js migration, admin panel, guest RSVP/seating, theme system — is now on `main`. The feature branch has been deleted, both locally and on origin. All work going forward happens directly on `main` until the next feature branch is opened (see BRANCH_STRATEGY.md).

## Project Status
- Status: Next.js 16 migration complete; admin panel (auth, guest CRUD, RSVP dashboard) built and verified; WhatsApp reminder slim slice added; theme editor (P1-10), section manager (P1-11), table planning/seating (P1-14), and event manager (P1-09, MVP scope) all built, merged, and live in the Next.js app (`app/admin/`). P1-11/P1-14 were backend-only until 2026-09-04 — a docs-accuracy audit found both marked done despite no Next.js admin UI existing; the UI wiring and event manager both landed the same day.
- Current focus: Table Arrangement Dashboard & Probable Attendance (P1-16) shipped 2026-09-05 — see Next Action 13. P1 remaining: the pre-login site gate (P1-15, blocked on two product questions — see Next Action 12).
- Priority: Decide between P1-15 (needs user decisions first) and the production-readiness work in Next Actions 7–10

## Working Principles
- Use strict TDD for each slice
- Each slice must be end-to-end and independently testable
- Prefer small, shippable increments over large speculative work

## PRD Alignment Summary
- Phases 1-4 (foundation, guest access, public pages, admin core) are built on the PRD-specified Next.js 16 stack — the Express prototype (`src/server.js`) is now legacy-only, kept for `npm run smoke`/`start:legacy`.
- Admin auth deviates from the PRD's Supabase Auth call-out (env-credential instead — see MEMORY.md 2026-09-03).
- Guest invitation code format deviates from the PRD's `[SURNAME]-[NNN]` spec (see MEMORY.md 2026-09-03 and PRD P0-07).
- Messaging (P1-06/P1-07) has a slim interim slice (single-guest WhatsApp reminder, wa.me link) — the full group-send/template/log spec is still unbuilt.
- Table Planning & Guest Categorization (P1-14) is a newly proposed feature (added 2026-09-03, not in the original PRD scope) — full spec documented in the PRD §14. Built and live (2026-09-04).
- Event manager (P1-09) shipped 2026-09-04 at MVP scope — venue image upload and icon selection (full PRD spec) deferred.
- Pre-Login Site Gate & Invitation Reveal (P1-15) — owner-confirmed 2026-08-29, never carried into this file until rediscovered and logged 2026-09-05 (see Next Action 12, PRD §15). Not started; two open product questions need the user's call before coding.
- Table Arrangement Dashboard & Probable Attendance (P1-16) — newly proposed feature, scoped 2026-09-05 via a Grill Me session; full spec in PRD §16. Built and live 2026-09-05 — migration 010 applied to the live database (HITL-confirmed).
- Still missing from PRD scope: full messaging center, the pre-login gate above, production deploy.

## Model Assignment Convention
- Every open backlog item and Next Action below carries a `Model:` tag — the Claude model recommended for that task's complexity/risk, so it can be confirmed with the user (human-in-the-loop, per `HITL.md`) before work starts.
- Guide: **Opus 5** for architecture-defining, security-sensitive, or safety-critical work (schema/design decisions, anything touching HITL enforcement); **Sonnet 5** for well-scoped feature/CRUD/config work with low ambiguity; **Haiku 4.5** for small, mechanical, single-purpose fixes.
- Completed (`[x]`) items are left untagged.
- If a task is added to this file without a `Model:` tag, flag it and propose one before starting — do not assume a default.

## Implementation Backlog (updated)

### Phase 1 — Foundation
- [x] Set up project structure (skeleton files created)
- [x] Configure minimal `package.json` and test script
- [x] Create initial source module `src/guest-auth/loginGuestByCode.js`
- [x] Configure TypeScript, linting, and testing (basic setup completed)
- [x] Create Supabase schema for core tables (migration files added)
- [x] Add environment configuration placeholder files (`.gitignore`)

### Phase 2 — Guest Access Flow
- [x] Slice 1: Guest can access their invitation with a valid code
  - Status: helper implemented, unit tests present, demo server + smoke test validated locally
- [x] Slice 2: Guest can access their invitation with their name
  - Status: exact name login implemented, ambiguous candidate search returns matching guests, API tests passing
- [x] Slice 3: Guest can recover when their name is ambiguous
  - Status: ambiguous-name candidate selection flow implemented on `/login`, guest can select the correct record and continue to invitation
- [x] Slice 4: Guest can see a personalized invitation and respond
- [x] Slice 5: Guest can change their RSVP later
- [x] Slice 6: Guest sees a clear RSVP reminder until they respond

### Phase 3 — Public Pages
- [x] Home page
- [x] Our Story page
- [x] Celebration page
- [x] Gallery page
- [x] Wishes page
- [x] Shared page wrapper and refreshed wedding-style layout for public pages

### Phase 4 — Admin Experience
- [x] Admin authentication (P0-09) — env-credential login, scrypt hash, signed session cookie with expiry, all `/admin/*` routes protected, logout
- [x] Guest management (P0-07) — add/edit/soft-delete, auto code generation (`[CATEGORY]-[FIRSTNAME]-[random]`, configurable categories via `GUEST_CATEGORIES`), filter by status and group, search by name or code
- [x] RSVP dashboard (P0-08) — invited/accepted/declined/pending counts, individual headcount, breakdown chart, CSV export
- [✔] Event manager (P1-09, MVP scope, 2026-09-04) — `/admin/events` CRUD for celebration events: name, date, time, venue name, venue address (builds the Google Maps link), display order. Replaces the hardcoded Ceremony/Reception array on `the-celebration` and the invitation page's Event Details block. Schema: `celebration_events` (migration 009, applied live). Deferred per user decision: venue image upload and icon selection (full PRD spec) — would need the Supabase Storage adapter (`src/storage/supabaseStorage.js`) ported to the Next.js app, same gap as P1-11/P1-14 had.
- [✔] Messaging center (P1-06/P1-07, 2026-09-05) — `/admin/messages` works through a guest group on WhatsApp one message at a time: pick a template (the four seeded by migration 005), pick an audience (RSVP status + relationship group), then step through recipients — each opens a `wa.me` link with the message pre-filled and records a `message_logs` row, so a later run can skip whoever was already handled ("skip guests who already got this template" is on by default). wa.me is the confirmed permanent approach (no Twilio — MEMORY.md 2026-09-05), so there is no SMS/email channel and no delivery tracking: a log row means *the admin opened WhatsApp*, not that the guest received anything. **No new migration was needed** — `message_templates` and `message_logs` were already created by migration 005 and already applied live, so this slice had no HITL gate. The single-guest reminder button on the guest list (2026-09-03) is unchanged and still works. Deferred: editing template bodies from the admin UI (edits are per-send only, not persisted back to `message_templates`), retry/failed-status handling (nothing can fail — there is no programmatic send), and P1-08 auto thank-you (not achievable via wa.me — see the PRD note).
- [x] Theme editor (P1-10, reconciled 2026-09-04) — `/admin/theme` edits primary/secondary/accent colors and font family/style, applied site-wide instantly via CSS custom properties set on `<html>` in `app/layout.tsx`. Backend is the richer schema built on `feature/nextjs-supabase-migration` (`src/theme/themeRepo.js`, `theme_settings` from migrations 003–004, already applied to the live DB — also holds palette/font-choice/hero-image/invitation-overlay/couple-venue columns, not yet exposed in this simple form). Font choice is a curated set (Default, Cormorant Garamond, Playfair Display, Cinzel) self-hosted via `@font-face` (`src/theme/fontFaces.js` + `public/fonts/`), not free text or Google Fonts — an arbitrary name would silently fail to render, and self-hosting avoids a Google Fonts dependency. `main` had independently built a competing slim implementation in parallel (see MEMORY.md 2026-09-04 "Past mistakes"); its working `/admin/theme` page, `ThemeEditor` component, and API route were kept and rewired onto the richer schema, its competing migration/backend dropped, and both merged into `main` together via PR #4. Still deferred: hero/invitation image fields, invitation name-overlay rendering, `couple_names`/`wedding_date`/`venue_name`/`venue_address` (columns exist, not wired into any render path — see Next Action 1a), `patterns`/`custom_css` (no rendering consumer), and the palette/font-choice pickers (`src/theme/palettes.js`) themselves have no admin UI yet.
- [✔] Section manager (P1-11) — backend (`src/sections/sectionsRepo.js`, `validateSection.js`) merged from feature/ui-wrapping 2026-09-04; admin UI wired into the live Next.js app 2026-09-04 (`app/admin/sections`, `app/api/admin/sections`, `SectionManager.tsx`) after a docs audit found it backend-only. Visible sections now render on all five public pages via `components/public/CustomSections.tsx`.
- [✔] Table planning & seating management (P1-14) — backend (`src/table-arrangement/tableArrangementRepo.js`, `tableArrangementExport.js`) merged from feature/ui-wrapping 2026-09-04, schema `participants`/`seating_tables` (migrations 007–008); admin UI wired into the live Next.js app 2026-09-04 (`app/admin/table-arrangement`, `app/api/admin/table-arrangement`, `TableArrangement.tsx`) after the same docs audit found it backend-only.
- [✔] Table Arrangement Dashboard & Probable Attendance (P1-16, 2026-09-05) — RSVP-funnel stats (Accepted / Table Arranged / BalanceToArrange / RSVP Not Accepted) on `/admin/table-arrangement`, plus an Admin-editable "probable attendance" buffer per Declined/Pending bucket that materializes anonymous `ProbableAttendee` seat placeholders (no name, no link to a real Guest, `rsvp_status` never touched — see PRD §16). Schema: `probable_attendees` + `table_seats.probable_attendee_id` (migration 010, HITL-confirmed and applied to the live database 2026-09-05). Built in both the Next.js app (`app/api/admin/table-arrangement/*`) and the legacy Express server (`src/server.js`), since the existing test suite drives the latter. Verified: 311/311 tests (19 new), clean build/lint, and a full live browser click-through (buffer resize, seat/unseat a placeholder, shrink-below-seated rejection, export content) — first against a throwaway in-memory server, then again against the real database after the migration landed. Model used: Sonnet 5.

### Phase 5 — Polish & Launch
- [ ] Mobile responsiveness review — Model: Sonnet 5
- [ ] Content fill-in and final copy — Model: Sonnet 5
- [ ] Deployment to Vercel (HITL required) — Model: Sonnet 5
- [ ] Final QA and launch readiness — Model: Opus 5

## Current Slice Details

### Slice 1: Guest can access their invitation with a valid code
- User value: A guest can enter a valid invitation code and reach their personalized invitation page.
- Acceptance criteria:
  - Valid code logs the guest in and creates a session
  - Invalid code shows a friendly error and does not create a session
  - Soft-deleted guests cannot log in
  - Unit tests covering code-paths run green locally

## Completed So Far
- Created `package.json` with test script
- Created `.gitignore`
- Implemented `src/guest-auth/loginGuestByCode.js`
- Added unit test `tests/guest-login.test.mjs`
 - Implemented `src/guest-auth/loginGuestByCode.js`
 - Implemented `src/guest-auth/loginGuestByName.js` (name lookup helper)
 - Added unit tests: `tests/guest-login.test.mjs`, `tests/guest-login-name.test.mjs`
 - Unit tests passed locally for code-based login; name-based tests scaffold added and helper implemented
 - Added demo Express server (`src/server.js`) and smoke test (`src/smoke.js`) that exercise login + invitation page
- Implemented RSVP submission flow, sticky reminder bar, and change-response logic on `/invitation/:code`
 - Pinning/adjusting linting and TypeScript devDependencies to compatible versions (ESLint v8 + TS v5)

## Admin Slice — Follow-ups

- Admin login throttling is in-process only; move the counter to a shared store before running more than one instance.
- `guests` has no `updated_at` column, so the guest list shows RSVP status rather than the "last updated" timestamp the PRD wording suggests. Adding the column needs a migration (HITL).
- `ADMIN_PASSWORD_HASH` is verified with Node scrypt. A hash generated by a different KDF will not match — regenerate with `npm run admin:set-password`.
- Admin auth is env-credential based rather than Supabase Auth (the mechanism named in the PRD), because `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` were already provisioned in `.env`. "Forgot password" therefore has no email flow yet.
- `npm test` now runs every file in `tests/`. The legacy `guest-login-api` tests had been failing since CSRF was added to the demo server because their helper never sent a token; the helper now fetches one.
- (2026-09-04) `tests/guest-login-api.test.mjs`'s RSVP test was stale — it predated a guest-session requirement added to `/api/guest/rsvp` and got a 401 instead of 200; fixed by logging in first. All 5 tests in that file were also switched to a `withApp()` try/finally helper, since the failing assertion had been leaking its HTTP server and hanging the *entire* `npm test` run, not just that file. See MEMORY.md 2026-09-04.
- Public routes moved into an `app/(public)/` route group so `/admin` no longer inherits the wedding header and footer. URLs are unchanged.

## Code Format & Messaging Follow-ups (2026-09-03)

- The 4-5 guests created during earlier manual testing (Ruwan, Sunil, Kamala, Nimal, Thar) still carry the old `[SURNAME]-[NNN]` code. They still work (code isn't re-validated against the new format), but any admin edit does not retroactively regenerate the code — only new guests get the new format. Regenerating the old ones means deleting and re-adding them (their RSVP history would need to be preserved separately, or accepted as a fresh start).
- `GUEST_CATEGORIES` is read from `process.env` on every call (`src/admin/categories.js`) — no restart-free hot reload guarantee outside Next.js dev's own env-var handling; confirm behavior before relying on changing it without a redeploy in production.
- WhatsApp reminder button only renders for guests with `rsvpStatus === 'pending'` AND a `whatsappNumber` on file. No UI path yet for guests without a WhatsApp number (accepted/declined guests, or pending guests with no number).
- No message send is logged anywhere (no `MessageLog` — PRD P1-07 domain concept still unimplemented). If audit history of reminders sent becomes a requirement, this needs a data store, which is a schema decision (HITL-gated migration).
- `NEXT_PUBLIC_SITE_URL` is not set in `.env`; the admin guest page falls back to `http://localhost:3010` for the invitation link inside reminder messages. Must be set correctly before this feature is usable against a deployed site.

## Current Blockers
- Supabase integration is partially wired: migration runner and local seed script exist, but a live database connection still requires `DATABASE_URL`.
- Session handling now uses signed cookies, but further production hardening is still advisable before any public exposure.

## Next Actions (step-by-step)
1. ~~Theme editor (P1-10)~~ — done, reconciled 2026-09-04 (see Phase 4 note above).
1a. ~~Wire `theme_settings.couple_names`/`wedding_date` into public pages~~ — done 2026-09-04. `SiteHeader.tsx`, `PageFooter.tsx`, `Countdown.tsx`, `app/layout.tsx` metadata, all five public page `<title>`s, and the invitation page's sticky RSVP bar now render live `theme_settings` values instead of hardcoded "Amandi & Tharindu" / 14 Dec 2026. New `src/theme/formatWeddingDate.js` shared helper. Verified via `npm test` (256/256), `npm run build`, and a live browser walkthrough against the DB. Countdown's ceremony start time (15:00) stays hardcoded — no time-of-day column exists on `wedding_date`. The invitation page's Ceremony/Reception venue/time details were deliberately left alone — `venue_name`/`venue_address` wiring belongs to Event Manager (P1-09, Next Action 3), not this slice.
2. ~~Section manager (P1-11)~~ — done, merged from feature/ui-wrapping 2026-09-04 (see Phase 4 note above).
3. ~~Event manager (P1-09)~~ — done 2026-09-04, MVP scope (see Phase 4 note above). Venue image upload + icon selection deferred as a follow-up if the full PRD spec is wanted later.
4. ~~Full messaging center (P1-06/P1-07)~~ — done 2026-09-05, Model: Sonnet 5 (confirmed). Built on the wa.me approach per the same-day no-Twilio decision. New: `src/messaging/` (`messageTemplatesRepo.js`, `messageLogRepo.js`, `selectRecipients.js`), in-memory fallbacks in `src/data/`, `app/api/admin/messages` + `.../messages/log`, `app/admin/messages` + `MessagingCenter.tsx`, and a Messages link in `AdminNav`. `renderTemplate()` was extended to accept the PRD's `[Name]` placeholder spelling alongside the existing `{name}` one, plus `[Date]`/`[Venue]`. **The `MessageLog` migration this action called for turned out to be unnecessary** — migration 005 had already created `message_templates` (with all four templates seeded) and `message_logs`, both already applied to the live DB, so nothing was migrated and no HITL gate applied. Verified: 292/292 tests (26 new), clean build/lint, live read-only DB check of every repo path plus a rolled-back INSERT proving the log statement matches the real schema, and HTTP checks confirming the page redirects (307) and both APIs 401 when unauthenticated. The logged-in click-through was not tested — that needs the admin password, which was not requested. One bug the DB check caught that tests could not: the in-memory template seeds mirrored migration 005's original text and so still carried the pre-migration-008 couple-name order ("Amandi & Tharindu"); fixed, with a regression test.
5. ~~Table planning & seating management (P1-14)~~ — done, merged from feature/ui-wrapping 2026-09-04 (see Phase 4 note above).
6. Regenerate the old-format guest codes (Ruwan, Sunil, Kamala, Nimal, Thar) created during testing, or accept them as-is (they still function). (Model: Haiku 4.5)
7. Enforce HITL programmatically: add a reusable preflight helper (CLI and CI check) that prints the exact `HITL.md` prompt and requires explicit confirmation before deploys, migrations, sending messages, secrets changes, or pushes to production. (Model: Opus 5)
8. Security & production readiness: move admin login throttling to a shared store, add an `updated_at` column to `guests` (needs migration/HITL), set `NEXT_PUBLIC_SITE_URL` for production, privacy review for guest data before any public exposure. Reusable pieces found 2026-09-04 in archived branch `archive/claude/mobile-only-session-qj1ixz-2026-09-04` (never merged): rate-limiting middleware (`src/rate-limiter.js`, tested) and security-headers middleware (`src/security-headers.js`) look directly portable; a request-logging/sanitization middleware (`src/request-logger.js`) is also there. That branch's RLS-policy migration and its own admin-auth scaffolding are NOT reusable as-is — see MEMORY.md 2026-09-04 "Abandoned Branches" for why. (Model: Opus 5)
9. Mobile responsiveness review across public + admin surfaces (Model: Sonnet 5) — **audited 2026-09-05**, two fixes shipped, one item left.
   - Audited all 6 public pages and all 7 admin pages at 375×667 (iPhone SE) in a real browser, logged in as admin via a throwaway in-memory instance — the logged-in admin surfaces that earlier sessions kept having to skip for want of the admin password (see `STARTUP_PROMPT.md` Step 0.5 for the recipe).
   - **Public pages were already fine**: every one laid out at 375px with zero horizontal overflow and no console errors. Guests were never affected by either bug below.
   - [✔] Fixed invisible text on dark links. `app/globals.css` had an **unlayered** `a { color: inherit }`, and an unlayered element rule beats every Tailwind utility regardless of specificity, so `text-white` lost. The active admin nav item on all 7 pages, plus the **Export CSV** and **Download spreadsheet** buttons, rendered dark-on-dark — unreadable at *every* screen size, not just mobile. Moved the rule into `@layer base` so utilities win again. Verified: 9 invisible-text instances before, 0 after.
   - [✔] Fixed the admin panel zooming out on phones. `AdminNav`'s `<nav>` was `flex` with no wrapping, so its 7 links had an intrinsic width of ~496px, which set a floor for the whole panel and made a phone browser shrink every admin screen to fit. Added `flex-wrap`; the nav now wraps to two rows and 12 of 13 pages lay out at exactly 375px.
   - [ ] Tap targets below the 44px guideline remain across the admin panel — "Log out" (34px), the table-arrangement Save button (24px), and most form inputs (26–38px). Not fixed here to keep this change reviewable; it touches most admin components. (Model: Sonnet 5)
   - Note on measurement: `/admin/guests` still reports `window.innerWidth` 486 under mobile emulation while `body.scrollWidth` is 375. That is the emulated layout viewport reacting to the guest table's 557px `scrollWidth`; the table sits correctly inside an `overflow-x-auto` box, `body`/`main` are 375px, and the rendered screenshot fills the screen properly. Treated as an emulation artifact, not a layout defect — but worth a real-device check before launch.
10. Deployment prep: Vercel config, production env vars, HITL-gated deploy. (Model: Sonnet 5)
11. ~~Wire Section Manager (P1-11) and Table Planning (P1-14) admin UI into the live Next.js app~~ — done 2026-09-04, Model: Sonnet 5 (confirmed — same model as this session). `app/admin/sections` + `app/api/admin/sections`, `app/admin/table-arrangement` + `app/api/admin/table-arrangement`, both consuming the already-tested `src/sections/*`/`src/table-arrangement/*` repos with no backend changes. Verified via `npm test` (256/256), `npm run build`, `npm run lint`, and a live check of both pages/APIs' auth guards against the running dev server (redirect/401 as expected). The logged-in CRUD flows were not click-tested — that needs the admin password, which wasn't requested from the user. See Phase 4 notes above for detail.
12. Pre-Login Site Gate & Invitation Reveal (P1-15) — scoped 2026-09-05, not started. Owner-confirmed 2026-08-29 (`docs/WEDDING_UI_UX_SPEC.md` §4/§6, `docs/MEMORY.md` same date) but never carried into this file at the time, so it was never built — rediscovered when the user asked whether the site had a "locked until code entered" gate. Full spec, requirement breakdown, and open questions in PRD §15. Two things must be resolved with the user *before* coding starts, not assumed: (a) whether gating every public page behind a code is still wanted given it makes them unindexable/unshareable — the site may have been deliberately shipped ungated as a later call, not an oversight; (b) whether this replaces or coexists with today's working name-based login (Phase 2, Slices 2–3). Touches site-wide routing (a `middleware.ts`/`proxy.ts`-level gate across the whole `app/(public)/` route group) plus a real animation sequence (envelope open, ~2s) — an architecture decision, not just a UI slice. (Model: Opus 5 — proposed, not yet confirmed per the Model Assignment Convention; the routing/auth-interaction decision is the Opus-level part, the animation polish afterward could plausibly hand off to Sonnet 5 once the mechanism is settled)
13. ~~Table Arrangement Dashboard & Probable Attendance (P1-16)~~ — done 2026-09-05, Model: Sonnet 5 (confirmed). See Phase 4 note above for full detail. Open questions from the original scoping were resolved during implementation: placeholder labels are "Probable (Declined/Pending) #N"; ProbableAttendee resizing has no admin-role restriction yet (not GuestPartition-scoped, and the project has no live two-admin model to gate it against — see the `admin_users.role` prototype-deviation note in `WEDDING_DATABASE_SCHEMA.md`); headline stats confirmed strictly Accepted-Guest-only, per PRD §16.

## Notes
- Mark tasks as done only after tests are written, run, and confirmed green.
- Use `HITL.md` for any actions that require explicit human approval (deploys, migrations, pushes to main, sending messages).
- Keep this file updated after each completed slice.
- Tag every new backlog item / Next Action with a `Model:` recommendation (see Model Assignment Convention above) and confirm it with the user before starting work on it.
