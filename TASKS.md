# Project Tasks

This file tracks the implementation plan for the Amandi & Tharindu wedding website.

## Project Status
- Status: Architecture migration in progress (Express → Next.js 14)
- Current focus: Next.js foundation complete; next is Supabase integration
- Priority: Connect to live database, then build admin features

## Working Principles
- Use strict TDD for each slice
- Each slice must be end-to-end and independently testable
- Prefer small, shippable increments over large speculative work

## PRD Alignment Summary
- Phase 1 complete; Phase 2 now includes code login, name login, and ambiguous-name recovery.
- Core launch scope still requires admin auth, guest/dashboard management, messaging/theme features, and production hardening.
- **Architecture migration complete:** Prototype migrated from Express to Next.js 14 (App Router) + TypeScript. All guest flows ported.
- Next milestone: Supabase database integration, then admin features.
- Estimated completion: ~35% of implementation, ~20% of full PRD launch scope.

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

### Architecture & Scaffolding
- [x] Migrated from Express prototype to Next.js 14 (App Router)
- [x] TypeScript configuration for Next.js
- [x] ESLint and formatting setup
- [x] Created public pages: Home, Our Story, Celebration, Gallery, Wishes
- [x] Configured in-memory fallback data stores for development

### Guest Features (Ported to Next.js)
- [x] Guest authentication by invitation code (`/api/guest/login`)
- [x] Guest authentication by name with ambiguous-name resolution
- [x] Personalized invitation page (`/invitation/[code]`)
- [x] RSVP submission and response tracking
- [x] Session management with signed cookies
- [x] Login form with code/name toggle (`/login`)

### Earlier Work (from Express prototype)
- Created initial guest-auth modules and tests
- Implemented RSVP flow and session handling
- Built Express demo server and smoke tests

## Current Blockers
- Supabase integration is partially wired: migration runner and local seed script exist, but a live database connection still requires `DATABASE_URL`.
- Session handling now uses signed cookies, but further production hardening is still advisable before any public exposure.

## Next Actions (step-by-step) — POST MIGRATION

✅ **COMPLETED:** Steps 1-2 (Auth hardening partly done; full Next.js migration done)

**Immediate Next (Priority):**
1. **Supabase Integration** — Connect to live Postgres via Supabase
   - Wire database URL and anon key to lib/db.ts
   - Update auth functions to query real `guests` table
   - Test login flows against live DB
   - Update RSVP submission to persist to `rsvp_responses` table

2. **Admin Authentication** — Supabase Auth for the couple
   - Set up Supabase Auth project
   - Create `/admin/login` page
   - Protect `/admin/*` routes with middleware
   - Create `AdminAuthContext` or session provider

3. **Admin Dashboard** — Basic guest and RSVP management
   - List all guests with RSVP status
   - Ability to add/edit/delete guests (with HITL for deletions)
   - RSVP response viewer (headcount, participant names)
   - Filter/search guests by name or code

**Then (Secondary):**
4. Messaging center (WhatsApp/SMS/Email via Twilio/Resend)
5. Theme editor (colors, fonts, hero image)
6. Section manager (reusable content blocks)
7. Full test suite (unit + integration + E2E)
8. Production hardening (rate limiting, input validation, CSRF)
9. Deployment to Vercel with HITL checkpoints

**Notes:**
- Continue marking tasks done only after tests are written and passing
- Use `HITL.md` for any actions that touch production, migrations, or messaging
- Keep this file updated after each completed milestone

## Notes
- Mark tasks as done only after tests are written, run, and confirmed green.
- Use `HITL.md` for any actions that require explicit human approval (deploys, migrations, pushes to main, sending messages).
- Keep this file updated after each completed slice.
