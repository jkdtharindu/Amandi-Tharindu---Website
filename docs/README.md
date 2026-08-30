# Amandi & Tharindu — Wedding Website

Local setup, tests, and migration instructions for developers and AI agents.
Read `amandi-tharindu-wedding-PRD.md` and `WEDDING_UBIQUITOUS_LANGUAGE.md` before touching any code.

---

## Current state (as of 2026-08-29)

The repository contains an **Express prototype** used for early slice development and UI
validation. The intended production stack is **Next.js 14 + Supabase + Vercel** — migration
to that stack is the next major decision point (see TASKS.md "Current Blockers").

| Layer | Prototype (now) | Target (Next.js) |
|---|---|---|
| Server | `src/main.js` entry → `src/server.js` (Express) | `app/` (Next.js App Router) |
| Auth | Seeded single admin, scrypt cookies | Supabase Auth, two admins (Groom + Bride) |
| Data | In-memory stores (resets on restart) | Supabase Postgres |
| Guest login | Code-only (`/login`) | Code-only + QR (`/invitation/[code]`) |
| Fonts | Falls back to Georgia (not loaded) | Self-hosted Cormorant Garamond, Montserrat, Great Vibes |

> **There is no default admin password.** The account exists only when `ADMIN_EMAIL` and
> `ADMIN_PASSWORD_HASH` are set; otherwise admin login fails closed. Run `npm run admin:hash`
> to create one. (A dev-only fallback was removed on 2026-08-29.)

---

## Prerequisites

- Node.js LTS (v20+ recommended; prototype was developed on v24.x)
- npm
- Optional: Supabase CLI / psql for running migrations

---

## Quick start (prototype)

```bash
cd "c:\Users\User\Desktop\AT WD"   # Windows path — adjust for your machine
npm install
npm test
npm run smoke
npm start
```

If PowerShell blocks script execution, use CMD:

```bash
cmd /c "npm test"
cmd /c "npm run smoke"
```

- `npm test` — runs the full suite (unit + API + page-rendering tests) via Node's `--test`
- `npm run smoke` — in-process smoke test exercising `/api/guest/login` and `/invitation/:code`
- `npm start` — starts the Express demo server on port 3000

---

## Admin panel (prototype)

Available at `/admin`. There is **no default account** — you must create one, locally as well
as in production:

```bash
npm run admin:hash
```

It prompts for an email and password (never passed as an argument, so neither reaches your
shell history), then prints the two lines to paste into `.env`:

```
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD_HASH=<salt:hash>
```

> Until both are set, `adminStore` is empty, every admin login returns
> `503 admin_not_configured`, and `/admin` shows how to fix it. Production additionally
> refuses to boot without them. `.env` is gitignored — never commit a real hash.

Generate a password hash:

```bash
node -e "import('./src/admin-auth/hashPassword.js').then(m => console.log(m.hashPassword('your-password')))"
```

**Built admin routes (prototype):**
- `/admin` — login
- `/admin/theme` — ThemeSettings editor (palette, fonts, hero image, invitation template, name overlay, venue)
- `/admin/sections` — SiteSection manager

**Not yet built:** Guest Management (`/admin/guests`), RSVP Dashboard (`/admin/dashboard`),
Messaging Center (`/admin/messages`) — see TASKS.md Slices 10–12.

---

## Migrations (Supabase / Postgres)

SQL migration files are in `migrations/`. **None have been applied to any database yet**
as of 2026-08-29 — the prototype runs entirely on in-memory stores.

| File | Status | Contents |
|---|---|---|
| `001_create_guests.sql` | Written, not applied | `guests`, `rsvp_responses` |
| `002_create_content_tables.sql` | Written, not applied | `events`, `story_milestones`, `childhood_photos`, `gallery_photos`, `wishes` |
| `003_create_admin_theme_sections.sql` | Written, not applied | `admin_users`, `theme_settings`, `site_sections` |
| `004_create_messaging.sql` | Not yet written | `message_templates`, `message_logs` |
| `005_guest_model_update.sql` | Not yet written | New guest fields, two-admin role, theme fields — see `WEDDING_DATABASE_SCHEMA.md` |

