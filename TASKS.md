# Project Tasks

This file tracks the implementation plan for the Amandi & Tharindu wedding website.

✅ **BRANCH DIVERGENCE RESOLVED (2026-09-04):** Merged `feature/ui-wrapping` into `feature/nextjs-supabase-migration` (commit 4a9f07a). Brought Theme Editor (P1-10), Section Manager (P1-11), Table Arrangement (P1-14), Supabase Storage adapter, and migrations 004–008. Database already had these applied; re-running them is idempotent. See BRANCH_STRATEGY.md for SOP to prevent this in future.

✅ **PR #4 MERGED TO MAIN (2026-09-04):** `feature/nextjs-supabase-migration` merged into `main` (merge commit 3560128), after resolving a second parallel divergence — `main` had independently built its own competing Theme Editor (see MEMORY.md 2026-09-04 "Past mistakes" for the reconciliation). All work described below — Next.js migration, admin panel, guest RSVP/seating, theme system — is now on `main`. The feature branch has been deleted, both locally and on origin. All work going forward happens directly on `main` until the next feature branch is opened (see BRANCH_STRATEGY.md).

## Project Status
- Status: Next.js 16 migration complete; admin panel (auth, guest CRUD, RSVP dashboard) built and verified; WhatsApp reminder slim slice added; theme editor (P1-10) built, merged, and live in the Next.js app. Section manager (P1-11) and table planning/seating (P1-14) have complete, tested **backends** merged to `main`, but their admin UI only exists on the legacy Express prototype (`src/server.js`) — **not wired into the live Next.js app** (`app/admin/`). Corrected 2026-09-04 after a docs-accuracy audit found both marked done despite this gap.
- Current focus: P1 features remaining — wire P1-11/P1-14 UI into the Next.js app, event manager (P1-09), full messaging center (P1-06/P1-07)
- Priority: Decide P1 scope order next

## Working Principles
- Use strict TDD for each slice
- Each slice must be end-to-end and independently testable
- Prefer small, shippable increments over large speculative work

