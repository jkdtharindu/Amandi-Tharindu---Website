# Project Tasks

This file tracks the implementation plan for the Amandi & Tharindu wedding website.

## Project Status
- Status: Scoping / Initial implementation started
- Current focus (updated 2026-08-30, latest): **Slice 19 (RSVP Dashboard) is done**, and Slice 18
  is 2/3 done — Guest Management, the guest session fix, and guest logout are all shipped and
  green. The one remaining piece of Slice 18, **Postgres persistence, is blocked**: there is no
  database yet (no `.env` present, only `.env.example`; `dotenv` is a declared dependency but
  still never imported; the migration runner still has no ledger), so every feature above still
  runs on in-memory stores and a restart wipes RSVPs. **Next: get a `DATABASE_URL`, then finish
  persistence.** Image upload work (Slices 13–17) resumes after that.
- ThemePalette and FontChoice pickers plus self-hosted webfonts (§4.1) **shipped 2026-08-29**
  (commits `1f1dae8`, `9433593`) — this was previously tracked below as outstanding; see the
  updated "ThemePalette & FontChoice" section.
- ⚠️ **Uncommitted work found in the working tree 2026-08-30, not part of the current build
  order:** a functionally complete Table Arrangement feature (`src/table-arrangement/`,
  `migrations/007_create_table_arrangements.sql`, wired into `/admin/table-arrangement`) and a
  Messaging schema draft (`migrations/005_create_messaging.sql`). **Both committed 2026-08-30**
  at the project owner's direction, after a review pass and test backfill — see the entry under
  Correctness & scope risks. Seating Plan remains P2 by the PRD; committing it does not promote
  it in the build order, and Messaging still requires HITL before any send capability.
- Full test suite: **178/178 green** (2026-08-30, was 152 before the Table Arrangement backfill).
- Stack decision (2026-08-29): staying on Express + Postgres; not migrating to Next.js. See PRD §6 and Recent Decisions below.
- Priority: Build the first vertical slice end-to-end

## Working Principles
- Use strict TDD for each slice
- Each slice must be end-to-end and independently testable
- Prefer small, shippable increments over large speculative work

## PRD Alignment Summary
- Phase 1 complete; Phase 2 now includes code login, name login, and ambiguous-name recovery.
- Personalized invitation page, RSVP flow, sticky RSVP bar, admin auth, guest management, RSVP
  dashboard, theme editor (incl. palette/font pickers), and section manager are all shipped.
  Core launch scope still outstanding: Postgres persistence (blocked), messaging, and every
  image-upload slice (Storage, upload endpoint, upload UI, Gallery admin, Story/Events admin).
- Current prototype is a working Express demo; the PRD stack calls for Next.js + Supabase + Vercel — superseded 2026-08-29, staying on Express + Postgres (see Stack decision above).
- Estimated completion (updated 2026-08-30): ~35% of the current checklist, ~20% of full PRD
  launch scope. Persistence remains the hard blocker in front of most of what's left.

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
- [x] Guest management — `/admin/guests`: add (auto-generates a unique InvitationCode), edit,
      soft-delete, plus search and filtering by RSVP status and relationship group.
      **Shipped 2026-08-29** (commit `0c4d06f`). Still in-memory until persistence lands.
- [x] RSVP dashboard — `/admin/rsvp`: headline figures, server-rendered SVG breakdown chart,
      self-refreshing every 15s, plus CSV export of the full guest list.
      **Shipped 2026-08-29** against the in-memory store; dual-mode repo means no change needed
      when Postgres lands.
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

### ✅ Done 2026-08-29 — ThemePalette & FontChoice (supersedes raw hex fields)
Owner requirement: the admin selects the wedding look from a **curated palette**, and the cascade
must reach background, fonts, and all UI. Font must be a **selection**, not free text.
Full spec in PRD §4.1. This aligns the governing PRD with `prd3.md`'s approach.

- [x] **ThemePalette picker** — visual swatches at `/admin/theme`, replacing the three hex text
      inputs. Selecting one writes all colour values at once. Six palettes approved and
      contrast-verified (Modern Royal Romance added 2026-08-29 as the default, see PRD §4.1 for
      exact values). Commit `1f1dae8`.
- [x] **FontChoice picker** — curated list rendered in its own face, replacing the free-text
      font-family input. Commit `1f1dae8`.
- [x] **Webfonts are self-hosted.** Commit `9433593`: `@font-face` rules and font files are
      actually served (`src/theme/fontFaces.js`), covered by a case in
      `tests/theme-rendering.test.mjs`. No third-party CDN dependency.
- [x] Migration: `004_add_theme_palette_font_choice.sql` adds `palette_name` and `font_choice`
      (TEXT). Existing per-colour columns kept so custom values survive.
- [x] Custom hex entry kept as a secondary "advanced" option.
- [x] Live preview before saving.
- [x] Contrast gate: `contrastRatio()` covers palettes added later. The original default
      `#B8860B` **failed** this bar for button text and was darkened to `#8A6508` in the
      approved Imperial Gold palette.
- Tests: `mergeThemeUpdate` palette/font cascade and rejection cases, plus the self-hosted
  webfont test — part of the 178/178 green suite (2026-08-30).

### 🔴 Blocking launch — build order confirmed 2026-08-29 (see Recent Decisions)
Priority order agreed with project owner: fix the blockers below **before** resuming Slices
13–17 (image uploads). Within the blockers, Slice 18 and Slice 19 are next, in that order.

