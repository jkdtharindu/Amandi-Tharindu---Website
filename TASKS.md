# Project Tasks

This file tracks the implementation plan for the Amandi & Tharindu wedding website.

## Project Status
- Status: Scoping / Initial implementation started
- Current focus: Guest access flow and first TDD slice
- Priority: Build the first vertical slice end-to-end

## Working Principles
- Use strict TDD for each slice
- Each slice must be end-to-end and independently testable
- Prefer small, shippable increments over large speculative work

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
- [ ] Slice 2: Guest can access their invitation with their name (TDD in progress)
  - Status: failing tests added and `loginGuestByName` helper implemented (exact + candidate search)
- [ ] Slice 3: Guest can recover when their name is ambiguous
- [ ] Slice 4: Guest can see a personalized invitation and respond
- [ ] Slice 5: Guest can change their RSVP later
- [ ] Slice 6: Guest sees a clear RSVP reminder until they respond

### Phase 3 — Public Pages
- [ ] Home page
- [ ] Our Story page
- [ ] Celebration page
- [ ] Gallery page
- [ ] Wishes page

### Phase 4 — Admin Experience
- [ ] Admin authentication
- [ ] Guest management
- [ ] RSVP dashboard
- [ ] Messaging center
- [ ] Theme editor
- [ ] Section manager

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
 - Added migration SQL: `migrations/001_create_guests.sql`, `migrations/002_create_rsvp_responses.sql`
 - Pinning/adjusting linting and TypeScript devDependencies to compatible versions (ESLint v8 + TS v5)

## Current Blockers
- PowerShell execution policy may block `npm`/scripts in this shell — run tests in CMD or bypass policy for the session.
- HITL guardrails exist in `HITL.md` but are documentation-only; there is no programmatic enforcement (migrations, deploys, or messaging still require manual discipline).
- Supabase integration is not wired up: migrations exist but there is no DB runner, seeding, or runtime persistence (in-memory `guestStore` used for demo).
- Session handling is demo-only (`guest_session` cookie, unsigned) and must be hardened before any public exposure.

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
