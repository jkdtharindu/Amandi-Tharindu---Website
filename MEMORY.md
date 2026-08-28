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


[2026-08-28] Decision: Save the owner-pasted "Modern Royal Romance" UI/UX design brief verbatim as `WEDDING_UI_UX_DESIGN_BRIEF.md` and cross-reference it from PRD §4.1 and TASKS.md, rather than adopting its hex values directly into the theme system.
Reason: PRD §4.1 (2026-08-23) already requires colours to come from a curated, contrast-verified `ThemePalette` picker, not raw hex — this brief is written entirely in raw hex and its gold accent (`#C5A059` on `#FBF9F5`) measured 2.34:1 via `src/theme/colors.js`'s `contrastRatio()`, failing the same AA bar that made the project darken Imperial Gold from `#B8860B` to `#8A6508`. The brief also names fonts not yet in the FontChoice candidate list and describes product surfaces (QR boarding-pass invite, guest seating visualizer, admin drag-and-drop floor-plan export) beyond current P2-06 scope. Preserving the brief as its own file keeps the requirement intact for future sessions without silently overriding the picker-only decision or the accessibility gate.
Alternative considered: Directly editing `theme_settings`/CSS to the brief's hex values (rejected — bypasses the picker requirement and ships a colour combination that fails the project's own accessibility gate); ignoring the brief (rejected — it's an explicit owner requirement that needs to persist, just not silently auto-applied).

[2026-08-28] Decision: Approve "Modern Royal Romance" as the sixth `ThemePalette` in PRD §4.1, with its gold accent darkened from `#C5A059` to `#866D3D`.
Reason: Owner explicitly confirmed ("Yes, darken the gold and add it as a sixth approved palette") after being shown the 2.34:1 contrast failure. Darkened the gold proportionally — same RGB channel ratios, scaled to 68% of original value, the identical technique already used to take Imperial Gold from `#B8860B` to `#8A6508` — landing at `#866D3D` (4.68:1 against the `#FBF9F5` background, clears WCAG AA). Primary and Ink both use the brief's single burgundy `#4A1525` (14.01:1), intentionally not split into a separate near-black Ink the way the other five palettes are, because the brief specifies one "Deep Contrast" colour for both roles. Recorded in PRD §4.1's approved-palette table and `TASKS.md`. The picker/cascade UI itself remains unbuilt — this and the other five palettes are documentation only until that ships.
Alternative considered: Keeping the original `#C5A059` and restricting it to non-text decorative use only (rejected by owner in favour of a straightforward accessible fix, matching precedent).

5) Last session summary (leave blank — Claude will fill this in)

[YYYY-MM-DD] Summary: 

[2026-08-23] Summary: Fixed the previous day's admin panel, which had shipped non-functional. The Theme Editor and Section Manager both saved data that nothing ever read back — `getThemeSettings()` and `listSections()` were wired only into the admin pages rendering their own forms, while the public site used a hardcoded stylesheet. Converted `baseStyles` into `buildStyles(theme)` emitting CSS custom properties, rendered SiteSections on public routes, and added `readableTextColor()` so an admin-chosen colour cannot produce button text failing WCAG AA. Then rebuilt the invitation page into the shared site shell, which uncovered a P0 bug: `getCookieValue()` was called but never defined on that page, so no guest could submit an RSVP from a browser — the API tests passed because they bypass page JavaScript. Fixing it also satisfied P0-02 (InvitationTemplate + name overlay now render). Recorded owner-requested future work: seating plan (P2-06), RSVP cutoff (P2-07, ambiguous — needs the owner's decision), and Chapter 2 productization (PRD §14). Ended at 49/49 tests passing, `src/` lint-clean, four commits on `feature/ui-wrapping` — still unpushed, as the remote branch was deleted. Open items for next session: guest management (P0-07) is the top priority, and `/invitation/:code` still enforces no guest session.

[2026-08-22] Summary: Implemented the admin panel requested by the user — admin auth, Theme Editor (`/admin/theme`), and Section Manager (`/admin/sections`) — in the Express prototype, following PRD v1's scope after clarifying a conflict between the two PRDs in the repo. Added `src/admin-auth/`, `src/theme/`, `src/sections/`, matching `data/` stores, migration `003_create_admin_theme_sections.sql` (written, not applied), and tests (19 new unit/integration tests, all passing). Along the way, fixed two pre-existing bugs unrelated to the admin feature: `server.js` starting a real listener on import (broke `smoke.js` and blocked test files from importing the app), and `guest-login-api.test.mjs` never sending a CSRF token. `npm test` now runs the full suite (34/34 green). HITL checkpoint for admin auth + migration file was confirmed by the user before implementation began.