> ⚠️ Migrations 001–003 reflect the old schema (single admin, no `display_name`,
> no `invited_by`, etc.). Migration 005 must be written and HITL-approved before Slice 10.
> See `WEDDING_DATABASE_SCHEMA.md` for the full current schema.

Apply with psql:

```bash
psql <CONN_STRING> -f migrations/001_create_guests.sql
psql <CONN_STRING> -f migrations/002_create_content_tables.sql
psql <CONN_STRING> -f migrations/003_create_admin_theme_sections.sql
```

Or via Supabase CLI:

```bash
supabase db push --file migrations/001_create_guests.sql
```

Or via the HITL preflight command (recommended — prompts for approval):

```bash
npm run hitl:migrate
```

---

## Local development with a real database

```bash
cp .env.example .env
# Set DATABASE_URL to a local Postgres or Supabase connection string
npm install
npm run migrate   # applies pending migrations after HITL approval
npm run seed:db
npm run start:browser
```

---

## Environment variables

| Variable | Required in prod | Notes |
|---|---|---|
| `SESSION_SECRET` | ✅ | Signing key for session cookies |
| `ADMIN_EMAIL` | ✅ | Groom admin email (Supabase Auth in target stack) |
| `ADMIN_PASSWORD_HASH` | ✅ | scrypt hash — prototype only; replaced by Supabase Auth |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Client-side Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only — never expose in frontend |
| `DATABASE_URL` | optional | Direct Postgres connection for migrations |
| `TWILIO_ACCOUNT_SID` | for messaging | HITL gated |
| `TWILIO_AUTH_TOKEN` | for messaging | HITL gated |
| `TWILIO_WHATSAPP_FROM` | for messaging | HITL gated |
| `RESEND_API_KEY` | for email | HITL gated |
| `VERCEL_TOKEN` | for deploys | HITL gated |

Place all values in `.env` locally. Never commit real keys. Keep `.env.example` up to date.

---

## HITL (Human-in-the-Loop)

Per `HITL.md` and `HITL_NOTES_WEDDING.md`, the following actions require explicit owner
approval before proceeding:

- Database migrations (any environment)
- Deploys to Vercel (production or preview)
- Sending messages to guests (WhatsApp, SMS, email via Twilio/Resend)
- Any change to guest authentication or invitation access
- Pushing to `main`

---

## Key documents

| File | Purpose |
|---|---|
| `amandi-tharindu-wedding-PRD.md` | Scope, features, acceptance criteria — read first |
| `WEDDING_UBIQUITOUS_LANGUAGE.md` | Canonical domain vocabulary — use these names in code |
| `WEDDING_DATABASE_SCHEMA.md` | Full current schema with all 2026-08-29 additions |
| `WEDDING_UI_UX_SPEC.md` | Design tokens, animations, component specs |
| `TASKS.md` | Implementation checklist and slice details |
| `WEDDING_MODEL_SELECTION.md` | Which Claude model to use per slice |
| `HITL.md` + `HITL_NOTES_WEDDING.md` | What requires human approval before acting |
| `AGENTS.md` | Architecture overview and agent coding rules |

---

## Onboarding checklist (new developer or AI agent — 10 minutes)

1. Read `amandi-tharindu-wedding-PRD.md` — understand scope and acceptance criteria
2. Read `WEDDING_UBIQUITOUS_LANGUAGE.md` — use canonical names, no synonyms
3. Read `WEDDING_DATABASE_SCHEMA.md` — understand the full data model before writing any SQL
4. Run `npm install` and `npm test` — confirm 49 tests pass locally
5. Run `npm run smoke` — confirm login and invitation flows work
6. Check `TASKS.md` — find the current slice and its acceptance criteria
7. **Do not** run migrations, deploy, or send messages without HITL approval

---

Contact: project PRD is the single source of truth. For questions, contact the project owner directly.
