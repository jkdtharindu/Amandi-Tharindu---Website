Project: Amandi & Tharindu Wedding Website
Architecture: Monolith (Next.js 16 / App Router). Migration from the original Express prototype is in progress; both currently coexist.
Frontend: `app/` (Next.js 16, React 19, TypeScript, Tailwind v4). Legacy prototype UI in `src/` (plain ESM JS), retained side-by-side until parity is confirmed.
Backend: Next.js route handlers under `app/api/` with Supabase; legacy prototype backend in `src/server.js` (Express).

> **Next.js version note.** This project targets the CURRENT stable Next.js (16.3.3 at
> time of writing), NOT the `14` pin that earlier revisions of this file and the PRD
> specified. Next 16 differs from most models' training data in ways that fail silently.
> Before writing App Router code, read the version-matched docs bundled at
> `node_modules/next/dist/docs/`. In particular:
> - `middleware.ts` is deprecated — the file is **`proxy.ts`** and the export is **`proxy`**.
> - `params` and `searchParams` are **Promises** in `page.tsx` AND `route.ts` — `await` them.
> - `cookies()` / `headers()` are **async only**; sync access was removed in 16.
> - `next lint` was removed; run `eslint` directly (flat config in `eslint.config.mjs`).
> - Turbopack is the default for `dev` and `build`; no `--turbopack` flag.
> - Tailwind v4 has **no `tailwind.config.ts`** — tokens live in `@theme` in `app/globals.css`.
Database: Supabase (Postgres). Lightweight adapter expected (direct `pg` or `@supabase/supabase-js`) — no ORM required.
External services: Twilio (WhatsApp/SMS), Resend (email), Supabase Storage, Vercel (hosting/deploys).

**High-level architecture (text diagram)**

Frontend (Next.js app) <-- HTTPS --> API route handlers (Next.js) <-- Supabase client --> Postgres (Supabase)
                             |
                             +-- Messaging service adapters --> Twilio / Resend (HITL gated)
                             |
                             +-- Storage (Supabase Storage) for images / invitation templates

Prototype note: current `src/server.js` runs an Express demo server used by `src/smoke.js` to exercise login flows.

**Folder structure (top-level) and purpose**
- **`app/`**: Next.js App Router sources — built, not planned. `app/(public)/` is the wedding-facing route group (home, story, celebration, gallery, wishes, login, invitation); `app/admin/` is the admin panel (login, dashboard, guests, theme, events, sections, table-arrangement), protected by `lib/adminGuard.ts`; `app/api/` holds route handlers for both guest and admin flows.
- **`components/admin/`**: admin-only UI (`AdminNav.tsx`, `GuestManager.tsx`, `RsvpChart.tsx`, `WhatsAppReminderModal.tsx`, `ThemeEditor.tsx`, `EventManager.tsx`, `SectionManager.tsx`, `TableArrangement.tsx`).
- **`components/public/`**: wedding-facing UI (`SiteHeader.tsx`, `PageFooter.tsx`, `Countdown.tsx`, `CustomSections.tsx`, etc.).
- **`lib/`**: cross-cutting server helpers, e.g. `adminGuard.ts` (session check + redirect for `/admin/*` pages and 401 for `/api/admin/*`).
- **`src/admin/`**: admin business logic, framework-agnostic JS (unit-tested without Next.js): `adminAuth.js`, `adminSession.js`, `adminRepo.js` (DB/in-memory data access), `generateGuestCode.js`, `guestValidation.js`, `guestQueries.js`, `categories.js` (configurable relationship groups), `messageTemplates.js` (WhatsApp reminder template + wa.me link builder).
- **`src/`** (remainder): legacy Express prototype, kept side-by-side for `npm run smoke` / `npm run start:legacy`. Key files:
  - **`src/server.js`**: demo Express server (legacy, not the Next.js app)
  - **`src/smoke.js`**: smoke test that exercises login + invitation flow against the legacy server
  - **`src/guest-auth/`**: guest-session authentication helpers (`loginGuestByCode.js`, `loginGuestByName.js`) — shared by both the legacy server and the Next.js API routes
  - **`src/data/guestStore.js`**: in-memory guest fixture (used when `DATABASE_URL` is unset)