- [x] **Stack decision made 2026-08-29: stay on Express, do NOT migrate to Next.js.**
      Persistence moves to Postgres directly (via `pg` or a Supabase connection string),
      skipping Supabase Auth and the Next.js-oriented Supabase client SDK. Supabase is used
      only as hosted Postgres + Storage. **Still open:** hosting choice — Vercel assumes
      Next.js/serverless; need a host that runs a long-lived Express process (Railway,
      Render, Fly.io, or similar). Decide before deploy planning (Phase 5). PRD amended
      2026-08-29 to record this (§6 Stack, plus a banner note at the top of the document);
      not every Next.js/Supabase Auth reference elsewhere in the PRD has been individually
      rewritten yet — treat those as superseded.
- [~] **Slice 18: Guest session fix + Guest Management, combined.** Guest Management ✅ and the
      session fix ✅ (HITL approval given 2026-08-29 before the change was made). Persistence
      ❌ — blocked, no database exists yet. See full slice detail below.
- [x] **Slice 19: RSVP Dashboard (P0-08)** — done 2026-08-29, built against the in-memory
      store at the owner's direction. See slice detail below.
- [ ] **No persistence — resolved by Slice 18/19 work.** Guests, RSVPs, theme, and sections
      currently live in in-memory arrays; a server restart destroys every RSVP. `DATABASE_URL`
      is unset and migrations (001–003) have never been applied to any database. Wiring
      Postgres persistence is part of Slice 18, not a separate task, since Guest Management
      is meaningless without it. Blocked 2026-08-30: no Postgres is installed on the dev
      machine (nothing on 5432, no service, no install directory, no Docker); owner is
      installing PostgreSQL 17 via winget.
- [x] **Migration runner had no ledger.** Fixed 2026-08-30. `scripts/run-migrations.js`
      re-executed every `.sql` file on every invocation. All seven happened to be idempotent,
      so it worked, but nothing enforced that — the first `ALTER TABLE` or plain `INSERT` would
      have corrupted data on the second run. It now maintains a `schema_migrations` table, skips
      what is applied, and applies each pending migration **and its ledger row in one
      transaction** via a new `withTransaction` helper in `src/db.js`, so the ledger cannot
      claim a migration that did not land.
- [ ] 🟠 **`dotenv` is a dependency but imported nowhere — a `.env` file does nothing.** Found
      2026-08-30. Wired into `scripts/run-migrations.js` and `scripts/seed-local-db.js`, so
      `npm run migrate` and `npm run seed:db` read `.env` correctly. **Deliberately not wired
      into `src/server.js`:** the repos evaluate `DATABASE_URL` at import time and the tests
      import `createApp` from that module, so loading dotenv there would point all 178 tests at
      the live database the moment a real `.env` exists. Needs either a separate entry module
      (`src/main.js` doing dotenv-then-listen, with `npm start` and `scripts/start-with-browser.js`
      updated) or a test-side override. **Owner decision required before the DB is wired up.**
- [ ] **Slices 13–17 (image uploads) resume after Slice 19.** Explicitly deferred — decided
      2026-08-29. Do not start these until Guest Management, the session fix, and the RSVP
      Dashboard are done.

### 🟠 Correctness & scope risks
- [ ] **Uncommitted, out-of-sequence work found in the working tree (2026-08-30).** Two features
      exist as uncommitted files with no entry in the build order above:
      - `src/table-arrangement/` (repo + Excel/TSV export) and
        `migrations/007_create_table_arrangements.sql`, fully wired into
        `/admin/table-arrangement` (nav link, CRUD routes, seat assignment UI). This is Seating
        Plan / P2-06, which is explicitly filed under "🔵 after launch, do not build now" below
        — built anyway, and with **zero tests**, breaking this project's stated TDD principle.
      - `migrations/005_create_messaging.sql` — schema and the 4 seeded templates for Slice 12
        (Messaging Center). No application code yet, so lower risk, but Slice 12 is documented
        "not started" and any send capability needs HITL approval first.
      **Resolved 2026-08-30:** owner directed committing both. Table Arrangement was reviewed,
      the blocking defects below were fixed, 26 tests were backfilled, and it was committed to
      `feature/ui-wrapping`. Messaging migration 005 committed as a schema draft only — no
      application code, no send capability, and Slice 12 still needs HITL before any send.
      Neither is promoted in the build order: Slices 13–17 and the persistence work still come
      first.

#### Table Arrangement — fixes required before this feature can ship (found 2026-08-30)
Code-reviewed while auditing the uncommitted work above. None of this is exposed yet (no live
DB, nothing committed), but it must be fixed — in priority order — before Table Arrangement
leaves "uncommitted prototype" status, regardless of whether it ships now or after launch.

- [x] 🔴 **CSRF protection missing on all five mutating routes.** **Fixed 2026-08-30** — all
      five routes now call `verifyCsrfToken(req)` and the frontend fetch calls send
      `x-csrf-token`, matching the pattern used everywhere else in `src/server.js`. Still
      **Regression test added 2026-08-30** — `tests/table-arrangement-page.test.mjs` builds the
      admin-session + CSRF-cookie harness this module lacked and asserts a seat assignment
      without `x-csrf-token` is refused `403 csrf_invalid`.
