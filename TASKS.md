# Project Tasks

This file tracks the implementation plan for the Amandi & Tharindu wedding website.

## Project Status
- Status: Guest management forms complete; ready for dashboard enhancements
- Current focus: Dashboard search/filter → then messaging center
- Priority: Complete guest CRUD, then move to messaging integration

## Working Principles
- Use strict TDD for each slice
- Each slice must be end-to-end and independently testable
- Prefer small, shippable increments over large speculative work

## PRD Alignment Summary
- Phase 1 complete; Phase 2 includes code login, name login, and ambiguous-name recovery.
- **Architecture migration complete:** Express → Next.js 14 (App Router) + TypeScript
- **Database layer complete:** Supabase integration with in-memory fallback (three-tier support)
- Core launch scope still requires: admin auth, guest/dashboard management, messaging/theme features, production hardening.
- Next milestone: Admin features (login → dashboard), then messaging center.
- Estimated completion: ~40% of implementation checklist, ~25% of full PRD launch scope.

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

### Architecture & Database
- [x] Migrated from Express prototype to Next.js 14 (App Router)
- [x] TypeScript configuration for Next.js
- [x] ESLint and formatting setup
- [x] Created public pages: Home, Our Story, Celebration, Gallery, Wishes
- [x] Supabase integration layer (lib/supabase.ts with proper initialization)
- [x] Three-tier database support: in-memory fallback | local Postgres | Supabase cloud
- [x] Migration runner and seed scripts (updated for Postgres)
- [x] Setup documentation (SUPABASE_SETUP.md)

### Admin Features
- [x] Admin authentication with Supabase Auth (email/password)
- [x] Admin session management with context provider
- [x] Route protection middleware for `/admin/*` routes
- [x] Admin login page (`/admin/login`)
- [x] Admin dashboard (`/admin/dashboard`) with:
  - Guest list with RSVP status tracking
  - Statistics (total, accepted, declined, pending)
  - Edit guest button (fully functional)
  - Add guest button (fully functional)
- [x] Guest add form (`/admin/guests/new`) with field validation
- [x] Guest edit form (`/admin/guests/[id]/edit`) with delete capability
- [x] API routes for guest CRUD (POST/PUT/DELETE /api/admin/guests/*)

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

## Next Actions (step-by-step)

✅ **COMPLETED:**
- Next.js 14 migration (Express → App Router + TypeScript)
- Supabase integration layer (querying guests, saving RSVP responses)
- Database scripts (migration runner, seed data)
- Guest authentication & RSVP flows wired to database
- Admin authentication (Supabase Auth + context provider + route middleware)
- Basic admin dashboard (guest list + statistics)

**Immediate Next (Priority Order):**

1. ✅ **Guest Management Forms** (COMPLETE)
   - [x] `/admin/guests/new` → Add guest form (name, code, email, whatsapp, relationship, slot_count)
   - [x] `/admin/guests/[id]/edit` → Edit guest details + delete button (soft delete with is_deleted flag)
   - [x] API routes: POST/PUT/DELETE /api/admin/guests
   - [x] Form validation and error handling
   - [x] Supabase + in-memory fallback support
   - [x] Admin auth protection on all routes

2. **Dashboard Enhancements** (next)
   - Search/filter guests by name, code, RSVP status
   - Participant names viewer (expand RSVP details)
   - Bulk actions (export to CSV, send reminders)

3. **Messaging Center** (after guest CRUD complete)
   - Message template editor (initial invite, reminder, confirmation)
   - Bulk send flow (select guests, choose template, preview, send with HITL)
   - Message log viewer (delivery status, timestamps)
   - Integrate Twilio (SMS/WhatsApp) and Resend (Email) SDKs

**Then (Secondary):**
4. Theme editor (colors, fonts, hero image)
5. Section manager (reusable content blocks on public pages)
6. Full test suite (unit + integration + E2E)
7. Production hardening (rate limiting, input validation, CSRF)
8. Deployment to Vercel with HITL checkpoints

**Development Guidelines:**
- Write tests first for each feature (unit tests minimum)
- Use HITL checkpoints for: admin creation/deletion, migrations, messaging sends, production deploys
- Keep this file updated after each completed milestone
- Commit frequently with clear messages

## Notes
- Mark tasks as done only after tests are written, run, and confirmed green.
- Use `HITL.md` for any actions that require explicit human approval (deploys, migrations, pushes to main, sending messages).
- Keep this file updated after each completed slice.
