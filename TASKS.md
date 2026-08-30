# Project Tasks

This file tracks the implementation plan for the Amandi & Tharindu wedding website.

## Project Status
- Status: Security Hardening Complete / Phase 4 Ready
- Current focus: Admin experience & production launch prep
- Priority: Implement admin authentication & features
- Completion: ~79% of checklist (Phase 1-3 + Security done, Phase 4-5 in progress)

## Working Principles
- Use strict TDD for each slice
- Each slice must be end-to-end and independently testable
- Prefer small, shippable increments over large speculative work

## PRD Alignment Summary
- Phase 1 complete; Phase 2 now includes code login, name login, and ambiguous-name recovery.
- Core launch scope still requires the personalized invitation page, RSVP flow, sticky RSVP bar, admin auth, guest/dashboard management, and messaging/theme features.
- Current prototype is a working Express demo; the PRD stack calls for Next.js + Supabase + Vercel.
- Estimated completion: ~79% of the current checklist (security complete), ~30-35% of full PRD launch scope.

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

### Phase 3.5 — Security Hardening (NEW - Complete)
- [x] Create comprehensive security documentation (SECURITY.md)
- [x] Implement rate limiting middleware (5 attempts/10min login, 10/hour RSVP)
- [x] Add security headers (clickjacking, XSS, MIME sniffing prevention)
- [x] Implement request logging with sensitive data sanitization
- [x] Create Supabase RLS policies for database-level access control
- [x] Document production deployment security checklist
- [x] Comprehensive test coverage for all security features

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
- Implemented RSVP submission flow, sticky reminder bar, and change-response logic on `/invitation/:code`
 - Pinning/adjusting linting and TypeScript devDependencies to compatible versions (ESLint v8 + TS v5)

## Current Blockers
- ✅ RESOLVED: Security hardening complete (rate limiting, headers, logging, RLS)
- Supabase integration: migration runner exists, requires `DATABASE_URL` for live database
- Admin authentication: not yet implemented (blocks Phase 4)
- Stack migration: Express demo still running; PRD requires Next.js 14 + Vercel migration

## Next Actions (step-by-step)

### Phase 3.5 Completed ✅
- [x] 1. Security hardening: rate limiting, security headers, request logging, RLS policies
- [x] 2. Production deployment checklist & security documentation

### Phase 4 (Admin Experience) - In Progress
- [ ] 3. Implement admin authentication: Supabase Auth role, protected `/admin/*` routes
- [ ] 4. Build admin dashboard: guest management, RSVP dashboard, theme editor
- [ ] 5. Implement messaging center: template management, sandbox mode, HITL-gated sends
- [ ] 6. Add theme customization: dynamic CSS variables, couple-controlled settings

### Phase 5 (Production Launch) - Next
- [ ] 7. Migrate to PRD stack: scaffold Next.js 14 (App Router) + Supabase client
- [ ] 8. Implement Supabase live database: replace in-memory store, enable RLS policies
- [ ] 9. Mobile responsiveness: polish responsive design, test all viewports
- [ ] 10. Content finalization: fill in real wedding details, couple copy review
- [ ] 11. Deployment setup: Vercel configuration, environment secrets, DNS
- [ ] 12. Final QA & launch readiness: comprehensive testing, security audit sign-off
7. Implement Admin surface & auth: Supabase Auth single-Admin setup, protected `/admin/*` routes, guest CRUD, RSVP dashboard, ThemeSettings editor, and SectionManager per P0.
8. Messaging sandbox + templates: build MessageTemplate management, MessageLog recording, a sandbox mode (no external sends), and a HITL-gated send flow for WhatsApp/SMS/Email.
9. Enforce HITL programmatically: add a reusable preflight helper (CLI and CI check) that prints the exact `HITL.md` prompt and requires explicit confirmation before deploys, migrations, sending messages, secrets changes, or pushes to production.
10. Security & production readiness: harden session cookies, add input validation, rate-limiting for login attempts, and privacy review for guest data before any public exposure.
11. Continue Slice 2 TDD: disambiguation UI/selection flow, RSVP form UI, and RSVP change/update flow. Prioritize tests-first for each piece.

## Notes
- Mark tasks as done only after tests are written, run, and confirmed green.
- Use `HITL.md` for any actions that require explicit human approval (deploys, migrations, pushes to main, sending messages).
- Keep this file updated after each completed slice.
