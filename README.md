# Amandi & Tharindu — Wedding Website

Local setup, tests, and migration instructions for developers.

Prerequisites
- Node.js (LTS, e.g. v24.x)
- npm
- Optional: Supabase CLI / psql for running migrations

Quick start

```bash
cd "c:\Users\User\Desktop\AT WD"
npm install
npm test
npm run smoke
npm start
```

If PowerShell blocks script execution, use CMD instead:

```bash
cmd /c "npm test"
cmd /c "npm run smoke"
```

Notes
- `npm test` runs the whole suite with node's `--test` (unit, API, and page-rendering tests).
- `npm run smoke` runs an in-process server smoke test that exercises `/api/guest/login` and `/invitation/:code`.
- The public site pages reuse a shared page wrapper. Colours, fonts, couple names, wedding date, hero image, and the invitation name-overlay are read from `ThemeSettings` and editable at `/admin/theme` — changes apply site-wide on the next page load.
- The current server is a minimal demo: session persistence is an HTTP-only cookie named `guest_session`. Do not use this in production.

Admin panel

The admin panel is available at `/admin`. Locally, with `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`
unset, a development-only fallback account applies:

```
email:    admin@example.com
password: changeme123
```

Both variables are **required in production** — the app refuses to boot without them. Generate a
password hash with:

```bash
node -e "import('./src/admin-auth/hashPassword.js').then(m => console.log(m.hashPassword('your-password')))"
```

Admin routes: `/admin` (login), `/admin/theme` (ThemeSettings editor), `/admin/sections`
(SiteSection manager). Guest management and the RSVP dashboard are not yet built.

Migrations (Supabase / Postgres)

SQL migration files are in `migrations/`.
To apply locally using psql:

```bash
psql <CONN_STRING> -f migrations/001_create_guests.sql
psql <CONN_STRING> -f migrations/002_create_rsvp_responses.sql
psql <CONN_STRING> -f migrations/003_create_admin_theme_sections.sql
```

Or use the Supabase CLI:

```bash
supabase db push --file migrations/001_create_guests.sql
supabase db push --file migrations/002_create_rsvp_responses.sql
supabase db push --file migrations/003_create_admin_theme_sections.sql
```

`003_create_admin_theme_sections.sql` creates `admin_users`, `theme_settings` (single-row, seeded
with defaults), and `site_sections`. As of 23 August 2026 it has not been applied to any database —
the prototype runs on in-memory stores until `DATABASE_URL` is set.

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
- Replace in-memory demo data with Supabase-backed storage
- Harden session handling (signed/secure cookies or JWTs)
- Implement full Next.js `app/` routes for invitation and admin panels

Contact
- Project PRD: `amandi-tharindu-wedding-PRD.md`
- Ubiquitous language: `UBIQUITOUS_LANGUAGE.md`
- HITL policy: `HITL.md`
"# Amandi-Tharindu---Website" 