- [x] 🔴 **A guest can be double-booked at two tables.** **Fixed 2026-08-30, hardened
      2026-08-30** — the first fix was a SELECT-then-UPDATE check in `assignGuestToSeat`, which
      two concurrent requests could both pass. Uniqueness is now enforced by the database: a
      partial unique index `idx_table_seats_unique_guest ON table_seats(guest_id) WHERE guest_id
      IS NOT NULL` (migration 007). The repo catches `23505` and surfaces the same message.
      Covered by `tests/table-arrangement.test.mjs`.
- [x] 🔴 **The feature 500'd on every admin page with no database.** Found 2026-08-30.
      `tableArrangementRepo.js` built its own `pg.Pool` and queried unconditionally, unlike
      `guestRepo`/`sectionsRepo`/`themeRepo` which guard on `useDb` and fall back to an
      in-memory store. Since `adminPageWrapper` renders a "Table Arrangement" link into the nav
      of *every* admin page, and `DATABASE_URL` is unset everywhere today, that link was a
      guaranteed 500 (verified: an unguarded pool fails `ECONNREFUSED`). **Fixed 2026-08-30** —
      the repo now uses the shared `query` from `src/db.js`, guards on `useDb`, and has a full
      in-memory path backed by new `src/data/tableArrangementStore.js`.
- [x] 🟠 **`UNIQUE(table_number, theme_id)` doesn't actually prevent duplicate table numbers.**
      **Fixed 2026-08-30** — `theme_id` was never written by any code, so the composite
      constraint was a no-op under Postgres NULL semantics. Column dropped; `table_number` is
      now plainly `UNIQUE`. If per-theme seating plans are wanted later, reintroduce `theme_id`
      with a constraint that actually holds.
- [ ] 🟠 **Assign endpoint doesn't re-check RSVP status.** (Still open as of 2026-08-30.) The "unassigned guests" dropdown is
      pre-filtered to accepted, non-deleted guests at page load, but the assign API itself
      accepts any `guestId` — a stale page or direct API call can seat a declined, pending, or
      soft-deleted guest.
