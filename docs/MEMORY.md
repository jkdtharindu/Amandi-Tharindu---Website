This file is append-only for decisions.
Do not rewrite history — add new entries with dates.

Project: Amandi & Tharindu Wedding Website
Start date: 2026-08-09

1) Architectural decisions (with date and reason)

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 

[2026-08-22] Decision: Build the admin panel (auth, Theme Editor, Section Manager) into the current Express prototype now, following PRD v1's granular per-field scope, instead of waiting to migrate to Next.js first.
Reason: The repo contains two PRDs with conflicting scope for this feature (`amandi-tharindu-wedding-PRD.md` v1: granular theme editor + generic section manager; `New folder (2)/prd3.md` v3: preset-only theme customizer, explicitly avoids generic section infrastructure pre-launch). User chose v1 scope, Express (not Next.js), and a global settings page with one Save button per element group when asked directly. Admin routes reuse the existing dual-mode repo pattern from `guestRepo.js` (in-memory store when no `DATABASE_URL`, Postgres when present) for consistency.
Alternative considered: Migrating to Next.js first (rejected — bigger upfront effort with no admin feature shipped in the meantime); building v3's preset-only customizer (rejected by user in favor of the more granular v1 scope).


2) Technology choices and why alternatives were rejected

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 

[2026-08-23] Decision: Replace the Theme Editor's raw hex/font-name text inputs with a curated ThemePalette picker and FontChoice picker, adopting the approach specified in `New folder (2)/prd3.md` over the governing PRD's original per-field design.
Reason: The owner requires selecting the wedding's look from a colour palette, with the choice cascading to background, fonts, and all UI, and the font likewise chosen from a list rather than typed. The shipped form asks a non-technical couple to type `#B8860B` and remember exact font names — poor UX for the actual users. Five palettes were defined and contrast-verified with `src/theme/colors.js` before being written into PRD §4.1; all pass WCAG AA. Notably the existing default `#B8860B` FAILED the 4.5:1 bar for button text against both black and white, and was darkened to `#8A6508` to pass — evidence that curated, pre-verified palettes are safer than free colour entry. Custom hex is retained as a secondary advanced option so no working capability is removed. This is also the first point where the governing PRD has been deliberately amended toward prd3, narrowing (not resolving) the two-PRD conflict.
Alternative considered: Keeping free-form hex/font entry and adding a colour picker widget (rejected — it would still let the couple choose an inaccessible or ugly combination, and would not address fonts); switching wholesale to prd3 as the governing document (rejected — prd3 contains other unreviewed scope such as the wax seal and ambient audio engine, and `New folder (2)/tasks3.md` contains materially false claims about the project's state).

[2026-08-23] Decision: Treat commercial resale of this application as "Chapter 2" — a separate project with its own PRD — and build nothing for it during Chapter 1.
Reason: The project owner stated this is their first web app, built for their own wedding, and that they intend to sell it to other couples once it has launched successfully. Recorded in PRD §14. Multi-tenancy is the most expensive thing to retrofit, but building it speculatively now would jeopardise a launch that is already behind schedule, and holding other couples' guest lists carries data-protection obligations that don't exist for one's own wedding. The compromise: adopt only the zero-cost disciplines that keep the door open (repos as the sole DB access path, logic out of route handlers, couple names read from ThemeSettings rather than hardcoded) and defer everything else. This matches the "Future Product Direction" stance already taken in the alternate `New folder (2)/prd3.md`.
Alternative considered: Designing for multi-tenancy from the start (rejected — premature abstraction against a deadline that is already at risk); ignoring the intent entirely (rejected — a few free habits now avoid a painful rewrite later).


3) Past mistakes and corrections (things the AI got wrong before)

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 

[2026-08-23] Decision: API-level tests are not sufficient evidence that a user flow works — assert against the rendered page.
Reason: `/invitation/:code` called `getCookieValue()` in its RSVP submit handler, but the helper was only defined in the login and admin pages' script blocks. Every guest clicking "Submit RSVP" in a real browser hit `ReferenceError: getCookieValue is not defined` — the single most important action on the site was broken. The existing test suite passed throughout, because `tests/guest-login-api.test.mjs` POSTs straight to `/api/guest/rsvp` and never executes the page's JavaScript. The same blind spot hid the write-only Theme Editor and Section Manager (see entry below): all three defects lived in the gap between "the endpoint works" and "the page works". Corrected by rendering-level assertions in `tests/invitation-page.test.mjs` and `tests/theme-rendering.test.mjs`.
Alternative considered: Adding a headless-browser E2E suite (deferred — heavier to run and maintain; asserting on rendered HTML catches this class of bug cheaply, and a real E2E pass is still worth adding before launch).

