Project: Amandi & Tharindu Wedding Website
Architecture: Monolith (intended Next.js 14 / App Router) — repository currently contains a small Express prototype used for initial slices
Frontend: intended `app/` (Next.js 14, TypeScript). Prototype UI/demo in `src/` (plain ESM JS).
Backend: intended serverless API route handlers (Next.js `app/api` or `pages/api`) with Supabase; prototype backend in `src/server.js` (Express).
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
- **`app/` (planned)**: Next.js App Router sources (pages, route handlers, UI). Target location for frontend and API handlers.
- **`src/`**: Prototype server and helpers. Key files:
  - **`src/server.js`**: demo Express server (quick local demo)
  - **`src/smoke.js`**: smoke test that exercises login + invitation flow
  - **`src/guest-auth/`**: authentication helpers (`loginGuestByCode.js`, `loginGuestByName.js` — **name-based login is removed from PRD as of 2026-08-29; `loginGuestByName.js` is prototype-only and must not be ported to Next.js**)
  - **`src/data/guestStore.js`**: in-memory guest fixture (prototype only)
  - **`src/admin-auth/`**: Admin credential handling (`hashPassword.js` — scrypt hash/verify, `verifyAdminCredentials.js`)
  - **`src/theme/`**: ThemeSettings — `themeRepo.js` (dual-mode read/write), `mergeThemeUpdate.js` (field allow-list, validation, `FIELD_LABELS` for the admin form), `colors.js` (`readableTextColor` picks button ink by measured WCAG contrast)
  - **`src/sections/`**: SiteSections — `sectionsRepo.js` (dual-mode CRUD), `validateSection.js` (valid pages and section types)
  - **`src/data/adminStore.js`, `themeStore.js`, `sectionsStore.js`**: in-memory fixtures used when `DATABASE_URL` is unset (prototype only)
- **`migrations/`**: SQL migration files matching PRD schema (apply with a migration runner before using a real DB)
- **`tests/`**: unit and integration tests (TDD slices)
- **`package.json`**: scripts for build/run/test for the prototype
- **`TASKS.md`, `HITL.md`, `HITL_NOTES_WEDDING.md`, `WEDDING_UBIQUITOUS_LANGUAGE.md`, `WEDDING_DATABASE_SCHEMA.md`, `WEDDING_UI_UX_SPEC.md`, `WEDDING_MODEL_SELECTION.md`, `amandi-tharindu-wedding-PRD.md`**: project planning, guardrails, design spec, and domain vocabulary — read these first

**Build / run / test / deploy (current prototype)**
- Install dependencies:

```bash
npm install
```

- Run demo server:

```bash
npm run start    # runs node src/server.js
```

- Run smoke test (starts ephemeral server + exercises login):

```bash
npm run smoke
```

- Run unit tests (prototype):

```bash
npm test         # runs node --test tests/*.test.mjs (whole suite: unit + API + rendering)
```

- Build (TypeScript compile step placeholder):

```bash
npm run build
```

- Deploy: PRD intends Vercel (Next.js). Do NOT deploy to production without HITL approval (see Agent rules below).

**Build / run / test (intended Next.js app)**
- Scaffold: `npx create-next-app@14 --experimental-app` (TypeScript)
- Dev server:

```bash
npm run dev       # Next.js dev server (after migrating files into `app/`)
```

- Production build:

```bash
npm run build
npm run start     # Next.js production server or deploy to Vercel
```

**Universal coding conventions (language-agnostic)**
- **Domain-first naming:** Use canonical names from `WEDDING_UBIQUITOUS_LANGUAGE.md`. Key terms: `Guest`, `InvitationCode`, `DisplayName`, `InvitationType`, `InvitedBy`, `RelationshipCategory`, `SubGroup`, `GuestPartition`, `RSVPStatus`, `RSVPResponse`, `SlotCount`, `Participant`, `ThemeSettings`, `InvitationTemplate`, `NameOverlay`, `EnvelopeAnimation`, `RSVPBar`, `RSVPReveal`, `WhatsAppConfirmationButton`, `MessageTemplate`, `MessageLog`, `SiteSection`. Never use: `user`, `invitee` (in code), `attendee`, `name` (in place of `display_name`), `relationship` (use `relationship_category`).
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
- `ADMIN_EMAIL` — the single Admin account's email. **Required in production** (`src/data/adminStore.js` throws on boot without it).
- `ADMIN_PASSWORD_HASH` — scrypt hash of the Admin password, in `salt:hash` hex form. **Required in production.** Generate with `npm run admin:hash`, which prompts for the password rather than taking it as an argument. Never commit a real value. **There is no fallback account:** when either var is unset the admin store is empty and every login returns `503 admin_not_configured`. This applies locally too — the dev-only fallback was removed on 2026-08-29.
- `SUPABASE_URL` — Supabase project URL (Postgres + Auth + Storage endpoint).
- `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase client credentials (service key only for server-side operations; never expose in frontend).
- `DATABASE_URL` — direct Postgres connection string (if using `pg` for migrations).
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` — Twilio credentials and sender phone for WhatsApp/SMS (HITL gated sends).
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
1. Read `amandi-tharindu-wedding-PRD.md`, `WEDDING_UBIQUITOUS_LANGUAGE.md`, and `WEDDING_DATABASE_SCHEMA.md`.
2. Run `npm install` and `npm run smoke` to validate the local prototype.
3. Review `migrations/` and `tests/` to understand schema and TDD slices.
4. Do NOT run migrations or send messages without HITL approval.
5. If making changes, follow TDD: add tests first, run `npm test`, implement minimal code to pass tests, commit small PR.

---

If you are an AI agent: confirm you understand the HITL rule by returning the exact checkpoint prompt with your intended action substituted (do not proceed further until a human replies `yes`).
