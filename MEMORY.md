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


3) Past mistakes and corrections (things the AI got wrong before)

[YYYY-MM-DD] Decision: 
Reason: 
Alternative considered: 

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

[2026-08-22] Summary: Implemented the admin panel requested by the user — admin auth, Theme Editor (`/admin/theme`), and Section Manager (`/admin/sections`) — in the Express prototype, following PRD v1's scope after clarifying a conflict between the two PRDs in the repo. Added `src/admin-auth/`, `src/theme/`, `src/sections/`, matching `data/` stores, migration `003_create_admin_theme_sections.sql` (written, not applied), and tests (19 new unit/integration tests, all passing). Along the way, fixed two pre-existing bugs unrelated to the admin feature: `server.js` starting a real listener on import (broke `smoke.js` and blocked test files from importing the app), and `guest-login-api.test.mjs` never sending a CSRF token. `npm test` now runs the full suite (34/34 green). HITL checkpoint for admin auth + migration file was confirmed by the user before implementation began.