[2026-08-23] Decision: Shipped the Theme Editor and Section Manager as write-only features — both saved data that nothing ever read back.
Reason: `getThemeSettings()` and `listSections()` were each wired only into the admin page that renders their form. The public site used a hardcoded `baseStyles` string, so changing a colour or adding a section had zero visible effect, directly contradicting the PRD's "Changes reflect site-wide instantly". The gap survived because the tests covered validation and persistence but never asserted that a saved value reached a rendered page. Corrected by converting `baseStyles` into `buildStyles(theme)` emitting CSS custom properties, rendering SiteSections on public routes, and adding `tests/theme-rendering.test.mjs` — end-to-end assertions that would have caught it.
Alternative considered: Treating it as cosmetic and deferring (rejected — a settings screen that silently does nothing is worse than no settings screen, because the couple would trust it).

[2026-08-22] Decision: Fixed `src/server.js` so `app.listen()` only runs on direct `node src/server.js` execution, not on every import.
Reason: The old guard (`if (process.argv[2] !== 'test')`) was true whenever the module was imported by anything other than a script invoked with a literal `test` arg, so `smoke.js` and any test file importing `createApp` also started a real listener on port 3000/`PORT`, which kept the process alive forever. This silently broke `npm run smoke` and blocked running `guest-login-api.test.mjs` — that's why `package.json`'s `test` script only ever pointed at one file. Replaced with an `import.meta.url` vs `pathToFileURL(process.argv[1])` check (the standard ESM "is this the entry module" idiom) and widened `npm test` to `tests/*.test.mjs`; also fixed `guest-login-api.test.mjs`, which had never fetched a CSRF cookie before posting and was failing 403 on every request once actually run.
Alternative considered: Leaving `npm test` scoped to the single working file (rejected — would have left the new admin tests, and the already-written but never-run guest API tests, permanently unverified by CI).


4) Deprecated patterns (old approaches we've moved away from)

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 


5) Last session summary (leave blank — Claude will fill this in)

[YYYY-MM-DD] Summary: 

[2026-08-29] Summary (UI/UX Grill Me): Owner-confirmed UI/UX decisions captured in new `WEDDING_UI_UX_SPEC.md`. Key decisions: (1) Font pairing locked — Cormorant Garamond (headings) + Montserrat (body) + Great Vibes (name overlay script). All three must be self-hosted `.woff2` — no CDN. (2) RSVP form opens as an inline reveal below the invitation card, not a modal. (3) Invitation template: owner will supply a 1080×1520px portrait image after visiting the stationer; system overlays guest's `display_name` in Great Vibes script. (4) Envelope unfold animation (~2s total) plays on login before invitation is revealed. (5) Site is fully gated — pre-login shows only animated couple names typography, no countdown, no nav, no content. (6) QR code on physical card links directly to `/invitation/[code]`; name-based login removed entirely — code-only entry. (7) Two-admin model: Groom (super admin) + Bride (second admin); `invited_by` auto-locks to logged-in admin; WhatsApp confirmation button after RSVP routes to the correct admin's number. (8) Guest model extended: `invitation_type` (Single/Couple/Family), `relationship_category` (Family/Relations/Friends/Colleagues/Neighbours/Invitees), `sub_group` (custom label for seating stage), `display_name` (exactly as it appears on invitation). (9) CSV import supported for bulk guest entry. (10) QR boarding pass, seating visualizer, and admin floor-plan canvas confirmed as P2 — nothing built now. (11) Animation philosophy locked: subtle and purposeful — soft fades, card lift on hover, no bounce, no parallax.

[2026-08-29] Summary (API documentation): Created `WEDDING_API_DOCUMENTATION.md` — the project had no API doc file. Covers: CSRF token endpoint, guest auth (login/logout/me — code-only, name login not ported), RSVP submit/update, wishes, admin auth (two-admin model), full Slice 10 guest management (GET/POST/PATCH/DELETE guests + CSV import with per-partition access rules and InvitationCode generation spec), Slice 11 dashboard (specced, not built), Slice 12 messaging (specced with HITL gate, not built), theme settings, section manager. Also includes a prototype vs Next.js porting table for every route. TASKS.md Slice 10 entry updated with full acceptance criteria referencing the API doc. MASTER_INDEX.md updated.

[2026-08-29] Summary (stale doc fixes): Fixed four remaining stale documents. (1) PRD §6 Constraints: updated admin count (one → two), removed name-based login constraint, updated relationship categories (4 → 6 values), added invitation type, physical card/QR, font, and sub-group constraints. (2) PRD §7 inline schema: replaced with a redirect notice pointing to `WEDDING_DATABASE_SCHEMA.md` and listing exactly what is out of date — agents reading the PRD cold will no longer find two conflicting schemas. (3) `README.md`: full rewrite — now reflects Express prototype vs Next.js target state clearly, documents all 5 migrations (including 004 and 005 not yet written), lists all key doc files, and removes the stale single-admin / name-login references. (4) `AGENTS.md`: updated domain-first naming to reference `WEDDING_UBIQUITOUS_LANGUAGE.md` with the full canonical term list; flagged `loginGuestByName.js` as prototype-only (must not be ported); updated `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH` notes to reflect two-admin target; updated onboarding checklist and key doc references.

