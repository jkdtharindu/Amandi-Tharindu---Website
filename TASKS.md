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
- [x] Theme editor — `/admin/theme`: one form per element group (Hero Image, Invitation Template + name-overlay config, Colors, Typography, Wedding Info, Venue), each with its own Save button; validated (hex colors, date format) and persisted via `themeRepo` (dual-mode: in-memory or Postgres). **Live as of 2026-08-23** — values render site-wide as CSS custom properties.
- [x] Section manager — `/admin/sections`: add/edit/toggle-visibility/delete custom content blocks per public page, persisted via `sectionsRepo` (dual-mode). **Live as of 2026-08-23** — visible sections render on their public page.

### Phase 5 — Polish & Launch
- [ ] Mobile responsiveness review
- [ ] Content fill-in and final copy
- [ ] Deployment to Vercel (HITL required)
- [ ] Final QA and launch readiness

---

## Review Findings Backlog (raised 2026-08-22, reviewed 2026-08-23)

A full project review raised the items below. Ordered by severity. Tier 1 is done;
everything else is outstanding. **Do not start new features before the 🔴 items.**

### ✅ Done — Tier 1: make shipped features actually work
- [x] **Theme Editor was write-only.** `getThemeSettings()` was called only by the admin
      page that renders the form; the public site used a hardcoded stylesheet. Saving a
      colour changed nothing. Fixed: `buildStyles(theme)` now emits ThemeSettings as CSS
      custom properties and every page consumes them.
- [x] **Section Manager was write-only.** Same defect — `listSections()` was admin-only.
      Fixed: public routes now render their visible SiteSections.
- [x] **Admin form showed raw property names** (`invitationNameTop`) to the couple.
      Fixed: `FIELD_LABELS` provides human labels plus hints.
- [x] **Button text contrast could fail WCAG AA** on an admin-chosen colour.
      Fixed: `readableTextColor()` picks dark/light ink by measured contrast ratio.
- [x] **No HTML escaping** on interpolated values. Fixed: `escapeHtml()` + regression test.
- [x] Countdown, couple names, and footer date now derive from ThemeSettings instead of
      being hardcoded.

### ✅ Done — invitation page (2026-08-23)
- [x] **🔴 P0 BUG: guests could not submit an RSVP from a browser.** The submit handler called
      `getCookieValue()` for the CSRF token, but that helper was only defined on the login and
      admin pages — never on the invitation page. Every click threw `ReferenceError`. The API
      test passed because it POSTed directly to `/api/guest/rsvp`, bypassing the page script.
      Fixed, with a regression test asserting the page both defines and uses the helper.
      *Lesson: API-level tests cannot prove a user flow works.*
- [x] **Invitation page joined the site shell.** It previously used its own `system-ui` styling
      and shared nothing with the site. Now uses `pageWrapper` + the live theme.
- [x] **P0-02 satisfied.** `invitationTemplateUrl` and the name-overlay settings
      (top / left / font size / colour) were also write-only; the invitation page now renders
      the template image with the guest's name absolutely positioned per ThemeSettings, plus a
      graceful fallback card when no template is uploaded.
- [x] 404 for an unknown code now renders in the site shell with a route back to `/login`,
      instead of a bare `<h1>`.
- [x] All interpolated guest data is HTML-escaped.

### 🔴 Blocking launch — do these next
- [ ] **`/invitation/:code` does not require a guest session.** Anyone holding or guessing a
      valid InvitationCode can view a guest's page. The previous code computed a `loggedIn`
      flag and never used it, so this check has never actually been enforced. PRD §11 requires
      guest routes be protected and cross-guest access prevented. **Changing this affects guest
      access, so HITL.md applies — get explicit approval before implementing.**
- [ ] **Guest Management (P0-07)** — no way to add a guest exists. The site cannot run a
      wedding without this. Higher priority than anything already built.
- [ ] **RSVP Dashboard (P0-08)** — no headcount visibility.
- [ ] **No persistence.** Guests, RSVPs, theme, and sections live in in-memory arrays.
      A server restart destroys every RSVP. `DATABASE_URL` is unset and migrations
      (001–003) have never been applied to any database.
