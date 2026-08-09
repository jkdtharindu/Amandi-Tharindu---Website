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

Notes
- `npm test` runs unit tests (node's `--test`).
- `npm run smoke` runs an in-process server smoke test that exercises `/api/guest/login` and `/invitation/:code`.
- The current server is a minimal demo: session persistence is an HTTP-only cookie named `guest_session`. Do not use this in production.

Migrations (Supabase / Postgres)

SQL migration files are in `migrations/`.
To apply locally using psql:

```bash
psql <CONN_STRING> -f migrations/001_create_guests.sql
psql <CONN_STRING> -f migrations/002_create_rsvp_responses.sql
```

Or use the Supabase CLI:

```bash
supabase db push --file migrations/001_create_guests.sql
supabase db push --file migrations/002_create_rsvp_responses.sql
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