- **`src/theme/`**, **`src/sections/`**, **`src/table-arrangement/`**, **`src/celebration-events/`**: framework-agnostic domain logic for the theme editor, section manager, table planning, and event manager (P1-09/P1-10/P1-11/P1-14) — each has a `*Repo.js` (DB-or-in-memory dual mode, same pattern as `src/admin/adminRepo.js`) and its own validation module, unit-tested independently of Next.js. `src/celebration-events/` is the newest of the four (2026-09-04).
- **`migrations/`**: SQL migration files matching PRD schema (apply with a migration runner before using a real DB)
- **`tests/`**: unit and integration tests (TDD slices) — run as `tests/**/*.test.mjs`, not a fixed file list
- **`package.json`**: scripts for the Next.js app (primary) and the legacy prototype (`:legacy` suffix)
- **`TASKS.md`, `HITL.md`, `UBIQUITOUS_LANGUAGE.md`, `amandi-tharindu-wedding-PRD.md`, `MEMORY.md`**: project planning, guardrails, domain vocabulary, and dated architectural decisions — read these first

**Build / run / test / deploy (current prototype)**
- Install dependencies:

```bash
npm install
```

- Run legacy demo server (not the Next.js app):

```bash
npm run start:legacy    # runs node src/server.js
```

- Run smoke test (starts ephemeral legacy server + exercises login):

```bash
npm run smoke
```

- Run unit tests (all of them — admin, guest-auth, and legacy):

```bash
npm test         # runs node --test "tests/**/*.test.mjs"
```

- Deploy: PRD intends Vercel (Next.js). Do NOT deploy to production without HITL approval (see Agent rules below).

**Build / run / test (Next.js app)**
- Already scaffolded — do NOT re-run `create-next-app`. (The old instruction here said
  `npx create-next-app@14 --experimental-app`, which is wrong twice over: the version is
  stale and `--experimental-app` no longer exists.)
- Dev server (port 3010, so it does not collide with the legacy Express server on 3000):

```bash
npm run dev
```

- Production build:

```bash
npm run build
npm run start     # Next.js production server or deploy to Vercel
```

**Universal coding conventions (language-agnostic)**
- **Domain-first naming:** Use canonical names from `UBIQUITOUS_LANGUAGE.md`. Prefer `Guest`, `InvitationCode`, `RSVP`, `RSVPStatus`, `RSVPResponse`, `Participant`, `ThemeSettings`, `InvitationTemplate`, `MessageTemplate`, `MessageLog`, `SiteSection`.
- **One concept, one name:** Do not introduce synonyms for domain entities (avoid `user`, `person`, `account` in place of `Guest` / `Admin`).
- **Tests first:** Follow strict TDD — write failing tests before implementing behavior for each slice.
- **Small commits / small PRs:** Each slice should be an end-to-end, test-covered change.
- **Secrets & env:** Never check secrets into source. Use `.env` / `.env.example` and a secret manager for CI/CD.
- **DB naming:** Use snake_case in Postgres (e.g., `is_deleted`, `rsvp_status`). Map to language-native naming at the adapter layer (e.g., `isDeleted` in JS objects).
- **APIs:** API endpoints return consistent, explicit shapes. Example for login by name/code: `{ type: 'exact', guest: {...} }` or `{ type: 'candidates', candidates: [...] }` — do not return mixed primitive/array types.
- **Error shapes:** Standardize error responses: `{ success: false, reason: 'machine_readable_key', message: 'human-friendly explanation' }`.

**Agent rules — what an AI must NOT do autonomously**
Any agent (Claude, Copilot, Gemini, etc.) reading this repo MUST NOT perform the following actions without explicit human approval (a clear `yes`/`no` reply to the exact HITL prompt below):