- [ ] **Decide the Next.js + Supabase migration date.** PRD specifies Next.js 14 +
      Supabase + Vercel; the build is Express + template literals. Every feature added
      widens the rewrite. Decide *when*, or consciously amend the PRD to keep Express.

### 🟠 Correctness & scope risks
- [ ] **Two contradicting PRDs.** `amandi-tharindu-wedding-PRD.md` (governing, chosen
      2026-08-22) vs `New folder (2)/prd3.md`, which specifies a different palette,
      invitation-code format, auth model, and features (wax seal, ambient audio).
      Resolve: fold anything wanted into the main PRD, then remove or clearly mark prd3.
- [ ] **`New folder (2)/`** — accidental directory name now staged into git. Rename or remove.
- [ ] **Timeline.** PRD dated 2026-08-09 allowed 35 days (≈13 Sept). Remaining scope far
      exceeds the remaining time. Physical cards need codes printed well before 14 Dec 2026.
      Re-plan or cut scope.
- [ ] Dev fallback password `changeme123` in `src/data/adminStore.js` — safe locally
      (production requires `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH`), but remove before any deploy.
- [ ] Admin has no password reset; PRD P0-09 expects one via Supabase Auth.

### 🟡 UI / UX improvements
- [ ] **Gallery contains literal text placeholders** ("Photo 1"…"Photo 4"). No real image
      exists anywhere on the site. Needs a GalleryPhoto model + admin management.
- [ ] **Invitation page is visually orphaned** — uses its own `system-ui` styling and does
      not share the site shell. It is the most important page and the least designed.
- [ ] Mobile untested below desktop width. PRD targets 320px and Samsung Internet;
      Sri Lankan guests are overwhelmingly on Android phones — mobile is the primary platform.
- [ ] Sticky RSVP bar can overlap content on short screens.
- [ ] Full WCAG 2.1 AA pass (PRD commitment): alt text, keyboard navigation, focus order.
- [ ] Story milestones, celebration events, and wishes are still hardcoded HTML — none are
      admin-managed yet (P1-02, P1-03, P1-05, P1-09).

### 🔵 Requested features — after launch (P2, do not build now)
- [ ] **Seating plan — SeatingTable + SeatAssignment (P2-06).** Admin creates tables with a
      capacity and assigns each Participant a seat number, grouping by `RelationshipType`
      (Relations / Colleagues / Neighbours / Friends) so families and colleagues sit together.
      Needs: unassigned-Participant view, capacity validation, export, optional "your table"
      on the Invitation page. **Depends on final RSVP data**, so it must come after P2-07.
- [ ] **RSVP cutoff / headcount lock (P2-07).** ⚠️ *Ambiguous as stated — needs the owner's
      decision before build.* Either (a) an RSVPCutoff date after which guests cannot change
      their response, freezing the headcount for catering, or (b) locking the wedding date so
      the home-page countdown target can't be edited by accident. Confirm which, or both.

### 🟣 Chapter 2 — Productization (separate project, not now)
- [ ] Owner intends to sell this app to other couples **after** this wedding launches.
      Full scope recorded in PRD §14. **Build nothing for it during Chapter 1.**
- [ ] Cheap discipline to keep now, at no extra cost: keep repos (`guestRepo`, `themeRepo`,
      `sectionsRepo`) as the only DB access path, keep logic out of route handlers, and read
      couple names from `ThemeSettings` rather than hardcoding them (done 2026-08-23).
- [ ] Note: multi-tenancy is the most expensive thing to retrofit, and holding other couples'
      guest data carries data-protection obligations. Chapter 2 needs its own PRD.

### 🟢 Housekeeping
- [ ] `context.md` is stale and has never been accurate ("not a git repository"). Use or delete.
- [ ] Local `master` branch is 1 commit behind `main` with nothing unique — safe to delete.
- [ ] Admin work exists only locally; the remote branch was deleted. Re-push for backup.

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