[2026-08-29] Summary (schema): Created `WEDDING_DATABASE_SCHEMA.md` — the wedding project had no standalone schema file (only PRD §7, which was already outdated). New file includes all tables with full column specs, migration status, GuestPartition RLS notes, derived-value rules, and a schema delta table documenting the 10 new/changed fields from the 2026-08-29 Grill Me session. Key changes vs PRD §7: `guests` gains `display_name`, `invitation_type`, `invited_by`, `sub_group`; `relationship` renamed to `relationship_category` with a 6-value enum; `admin_users` gains `role`; `theme_settings` gains `palette_name`, `font_choice`, `groom_whatsapp`, `bride_whatsapp`, and colour defaults updated to Modern Royal Romance palette. Migration 005 documented as needed before Slice 10.

[2026-08-29] Summary (ubiquitous language): Generated `WEDDING_UBIQUITOUS_LANGUAGE.md` — the canonical vocabulary file the project was missing. Covers all domain terms across people/roles (Guest, Participant, GroomAdmin, BrideAdmin, InvitedBy), identity/access (InvitationCode, GuestSession, InvitationType, DisplayName), classification (RelationshipCategory, SubGroup, GuestPartition), RSVP (RSVPStatus, RSVPResponse, SlotCount), UI/interaction (PreLoginScreen, EnvelopeAnimation, InvitationCard, InvitationTemplate, NameOverlay, RSVPBar, RSVPReveal, WhatsAppConfirmationButton), and admin/content (ThemeSettings, ThemePalette, FontChoice, SiteSection, MessageTemplate, MessageLog). Also documents the schema delta — five new fields on `guests` (`display_name`, `invitation_type`, `invited_by`, `relationship_category`, `sub_group`) and a `role` column needed on `admin_users` — that `DATABASE_SCHEMA.md` does not yet reflect. `MASTER_INDEX.md` updated to register the file correctly.

[2026-08-29] Summary (docs sync): Documentation-only session (no code touched). Filled in `TASKS.md`'s
"Current Slice Details" for Slices 2–9 (name login, ambiguous-name recovery, invitation +
accept/decline, RSVP change, sticky bar, admin auth, Theme Editor, Section Manager), which had
only ever been detailed for Slice 1 despite all nine being marked done in the checklist above
it. Added forward-looking Slice 10–12 entries (Guest Management, RSVP Dashboard, Messaging
Center) with acceptance criteria pulled from the PRD. Created `WEDDING_MODEL_SELECTION.md`
(this project never had one, unlike Senhill) — retroactively assigned models to Slices 1–9
based on actual shipped complexity, flagging Slices 4, 8, and 9 as ones that in hindsight
warranted Opus 5 or wider verification (Slice 4 shipped a P0 bug; Slices 8 and 9 both shipped
write-only). Recommended Opus 5 for Slice 10 (top launch-priority gap) and Slice 12 (three
external integrations, HITL-gated), Sonnet 5 for Slice 11. Also noticed `MASTER_INDEX.md`
lists `UBIQUITOUS_LANGUAGE.md` as present in Knowledge for this project, but no such file
exists among the uploaded wedding docs — flagged in `MASTER_INDEX.md`, not fixed (out of
scope for this session; needs the owner's decision on whether to generate it or drop the
line).

[2026-08-23] Summary: Fixed the previous day's admin panel, which had shipped non-functional. The Theme Editor and Section Manager both saved data that nothing ever read back — `getThemeSettings()` and `listSections()` were wired only into the admin pages rendering their own forms, while the public site used a hardcoded stylesheet. Converted `baseStyles` into `buildStyles(theme)` emitting CSS custom properties, rendered SiteSections on public routes, and added `readableTextColor()` so an admin-chosen colour cannot produce button text failing WCAG AA. Then rebuilt the invitation page into the shared site shell, which uncovered a P0 bug: `getCookieValue()` was called but never defined on that page, so no guest could submit an RSVP from a browser — the API tests passed because they bypass page JavaScript. Fixing it also satisfied P0-02 (InvitationTemplate + name overlay now render). Recorded owner-requested future work: seating plan (P2-06), RSVP cutoff (P2-07, ambiguous — needs the owner's decision), and Chapter 2 productization (PRD §14). Ended at 49/49 tests passing, `src/` lint-clean, four commits on `feature/ui-wrapping` — still unpushed, as the remote branch was deleted. Open items for next session: guest management (P0-07) is the top priority, and `/invitation/:code` still enforces no guest session.

[2026-08-22] Summary: Implemented the admin panel requested by the user — admin auth, Theme Editor (`/admin/theme`), and Section Manager (`/admin/sections`) — in the Express prototype, following PRD v1's scope after clarifying a conflict between the two PRDs in the repo. Added `src/admin-auth/`, `src/theme/`, `src/sections/`, matching `data/` stores, migration `003_create_admin_theme_sections.sql` (written, not applied), and tests (19 new unit/integration tests, all passing). Along the way, fixed two pre-existing bugs unrelated to the admin feature: `server.js` starting a real listener on import (broke `smoke.js` and blocked test files from importing the app), and `guest-login-api.test.mjs` never sending a CSRF token. `npm test` now runs the full suite (34/34 green). HITL checkpoint for admin auth + migration file was confirmed by the user before implementation began.