## PRD Alignment Summary
- Phases 1-4 (foundation, guest access, public pages, admin core) are built on the PRD-specified Next.js 16 stack — the Express prototype (`src/server.js`) is now legacy-only, kept for `npm run smoke`/`start:legacy`.
- Admin auth deviates from the PRD's Supabase Auth call-out (env-credential instead — see MEMORY.md 2026-09-03).
- Guest invitation code format deviates from the PRD's `[SURNAME]-[NNN]` spec (see MEMORY.md 2026-09-03 and PRD P0-07).
- Messaging (P1-06/P1-07) has a slim interim slice (single-guest WhatsApp reminder, wa.me link) — the full group-send/template/log spec is still unbuilt.
- Table Planning & Guest Categorization (P1-14) is a newly proposed feature (added 2026-09-03, not in the original PRD scope) — full spec documented in the PRD §14. Not started.
- Still missing from PRD scope: event manager, full messaging center, production deploy.

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
- [~] Messaging center — slim slice only: single-guest WhatsApp reminder button (preview/edit, then `wa.me` deep link, admin sends manually). No bulk send, no Twilio, no persisted message log, no SMS/email. Full P1-06/P1-07 spec still open. — Model: Opus 5
- [x] Theme editor (P1-10, reconciled 2026-09-04) — `/admin/theme` edits primary/secondary/accent colors and font family/style, applied site-wide instantly via CSS custom properties set on `<html>` in `app/layout.tsx`. Backend is the richer schema built on `feature/nextjs-supabase-migration` (`src/theme/themeRepo.js`, `theme_settings` from migrations 003–004, already applied to the live DB — also holds palette/font-choice/hero-image/invitation-overlay/couple-venue columns, not yet exposed in this simple form). Font choice is a curated set (Default, Cormorant Garamond, Playfair Display, Cinzel) self-hosted via `@font-face` (`src/theme/fontFaces.js` + `public/fonts/`), not free text or Google Fonts — an arbitrary name would silently fail to render, and self-hosting avoids a Google Fonts dependency. `main` had independently built a competing slim implementation in parallel (see MEMORY.md 2026-09-04 "Past mistakes"); its working `/admin/theme` page, `ThemeEditor` component, and API route were kept and rewired onto the richer schema, its competing migration/backend dropped, and both merged into `main` together via PR #4. Still deferred: hero/invitation image fields, invitation name-overlay rendering, `couple_names`/`wedding_date`/`venue_name`/`venue_address` (columns exist, not wired into any render path — see Next Action 1a), `patterns`/`custom_css` (no rendering consumer), and the palette/font-choice pickers (`src/theme/palettes.js`) themselves have no admin UI yet.
- [~] Section manager (P1-11) — backend complete and tested (`src/sections/sectionsRepo.js`, `validateSection.js`; `tests/site-sections.test.mjs`), merged from feature/ui-wrapping 2026-09-04. **Not wired into the live Next.js app**: no `app/admin/sections` page and no `app/api/admin/sections` route exist. The only working UI is on the legacy Express prototype (`src/server.js`, reachable via `npm run start:legacy`) — production (`npm start` → `next start`) never runs that server, so today's admin cannot manage sections on the real site. Discovered 2026-09-04 in a docs-accuracy audit (previously mismarked `[✔]`). See Next Action 11.
- [~] Table planning & seating management (P1-14) — backend complete and tested (`src/table-arrangement/tableArrangementRepo.js`, `tableArrangementExport.js`; `tests/table-arrangement.test.mjs`), merged from feature/ui-wrapping 2026-09-04. Schema: `participants`, `seating_tables` tables (migrations 007–008), applied live. **Not wired into the live Next.js app**: the `/admin/tables` page (`tests/table-arrangement-page.test.mjs`) only exists on the legacy Express prototype (`src/server.js`, `npm run start:legacy`) — production (`npm start`) never runs it, so today's admin cannot assign seating on the real site. Discovered 2026-09-04 in a docs-accuracy audit (previously mismarked `[✔]`, "tested on feature/ui-wrapping" referred to this legacy-server page, not the Next.js app). See Next Action 11.

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
1a. Wire `theme_settings.couple_names`/`wedding_date` into `SiteHeader.tsx`, `PageFooter.tsx`, `Countdown.tsx`, `app/layout.tsx` metadata, and the per-page `<title>`s that currently hardcode "Amandi & Tharindu" / 14 Dec 2026 — no migration needed, this branch's `theme_settings` (migration 003) already has both columns; this is purely a render-wiring task. (Model: Sonnet 5)
2. ~~Section manager (P1-11)~~ — done, merged from feature/ui-wrapping 2026-09-04 (see Phase 4 note above).
3. Event manager (P1-09): admin CRUD for celebration events (name, date, venue, map link). (Model: Sonnet 5)
4. Full messaging center (P1-06/P1-07): decide whether to keep the wa.me-based approach and extend it (bulk send, more templates) or move to Twilio (needs HITL — costs money, needs business account + template pre-approval). Add a persisted `MessageLog` either way. (Model: Opus 5)
5. ~~Table planning & seating management (P1-14)~~ — done, merged from feature/ui-wrapping 2026-09-04 (see Phase 4 note above).
6. Regenerate the old-format guest codes (Ruwan, Sunil, Kamala, Nimal, Thar) created during testing, or accept them as-is (they still function). (Model: Haiku 4.5)
7. Enforce HITL programmatically: add a reusable preflight helper (CLI and CI check) that prints the exact `HITL.md` prompt and requires explicit confirmation before deploys, migrations, sending messages, secrets changes, or pushes to production. (Model: Opus 5)
8. Security & production readiness: move admin login throttling to a shared store, add an `updated_at` column to `guests` (needs migration/HITL), set `NEXT_PUBLIC_SITE_URL` for production, privacy review for guest data before any public exposure. Reusable pieces found 2026-09-04 in archived branch `archive/claude/mobile-only-session-qj1ixz-2026-09-04` (never merged): rate-limiting middleware (`src/rate-limiter.js`, tested) and security-headers middleware (`src/security-headers.js`) look directly portable; a request-logging/sanitization middleware (`src/request-logger.js`) is also there. That branch's RLS-policy migration and its own admin-auth scaffolding are NOT reusable as-is — see MEMORY.md 2026-09-04 "Abandoned Branches" for why. (Model: Opus 5)
9. Mobile responsiveness review across public + admin surfaces. (Model: Sonnet 5)
10. Deployment prep: Vercel config, production env vars, HITL-gated deploy. (Model: Sonnet 5)
11. Wire Section Manager (P1-11) and Table Planning (P1-14) admin UI into the live Next.js app — `app/admin/sections` + `app/api/admin/sections`, `app/admin/tables` + `app/api/admin/tables` (or similar), consuming the already-tested `src/sections/*` and `src/table-arrangement/*` repos. Backend/schema work is done; this is UI/route wiring only, mirroring the pattern already used for theme/guests/dashboard. Added 2026-09-04 after a docs audit found both features backend-only despite being marked done. (Model: Sonnet 5 — proposed, not yet confirmed per the Model Assignment Convention)

## Notes
- Mark tasks as done only after tests are written, run, and confirmed green.
- Use `HITL.md` for any actions that require explicit human approval (deploys, migrations, pushes to main, sending messages).
- Keep this file updated after each completed slice.
- Tag every new backlog item / Next Action with a `Model:` recommendation (see Model Assignment Convention above) and confirm it with the user before starting work on it.