- [ ] 🟠 **Export is mislabeled.** (Still open as of 2026-08-30.) `GET /api/admin/table-arrangement/export`
      ([server.js:1943](../src/server.js#L1943)) sends plain TSV
      (`Content-Type: text/tab-separated-values`) but names the download
      `table-arrangements.xlsx`. `tableArrangementExport.js`'s own header comment admits real
      `.xlsx` generation (via `exceljs`) was never wired up.
- [ ] 🟡 Table capacity can't be edited after creation — `updateSeatingTable` only accepts
      `tableName`; there's no way to add/remove seats to resize an existing table.
- [ ] 🟡 The `:tableId` segment in the seat assign/unassign routes is never validated against the
      seat's actual table — cosmetic only, the seat is looked up by `seatId` alone.
- [ ] 🟡 **Assigning to an unknown `seatId` reports success.** `assignGuestToSeat` returns `null`
      when no seat matches and the route replies `200 {success: true, seat: null}`. Should be a
      404. Found 2026-08-30; pre-existing, not a regression.
- [x] 🟡 **Zero test coverage for the entire feature.** **Fixed 2026-08-30** — 26 tests added.
      `tests/table-arrangement.test.mjs` (19) covers the export module (including Excel formula
      injection and tab/quote containment) and the repo's in-memory behaviour;
      `tests/table-arrangement-page.test.mjs` (7) drives real HTTP over the routes: auth gating,
      CSRF, duplicate table numbers, export contents, and that the page renders with no
      database configured. Suite went 152 → 178 green.
- [ ] **Two contradicting PRDs.** `amandi-tharindu-wedding-PRD.md` (governing, chosen
      2026-08-22) vs `New folder (2)/prd3.md`, which specifies a different palette,
      invitation-code format, auth model, and features (wax seal, ambient audio).
      Resolve: fold anything wanted into the main PRD, then remove or clearly mark prd3.
- [ ] **`New folder (2)/`** — accidental directory name now staged into git. Rename or remove.
- [ ] **Timeline.** PRD dated 2026-08-09 allowed 35 days (≈13 Sept). Remaining scope far
      exceeds the remaining time. Physical cards need codes printed well before 14 Dec 2026.
      Re-plan or cut scope.
- [x] **Dev fallback admin password removed (2026-08-29).** `adminStore` is now empty unless
      `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` are set; admin login fails closed with
      `503 admin_not_configured`, and `/admin` tells the operator to run `npm run admin:hash`.
      It was safe in that production refused to boot without the env vars, but the password
      sat in a public repo and would have granted admin on any deployment where `NODE_ENV`
      was not exactly `production`. `tests/admin-no-fallback.test.mjs` scans `src/` for
      baked-in passwords so it cannot return, and exercises the real env-var path in a child
      process — which no test previously covered, since the others seed the store directly.
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
      ⚠️ See "Uncommitted, out-of-sequence work" under Correctness & scope risks above — an
      untested implementation of this already exists uncommitted in the working tree.
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
- Status: ✅ Done — `src/guest-auth/loginGuestByCode.js`, `tests/guest-login.test.mjs`

### Slice 2: Guest can access their invitation with their name (P0-01)
- User value: A guest without their card handy can still get in by typing their registered name.
- Acceptance criteria:
  - Exact single-name match logs the guest in and creates a session, same as a code match
  - Name lookup only runs after a code lookup fails (code takes priority, per P0-01)
  - Soft-deleted guests are excluded from name matches
  - API-level integration tests pass with a valid CSRF token
- Status: ✅ Done — `src/guest-auth/loginGuestByName.js`, `tests/guest-login-name.test.mjs`, `tests/guest-login-api.test.mjs`

### Slice 3: Guest can recover when their name is ambiguous (P0-01)
- User value: A guest sharing a name with other invitees (e.g. multiple "Silva" family units) sees a disambiguation list instead of a dead end or a wrong login.
- Acceptance criteria:
  - Multiple name matches return a `candidates` list rather than logging in automatically
  - `/login` renders the candidate list and lets the guest pick the correct record
  - Selecting a candidate creates a session for that specific guest record only
  - No candidate selection = no session created
- Status: ✅ Done — candidate search + `/login` selection flow, covered by API tests

### Slice 4: Guest can see a personalized invitation and respond (P0-02, P0-03, P0-04)
- User value: A logged-in guest sees their name on the invitation and can accept or decline in one flow.
- Acceptance criteria:
  - `/invitation/:code` renders `InvitationTemplate` with the guest's name absolutely positioned per `ThemeSettings` (top, left, font size, colour)
  - Fallback card renders when no invitation template is configured
  - Accept path: participant count capped at the guest's assigned slot count, participant names captured, optional WhatsApp number captured on first visit only
  - Decline path: warm acknowledgement message shown, RSVP marked declined
  - All interpolated guest data is HTML-escaped
  - 404 for an unknown code renders inside the site shell with a route back to `/login`
- Status: ✅ Done, with one regression fixed post-ship — see the 🔴 P0 bug entry below (RSVP submit threw `ReferenceError` in the browser; API tests missed it because they bypass page JS)
- ✅ Resolved 2026-08-29 (was: `/invitation/:code` did not require a guest session, so anyone
  holding a valid code could view the page). Fixed in Slice 18 with HITL approval — see
  "Done — guest session enforcement" below.

### Slice 5: Guest can change their RSVP later (P0-05)
- User value: A guest whose plans change can update their response any time before the wedding, without contacting the couple.
- Acceptance criteria:
  - "Change response" link/action available from the Invitation page after an initial response
  - Accept → decline or decline → accept both supported, as well as editing participant names on an existing accept
  - Previous response is overwritten, not duplicated
  - New confirmation reflects the updated status
- Status: ✅ Done

### Slice 6: Guest sees a clear RSVP reminder until they respond (P0-06)
- User value: A guest who logs in but doesn't immediately RSVP is gently but persistently reminded, without being nagged after they've responded.
- Acceptance criteria:
  - Sticky bar appears at the bottom of every page after login until the guest has an RSVP on record
  - Bar shows the couple's names and Accept/Decline actions
  - Bar disappears permanently once the guest has responded (does not reappear on next visit)
  - "Change response" link remains available on the Invitation page after response
- Status: ✅ Done
- 🟡 Known issue (open, UI/UX backlog): can overlap content on short screens — not yet fixed

### Slice 7: Admin authentication (P0-09)
- User value: The couple can log in to a private admin area without anyone else being able to reach it.
- Acceptance criteria:
  - Single seeded admin account (env-configured email + scrypt password hash)
  - Session-cookie login/logout, CSRF-protected
  - All `/admin/*` pages redirect to login when unauthenticated; all `/api/admin/*` routes return 401
  - Dev-only fallback credentials exist locally but must never reach a deployed environment
- Status: ✅ Done in the prototype. Deviates from PRD P0-09 in two ways, both logged as prototype-scoped: (1) single seeded account instead of Supabase Auth, (2) no password reset flow yet (deferred to the eventual Supabase Auth migration)
- ✅ Resolved 2026-08-29: the dev fallback password was removed. There is no default admin account; `npm run admin:hash` creates one. See the Review Findings Backlog entry.

### Slice 8: Admin Theme Editor (P1-10)
- User value: The couple can restyle the entire site — colours, fonts, hero image, invitation name-overlay position, wedding info, venue — without a developer.
- Acceptance criteria:
  - One form per element group (Hero Image, Invitation Template + name-overlay config, Colors, Typography, Wedding Info, Venue), each with its own Save button
  - Saved values are validated (hex colour format, date format)
  - Saved values persist via `themeRepo` (dual-mode: in-memory locally, Postgres when `DATABASE_URL` is set)
  - Saved values render site-wide as CSS custom properties — the public site is not hardcoded
  - Admin-chosen colours cannot produce button text that fails WCAG AA contrast (`readableTextColor()`)
  - Form shows human-readable field labels, not raw property names
- Status: ✅ Done and confirmed live (2026-08-23) after a write-only regression was found and fixed (see Review Findings Backlog below)
- ✅ Superseding requirement (requested 2026-08-23) **shipped 2026-08-29**: raw hex/font-name text inputs replaced with a curated **ThemePalette** picker and **FontChoice** picker — see PRD §4.1 and the "ThemePalette & FontChoice" section above. Six palettes approved and contrast-verified.
- Prototype-scoped deviation: hero/invitation images are entered as a URL rather than uploaded as a file (Supabase Storage not yet wired)

### Slice 9: Admin Section Manager (P1-11)
- User value: The couple can add new content blocks to any public page after launch — expanding the site without a developer.
- Acceptance criteria:
  - Add/edit/toggle-visibility/delete for custom content blocks, scoped per public page
  - Supports the five public pages (`home`, `our-story`, `celebration`, `gallery`, `wishes`) and four section types (`text`, `image`, `gallery`, `custom`)
  - Persists via `sectionsRepo` (dual-mode: in-memory locally, Postgres when `DATABASE_URL` is set)
  - Visible sections render on their public page — not admin-only
- Status: ✅ Done and confirmed live (2026-08-23) after a write-only regression was found and fixed (see Review Findings Backlog below)

### Slice 10: Guest management (P0-07) — superseded by Slice 18
- Original scope kept here for reference; see Slice 18 below for the current, combined plan
  (now bundled with the guest-session-fix and Postgres persistence).
- Status: ❌ Superseded — do not build from this entry, use Slice 18.

### Slice 11: RSVP dashboard (P0-08) — superseded by Slice 19
- Original scope kept here for reference; see Slice 19 below for the current plan (kept as a
  separate slice per project owner decision 2026-08-29, built after Slice 18).
- Status: ❌ Superseded — do not build from this entry, use Slice 19.

### Slice 12: Admin Messaging Center (P1-06, P1-07, P1-08) — not started

⚠️ **BEFORE STARTING THIS SLICE:**
- [ ] Confirm you have **Claude Opus 5** selected (see WEDDING_MODEL_SELECTION.md §Slice 12).
      Three external integrations (Twilio WhatsApp/SMS + Resend Email) + HITL gates + template placeholders = Opus reasoning.
- [ ] Check: `What is your current model? Opus 5 / Sonnet 5 / Haiku 4.5?`
- [ ] Proceed only after confirmation.

- User value: The couple can message non-responders in bulk and have thank-you messages sent automatically, without manual WhatsApp/SMS/email work.
- Acceptance criteria (from PRD):
  - Select guest group, pick a message template, preview with placeholders filled, send via WhatsApp/SMS/Email
  - 4 pre-built templates (Initial Invite, First Reminder, Final Reminder, Thank You After RSVP) with editable body and `[Name]`/`[Code]`/`[Link]`/`[Date]`/`[Venue]` placeholders
  - Message logs stored; failed messages show a retry button
  - On RSVP acceptance, auto-send the Thank You template via WhatsApp (if number provided) or email
- Status: ❌ Not started. **HITL required before implementing send capability** — this is external, guest-facing messaging (see `HITL_NOTES_WEDDING.md`).

### Slice 18: Guest session fix + Guest Management + Postgres persistence (P0-07) — not started, BUILD NEXT

⚠️ **BEFORE STARTING THIS SLICE:**
- [ ] Confirm you have **Claude Opus 5** selected (see WEDDING_MODEL_SELECTION.md §Slice 10–12).
      Schema migration, login regression testing, and partition enforcement require Opus reasoning.
      Do NOT start with Haiku or Sonnet 5.
- [ ] Check: `What is your current model? Opus 5 / Sonnet 5 / Haiku 4.5?`
- [ ] Proceed only after confirmation.

- User value: The couple can actually add guests and generate real invitation codes (the site
  cannot run a wedding without this), and a guest can no longer view another family's
  invitation just by guessing or sharing a code.
- Acceptance criteria:
  - **Persistence:** `guests` table wired to real Postgres (via `DATABASE_URL`, applying
    existing migrations 001–003 plus any new ones needed), replacing the in-memory `guestStore`.
    `themeRepo`/`sectionsRepo` should move to the same real DB at this point too, since they
    already support Postgres mode — this closes the "no persistence" blocker in one pass.
  - **Guest CRUD:** Add guest (name, relationship, slot count → auto-generates a unique code),
    edit guest, soft-delete guest (RSVP data preserved, guest can no longer log in).
  - **Guest list view:** all guests with RSVP status; filterable by status
    (pending/accepted/declined) and relationship group (Relations/Colleagues/Neighbours/Friends).
  - **Session fix:** `/invitation/:code` requires an active guest session tied to that specific
    guest record — a valid code alone is no longer sufficient to view the page. Reuses the
    existing `loggedIn` flag plumbing, which currently computes but never enforces this.
  - **HITL:** the session-fix portion changes guest access behavior — get explicit approval
    before that specific change ships, per `HITL.md`, even though built in the same slice as
    Guest Management.
- Status: 🟡 **Partially done** — 2 of 3 parts shipped.
  - [x] **Guest CRUD + list view + filtering** — shipped 2026-08-29 (commit `0c4d06f`).
        Routes: `GET/POST /api/admin/guests`, `PATCH /api/admin/guests/:id`,
        `DELETE /api/admin/guests/:id` (soft delete), page `/admin/guests`.
        Covered by `tests/guest-management.test.mjs`.
  - [x] **Guest session fix** — shipped 2026-08-29. HITL approval given by the project owner
        before the change was made. See the dedicated entry below.
  - [ ] **Postgres persistence** — still outstanding, and now the only thing left in this
        slice. Blocked on the project owner providing a database (none exists yet as of
        2026-08-29). Two prerequisites found while scoping, both unfixed:
        (a) `dotenv` is a declared dependency but **never imported anywhere**, so a `.env`
            holding `DATABASE_URL` is not actually read by the app;
        (b) `scripts/run-migrations.js` has **no migration ledger** — it re-runs all five
            files on every invocation. 001–003 are `IF NOT EXISTS`, but 004 performs an
            `UPDATE`, so repeat runs are not safe to assume idempotent.
  Slice 19 (RSVP Dashboard) was built against the in-memory store rather than waiting, at the
  owner's direction; its figures become durable the moment persistence lands, with no code
  change. Slices 13–17 (image uploads) remain deferred until then.

### ✅ Done — guest session enforcement (2026-08-29, HITL-approved)
The 🔴 P0 access hole recorded under Slice 4 is closed. Previously the `guest_session` cookie
was written at login and **never read by any route**, so a valid InvitationCode alone was
enough to open an invitation — and, worse, to overwrite that family's RSVP.

- [x] `GET /invitation/:code` now requires a guest session. The session is checked **before**
      the code is looked up, so an unauthenticated visitor gets the same `302 → /login` for
      every code and cannot use the route to probe which codes exist.
- [x] A logged-in guest opening someone else's code gets a `403` page in the site shell
      ("That invitation belongs to someone else") with a route to their own invitation and a
      re-login link. The other guest's name is never rendered.
- [x] `POST /api/guest/rsvp` — the same hole, and the damaging one, since it writes. The
      **session**, not the posted code, now decides whose RSVP it is: `401 not_authenticated`
      with no session, `403 not_your_invitation` on mismatch.
- [x] Soft-deleting a guest revokes any session they still hold, with no extra bookkeeping —
      the session lookup goes through `findGuestById`, which excludes deleted guests.
- [x] Hardened `verifySession()`: `Buffer.from(sig, 'hex')` silently truncates at the first
      non-hex character, and `crypto.timingSafeEqual` **throws** on a length mismatch rather
      than returning false. A junk cookie would have become a 500 on every session-checked
      route once enforcement was switched on. Lengths are now compared first.
- Tests: `tests/guest-session.test.mjs` (10 cases, incl. forged/tampered cookies and the
      cross-guest read and write attempts). `tests/invitation-page.test.mjs` and
      `tests/guest-login-api.test.mjs` updated to sign in first. Full suite **89/89 green**.
- Also fixed in passing: `tests/guest-login-api.test.mjs` had no `try/finally` around its
      server, so a failed assertion leaked the listener and made `node --test` hang instead
      of reporting the failure.
- Verified in a real browser, not just by API test — per the lesson recorded under Slice 4:
      unauthenticated deep link redirects to `/login`; own invitation renders; cross-guest
      code shows the 403 page; cross-guest RSVP POST returns 403; the guest's own RSVP still
      submits through the actual button and the sticky bar clears.
- [x] **Guest logout added** (follow-up, same day). `POST /api/guest/logout` was documented as
      implemented but no route existed — harmless while the session was decorative, a real gap
      once the session became load-bearing. Now implemented, CSRF-protected, and deliberately
      idempotent (signing out twice, or with an expired cookie, returns 200 rather than a
      confusing error). Clears only `guest_session`; an admin session in the same browser is
      untouched. Surfaced on the invitation page as "Signed in as *name* — Not you? Sign out",
      which matters on a shared family phone. Covered by `tests/guest-logout.test.mjs` (5 cases).

### ✅ Done — configurable InvitationCode format (2026-08-29)

Raised by the project owner after seeing generated codes read wrongly. A code is printed on a
physical card and is the guest's login credential, so **the format is free to change only until
cards go to print** — after that it is fixed for good. Made configurable now, while it costs
nothing.

The original rule took the **last** word of the name as the surname. That is wrong for many Sri
Lankan names, which place the ancestral/*ge* name first: "Wickramasinghe Arachchige Nimal"
generated `NIMAL-001` from the given name rather than `WICKRAMASINGHE-001`.

- [x] **Surname position setting** — `first` (**the default**, set by owner decision
      2026-08-29) or `last` (the original behaviour). `first` suits names that place the
      ancestral/*ge* name first, as many Sri Lankan names do.
- [x] **Optional group prefix** — adds `R-` / `C-` / `N-` / `F-` for Relations / Colleagues /
      Neighbours / Friends. **Off by default, deliberately:** the code is the one thing a guest
      reads on their own card, and a visible group letter tells them which tier they were filed
      under. The grouping is already available where it is actually needed — `/admin/guests`
      filters by relationship and the CSV export carries a Relationship column.
- [x] **Per-guest manual override** — an admin can set any code by hand (letters, digits,
      hyphens, ≤40 chars), on create or by editing an existing guest. This is the escape hatch
      for any name the automatic rule reads wrongly, which the variety of Sri Lankan naming
      conventions makes inevitable.
- [x] **Settings UI on `/admin/guests`**, where codes are actually created — picker, toggle, and
      a live worked preview of the next code rather than a prose description of the rule.
      Saved via the existing theme/site-settings endpoint; no new endpoint needed.
- [x] Migration `006_add_invitation_code_format.sql` adds the two columns with a CHECK
      constraint on the surname position. **Written only — not applied**, per `HITL.md`.

**The guarantee, pinned by tests:** changing the format *never* rewrites a code that already
exists, and a code is only ever replaced by a deliberate edit — never as a side effect of
renaming a guest. If a format change rewrote a printed code, that guest could never sign in.
Generated codes are also checked against every code on record, including soft-deleted guests
(their card may already be printed), so a code can never be re-issued.

- Numbering runs per prefix, so each surname — and each group, when the prefix is on — keeps its
  own sequence, and `SILVA-` does not match `R-SILVA-001` and inflate the plain sequence.
- Tests: `tests/invitation-code-format.test.mjs` (19 unit cases) and
  `tests/invitation-code-admin.test.mjs` (13 end-to-end cases). Full suite **145/145 green**.
- Verified in a browser: the live preview tracks both settings, the saved setting persists across
  a reload, a new guest named "Wickramasinghe Arachchige Nimal" received `WICKRAMASINGHE-001`,
  a manual override produced `AMMA-01`, and the seeded `SILVA-001` / `SILVA-002` were untouched
  throughout.
- Caught by lint during the work: the emitted client-side preview script contained `\s` inside a
  server template literal, which collapses to a plain `s` — the preview would have split names on
  the letter "s". Replaced with a whitespace-free split.

**Default changed 2026-08-29 (owner decision):** surname position is now `first`, so a guest
entered as "Wickramasinghe Arachchige Nimal" receives `WICKRAMASINGHE-001` out of the box
rather than `NIMAL-001`. The group prefix stays off. `last` remains available for names
written the other way round, and the per-guest manual override covers anything neither rule
fits. Existing codes were not touched — the seeded `SILVA-001`/`SILVA-002` still read the same.

⏳ **Still open for the owner:** sanity-check the default against a sample of real guest names
before any cards are printed. After printing, codes are fixed for good.

### Slice 19: RSVP Dashboard (P0-08) — ✅ DONE 2026-08-29

⚠️ **BEFORE STARTING THIS SLICE:**
- [ ] Confirm you have **Claude Sonnet 5** selected (see WEDDING_MODEL_SELECTION.md §Slice 11).
      Read-only aggregation queries are straightforward for Sonnet; Opus overkill. Haiku acceptable but Sonnet preferred.
- [ ] Check: `What is your current model? Opus 5 / Sonnet 5 / Haiku 4.5?`
- [ ] Proceed only after confirmation.

- User value: The couple has real-time visibility into headcount for catering and venue
  planning, without manually counting responses.
- Acceptance criteria (from PRD):
  - Real-time stats: total invited, accepted (with headcount), declined, pending
  - Visual chart
  - Exportable as CSV
- Status: ✅ **Done 2026-08-29**, built against the in-memory store at the project owner's
  direction (no database exists yet). Every figure flows through `guestRepo`, which is
  dual-mode, so the dashboard needs no change when Postgres lands — only `DATABASE_URL`.
  - [x] `GET /admin/rsvp` — six headline tiles: Total Invited, Accepted (families),
        Headcount (people), Declined, Pending, Responded (%).
  - [x] Visual chart — horizontal bar chart of the accepted/declined/pending breakdown, as
        **inline SVG rendered server-side**, so it is correct in the first paint and pulls no
        third-party charting library (same constraint as the self-hosted webfonts).
  - [x] `GET /api/admin/dashboard` — the stats as JSON. Admin-only (401 otherwise).
  - [x] `GET /api/admin/dashboard/export` — CSV download of the full guest list with RSVP
        status, headcount, and participant names. Admin-only (401 otherwise).
  - [x] Real-time — the page polls the stats endpoint every 15s and updates the tiles and bars
        in place, so no manual refresh is needed. A failed poll leaves the last good numbers
        on screen rather than blanking the dashboard.
  - [x] New route names match what `WEDDING_API_DOCUMENTATION.md` already specified, rather
        than inventing parallel paths.
- Counting rules are pinned in `tests/rsvp-stats.test.mjs` because the couple books catering
  against these numbers:
  - Soft-deleted guests are excluded from every figure, headcount included.
  - The three buckets always sum to `totalInvited`, so the chart cannot lie.
  - An acceptance carrying **no** participant names counts as **one** head, not zero.
    `POST /api/guest/rsvp` does not enforce that names are supplied (only the page JS asks),
    and understating is the direction that costs money on the day.
- CSV hardening (`src/rsvp/guestCsv.js`): RFC 4180 quoting, and values beginning `=` `+` `-` `@`
  are prefixed with a quote so Excel/Sheets treat them as text rather than executing them.
  **Not hypothetical** — a WhatsApp number like `+94771234567` triggers it on every export.
  The file also carries a UTF-8 BOM so Excel on Windows renders Sinhala names correctly.
- Tests: `tests/rsvp-stats.test.mjs` (13 unit cases over the pure aggregation and CSV logic)
  and `tests/rsvp-dashboard.test.mjs` (8 route/page cases). Full suite **115/115 green**.
- Verified in a browser: figures matched the API, the chart scaled correctly, the CSV
  downloaded with the expected content, and a guest RSVP submitted while the dashboard sat
  open was picked up by the poll with no reload (pending 2→1, accepted 1→2, headcount 3→5).
- Deliberately **not** built, and why:
  - `byPartition` (groom/bride split) from the API doc — superseded, the project has a single
    admin account (P0-09), so there are no partitions.
  - `byRelationshipCategory` breakdown — not in the P0-08 acceptance criteria, and
    `/admin/guests` already filters by relationship. Easy to add later if wanted.

### Slice 13: Supabase Storage setup for image uploads — not started, deferred until Slices 18–19 are done
- User value: Foundation for every admin image upload feature below — without this, all image fields remain URL-only.
- Acceptance criteria:
  - Storage bucket(s) created (e.g. single `wedding-media` bucket with folder prefixes: `hero/`, `invitations/`, `venues/`, `story/`, `gallery/`)
  - Public-read access for site visitors; write access restricted to authenticated admin only (RLS or service-role-gated upload path)
  - Max file size enforced (proposed: 5MB) and allowed MIME types restricted to `image/jpeg`, `image/png`, `image/webp`
- Status: ❌ Not started. Blocks Slices 14–17.

### Slice 14: Admin image upload endpoint — not started
- User value: Admin pages have a single, reusable way to upload a file and get back a Storage URL.
- Acceptance criteria:
  - `POST /api/admin/upload` accepts multipart form data, validates size/type server-side (not just via client `accept` attribute), uploads to Supabase Storage, returns the public URL
  - On failure, returns a specific reason (file too large / wrong format) per the PRD's edge case: "Error shown in admin with file size/format guidance. Previous template URL unchanged."
  - Requires admin session (401 if unauthenticated)
- Status: ❌ Not started. Depends on Slice 13.

### Slice 15: Reusable upload UI component — not started
- User value: Consistent upload experience (preview, progress, replace, remove) across every admin page that manages images.
- Acceptance criteria:
  - Click-to-browse or drag-and-drop, image preview before and after upload, progress indicator, replace/remove actions
  - Replaces the current URL text inputs on `/admin/theme` (hero image, invitation template)
  - Optional: keep manual URL entry as a fallback/advanced toggle to avoid regressing existing saved values
- Status: ❌ Not started. Depends on Slice 14. Directly resolves the prototype-scoped deviation noted under Slice 8.

### Slice 16: Gallery admin — `/admin/gallery` (P1-04) — not started
- User value: The couple can add, remove, and reorder photos on the public Gallery page without a developer.
- Acceptance criteria:
  - Multi-file select/upload using the Slice 15 component
  - Grid view of existing photos with drag-to-reorder (`display_order`) and delete
  - Persists via `gallery_photos` table (already defined in `WEDDING_DATABASE_SCHEMA.md`)
  - Deleted photos are removed from Storage as well as the DB row (or explicitly soft-deleted — decide and document)
- Status: ❌ Not started. Depends on Slices 13–15. This is currently the most visible gap versus the PRD (no gallery management exists at all yet).

### Slice 17: Childhood photo carousels & venue image upload (P1-02, P1-09) — not started
- User value: The couple can upload childhood photos (bride/groom carousels) on `/admin/story` and a venue image per event on `/admin/events`, instead of leaving these unbuilt.
- Acceptance criteria:
  - `/admin/story`: upload component scoped per `person` (`bride` | `groom`), reorder + delete per carousel, persists via `childhood_photos`
  - `/admin/events`: single-image upload per event, writes `events.venue_image_url`
- Status: ❌ Not started. Depends on Slices 13–15. `/admin/story` and `/admin/events` do not exist yet in the prototype at all — this slice includes building those admin pages, not just the upload piece.

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

## Recent Decisions
- **2026-08-30:** Doc sync pass — no new build work. Corrected staleness: ThemePalette/FontChoice
  pickers and self-hosted webfonts (§4.1) were marked outstanding here but had actually shipped
  2026-08-29 (commits `1f1dae8`, `9433593`); updated both the dedicated section and the Slice 8
  entry to ✅. Relabeled the RSVP dashboard's Accepted/Declined tiles from "families" to "guest
  units" (a guest invitation unit can be single/couple/family per the ubiquitous language doc,
  so "families" was inaccurate) — commit `a99e302`. Flagged uncommitted, out-of-sequence work
  found in the working tree: a complete but untested Table Arrangement feature (P2-06, filed as
  "do not build now") and a Messaging schema draft (Slice 12, "not started") — see Correctness &
  scope risks above; not resolved, awaiting an owner decision. Full suite confirmed 152/152
  green. Persistence blocker (no `DATABASE_URL`, `dotenv` still unused, no migration ledger)
  is unchanged since 2026-08-29 — still the top blocker.
- **2026-08-29 (later):** Before resuming any build work, reprioritized against the 🔴
  blocking-launch list. Decisions made with the project owner:
  1. **Stack: stay on Express, do not migrate to Next.js.** Persistence goes to Postgres
     directly, skipping Supabase Auth/SDK. Hosting choice (non-Vercel) still open — decide
     before Phase 5 deploy planning. PRD amended accordingly (§6 + top-of-doc banner note).
  2. **Guest-session fix and Guest Management (P0-07) are combined into one slice (Slice 18)**
     — they touch the same guest data/repo, and the fix is easiest to verify against real
     guest CRUD. This slice also resolves the "no persistence" blocker.
  3. **RSVP Dashboard (P0-08) stays a separate slice (Slice 19)**, built right after Slice 18,
     not folded in and not deferred behind image uploads.
  4. **Slices 13–17 (image uploads) are explicitly deferred** until Slices 18 and 19 are done.
  New build order: **Slice 18 → Slice 19 → Slices 13–17.** Old Slice 10/11 stubs marked
  superseded rather than deleted, to preserve history.
- **2026-08-29 (earlier):** Scoped out Slices 13–17 to replace URL-only image fields with real Supabase Storage uploads, and to build the still-missing Gallery (P1-04), childhood photo carousels (P1-02), and venue image upload (P1-09) admin pages. Sequencing: Storage setup (13) → upload endpoint (14) → reusable upload component (15) must land first; Gallery (16) and Story/Events uploads (17) can then proceed in either order. Superseded in priority (not scope) by the decision above — still the correct internal order once 13–17 resume.