- Deploy or publish to any environment (including Vercel). Must present the exact HITL prompt and wait for `yes`.
- Run database migrations (up or down) against any non-local database. Present HITL prompt first.
- Delete files or database records. Present HITL prompt first.
- Modify environment variables or secrets in any repo, CI, or hosting platform.
- Push code to `main` or any production branch (no automatic git pushes).
- Make any external API call that can cost money or send messages (Twilio, Resend). All sends require HITL confirmation.
- Create or update live production content that affects guests publicly without explicit approval.
- Change admin access, authentication flows, or production permission policies.
- Modify Supabase buckets, policies, or DB permissions without human confirmation.

HITL prompt format to present exactly (no paraphrase):

"⚠️ HITL CHECKPOINT: I am about to [action]. This will [consequence]. Shall I proceed? (yes / no)"

If the agent does not receive `yes`, it must abort the action and await explicit instructions.

**Integration points — environment variables & what they control**
- `NODE_ENV` — `development` | `production` — controls logging and dev optimizations.
- `SESSION_SECRET` — signing key for session cookies and tokens.
- `SUPABASE_URL` — Supabase project URL (Postgres + Auth + Storage endpoint).
- `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase client credentials (service key only for server-side operations; never expose in frontend).
- `DATABASE_URL` — direct Postgres connection string (if using `pg` for migrations).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` — single-admin login credentials (`src/admin/adminAuth.js`). Hash format is `<16-byte salt hex>:<64-byte scrypt key hex>`; generate with `npm run admin:set-password`. See MEMORY.md 2026-09-03 for why this is env-credential rather than Supabase Auth.
- `GUEST_CATEGORIES` — optional comma-separated list overriding the default relationship groups (`Relations,Colleagues,Neighbours,Friends`); read by `src/admin/categories.js`, used for admin UI filters and the first 3 letters of generated invitation codes.
- `NEXT_PUBLIC_SITE_URL` — public origin used to build guest-facing links (invitation URLs in WhatsApp reminder messages; also CSRF/Origin verification). Not yet set in `.env` as of 2026-09-03 — falls back to `http://localhost:3010`.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` — Twilio credentials and sender phone for WhatsApp/SMS (HITL gated sends). Not currently used — the WhatsApp reminder feature (2026-09-03) uses a `wa.me` deep link instead; see HITL.md.
- `RESEND_API_KEY` — API key for Resend email sends (HITL gated sends).
- `VERCEL_TOKEN` — CI deploy token (HITL required for production deploys).
- `SENTRY_DSN` (optional) — error tracking key.
- `SMTP_*` (optional) — fallbacks for email provider if used.

Place all example variables in `.env.example` and never check real keys into the repo.

**How to run the project locally end-to-end (prototype)**
1. Clone the repo.
2. Copy `.env.example` → `.env` and populate the minimal local variables (for the prototype no external keys are required).
3. Install dependencies:

```bash
npm install
```

4. Run the smoke script (this starts a temporary server and runs an integration check):

```bash
npm run smoke
```

5. To run the demo server for manual exploration:

```bash
npm run start
# then open http://localhost:3000/invitation/SILVA-001
```

**How to run the full intended stack locally (recommended steps)**
1. Create a Supabase project and obtain `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
2. Create a `.env.local` from `.env.example` and set `SUPABASE_*`, `SESSION_SECRET`, and `RESEND_API_KEY` / `TWILIO_*` (for sandbox testing use vendor sandbox credentials where available).
3. Run migrations against a local Postgres or Supabase DB **only after** a human approves the HITL checkpoint.
4. Start the Next.js dev server:

```bash
npm run dev
```

5. Run E2E tests (after seeding DB):

```bash
# example: run Playwright or Cypress tests once configured
npm run test:e2e
```

**Onboarding checklist for a new human or AI agent (10-minute productivity checklist)**
1. Read `amandi-tharindu-wedding-PRD.md` and `UBIQUITOUS_LANGUAGE.md`.
2. Run `npm install` and `npm run smoke` to validate the local prototype.
3. Review `migrations/` and `tests/` to understand schema and TDD slices.
4. Do NOT run migrations or send messages without HITL approval.
5. If making changes, follow TDD: add tests first, run `npm test`, implement minimal code to pass tests, commit small PR.

---

If you are an AI agent: confirm you understand the HITL rule by returning the exact checkpoint prompt with your intended action substituted (do not proceed further until a human replies `yes`).
