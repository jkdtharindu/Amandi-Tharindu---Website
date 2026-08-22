# Project Tasks

This file tracks the implementation plan for the Amandi & Tharindu wedding website.

## Project Status
- Status: Scoping / Initial implementation started
- Current focus: Guest access flow and public page polish
- Priority: Build the first vertical slice end-to-end

## Working Principles
- Use strict TDD for each slice
- Each slice must be end-to-end and independently testable
- Prefer small, shippable increments over large speculative work

## PRD Alignment Summary
- Phase 1 complete; Phase 2 now includes code login, name login, and ambiguous-name recovery.
- Core launch scope still requires the personalized invitation page, RSVP flow, sticky RSVP bar, admin auth, guest/dashboard management, and messaging/theme features.
- Current prototype is a working Express demo; the PRD stack calls for Next.js + Supabase + Vercel.
- Estimated completion: ~30% of the current checklist, ~15-20% of full PRD launch scope.

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
- [x] Admin authentication — single seeded admin, session-cookie login/logout, CSRF-protected, `/admin/*` pages redirect and `/api/admin/*` routes 401 when unauthenticated
- [ ] Guest management
- [ ] RSVP dashboard
- [ ] Messaging center
- [x] Theme editor — `/admin/theme`: one form per element group (Hero Image, Invitation Template + name-overlay config, Colors, Typography, Wedding Info, Venue), each with its own Save button; validated (hex colors, date format) and persisted via `themeRepo` (dual-mode: in-memory or Postgres)
- [x] Section manager — `/admin/sections`: add/edit/toggle-visibility/delete custom content blocks per public page, persisted via `sectionsRepo` (dual-mode)

### Phase 5 — Polish & Launch
- [ ] Mobile responsiveness review
- [ ] Content fill-in and final copy
- [ ] Deployment to Vercel (HITL required)
- [ ] Final QA and launch readiness

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
 - Implemented admin authentication (`src/admin-auth/`), Theme Editor (`src/theme/`, `/admin/theme`), and Section Manager (`src/sections/`, `/admin/sections`), each backed by dual-mode repos (in-memory locally, Postgres when `DATABASE_URL` is set) matching the existing `guestRepo` pattern
 - Added migration `migrations/003_create_admin_theme_sections.sql` for `admin_users`, `theme_settings`, `site_sections` (written only — not applied to any database)
 - Fixed a pre-existing bug where importing `src/server.js` (e.g. from `smoke.js` or any test file) started a real `app.listen()` as a side effect, hanging the process; it now only listens on direct `node src/server.js` execution
 - Fixed `tests/guest-login-api.test.mjs`, which was failing 403 on every request because it never fetched a CSRF cookie before posting; `npm test` now runs the full `tests/` suite (34/34 passing) instead of a single file

## Current Blockers
- Supabase integration is partially wired: migration runner and local seed script exist, but a live database connection still requires `DATABASE_URL`.
- Session handling now uses signed cookies, but further production hardening is still advisable before any public exposure.

## Next Actions (step-by-step)
1. Harden auth & sessions: add `SESSION_SECRET` guidance, sign/secure cookies (`HttpOnly`, `Secure`, `SameSite`), add CSRF protection, and include a `.env.example`.
2. Migrate prototype to the PRD stack: scaffold a Next.js 14 (App Router) + TypeScript app and port demo routes/API to Next route handlers.
3. Implement DB adapter & migration runner: replace the in-memory `guestStore` with a Supabase/pg adapter, map code → `guests` table, and add a safe migration/seed runner for `migrations/*.sql`.
4. Normalize schema and naming: ensure DB field naming (snake_case) matches PRD and add a mapping layer in code to avoid casing drift (`is_deleted` ⇄ `isDeleted`, `rsvp_status`, etc.).
5. Implement API route(s) for name-based login and ambiguous resolution (`POST /api/guest/login` to accept `code | name`) and return a consistent shaped response (`{ type: 'exact'|'candidates', ... }`).
6. Add integration and E2E tests that exercise full flows (login → session cookie → invitation → RSVP submit → RSVPResponse persistence) and admin flows.
7. Implement Admin surface & auth: Supabase Auth single-Admin setup, protected `/admin/*` routes, guest CRUD, RSVP dashboard, ThemeSettings editor, and SectionManager per P0.
8. Messaging sandbox + templates: build MessageTemplate management, MessageLog recording, a sandbox mode (no external sends), and a HITL-gated send flow for WhatsApp/SMS/Email.
9. Enforce HITL programmatically: add a reusable preflight helper (CLI and CI check) that prints the exact `HITL.md` prompt and requires explicit confirmation before deploys, migrations, sending messages, secrets changes, or pushes to production.
10. Security & production readiness: harden session cookies, add input validation, rate-limiting for login attempts, and privacy review for guest data before any public exposure.
11. Continue Slice 2 TDD: disambiguation UI/selection flow, RSVP form UI, and RSVP change/update flow. Prioritize tests-first for each piece.

## Notes
- Mark tasks as done only after tests are written, run, and confirmed green.
- Use `HITL.md` for any actions that require explicit human approval (deploys, migrations, pushes to main, sending messages).
- Keep this file updated after each completed slice.
