# Amandi & Tharindu — Wedding Website

Local setup, tests, and migration instructions for developers.

Prerequisites
- Node.js (LTS, e.g. v24.x)
- npm
- Optional: Supabase CLI / psql for running migrations

Quick start (Next.js app — primary)

```bash
cd "c:\Users\User\Desktop\AT WD"
npm install
npm test
npm run dev
```

Then open http://localhost:3010.

If PowerShell blocks script execution, use CMD instead:

```bash
cmd /c "npm test"
cmd /c "npm run dev"
```

Notes
- `npm test` runs every test file under `tests/` (node's `--test`).
- `npm run dev` starts the Next.js app on port 3010 — this is the real app (public pages + admin panel), not the legacy demo.
- `npm run smoke` / `npm run start:legacy` exercise the older Express prototype (`src/server.js`), kept side-by-side for now.
- The public site pages reuse a shared page wrapper and a modern wedding-themed layout.
- Guest sessions are a signed, expiring `guest_session` cookie (see `SESSION_SECRET` below) — not the legacy demo cookie.

Admin panel

```bash
# One-time: generate an admin password hash and add it to .env
echo "your-password" | npm run admin:set-password
# Then set ADMIN_EMAIL and paste the printed ADMIN_PASSWORD_HASH into .env
```

Open http://localhost:3010/admin to sign in. Guest relationship categories default to `Relations, Colleagues, Neighbours, Friends` — override with a `GUEST_CATEGORIES` env var (comma-separated) to add your own.

Migrations (Supabase / Postgres)

SQL migration files are in `migrations/`.
To apply locally using psql:

```bash
psql <CONN_STRING> -f migrations/001_create_guests.sql
psql <CONN_STRING> -f migrations/002_create_rsvp_responses.sql
psql <CONN_STRING> -f migrations/003_create_theme_settings.sql
```

Or use the Supabase CLI:

```bash
supabase db push --file migrations/001_create_guests.sql
supabase db push --file migrations/002_create_rsvp_responses.sql
supabase db push --file migrations/003_create_theme_settings.sql
```

Or use the project HITL preflight command for local migrations:

```bash
npm run hitl:migrate
```

Local development with a database

```bash
cp .env.example .env
# Set DATABASE_URL to a local Postgres connection string
npm install
npm run migrate
npm run seed:db
npm run start:browser
```

HITL (Human-in-the-Loop)

Per `HITL.md`, DO NOT run production migrations, deploys, or messaging commands without explicit human approval. Any migration or deploy to production must be confirmed with the exact HITL checkpoint message.

Next steps for developers
- Replace in-memory demo data with Supabase-backed storage (works today when `DATABASE_URL` is set; in-memory is the local fallback)
- Theme editor, section manager, and event manager (P1) — not yet built
- Full messaging center (P1-06/P1-07) — only a single-guest WhatsApp reminder exists today (wa.me deep link, no Twilio, no message log)

Contact
- Project PRD: `amandi-tharindu-wedding-PRD.md`
- Ubiquitous language: `UBIQUITOUS_LANGUAGE.md`
- HITL policy: `HITL.md`
"# Amandi-Tharindu---Website" 
