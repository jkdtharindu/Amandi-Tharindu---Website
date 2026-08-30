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

Features
- ✅ Guest authentication (code & name-based login)
- ✅ RSVP submission & changes
- ✅ Rate limiting (prevent brute force attacks)
- ✅ Security headers (clickjacking, XSS, MIME sniffing prevention)
- ✅ Request logging (sanitized access trails)
- ✅ Row-level security policies (database-level access control)
- ✅ CSRF protection (cross-site request forgery prevention)
- ✅ Secure session management (HTTP-only cookies)

Notes
- `npm test` runs unit tests (node's `--test`).
- `npm run smoke` runs an in-process server smoke test that exercises `/api/guest/login` and `/invitation/:code`.
- The public site pages reuse a shared page wrapper and modern wedding-themed layout.
- **Security:** The server includes rate limiting, security headers, request logging, and CSRF protection. See [SECURITY.md](./SECURITY.md) for details.
- **Database:** Row-level security policies are configured in [migrations/003_enable_rls.sql](./migrations/003_enable_rls.sql). See [SUPABASE_RLS_SETUP.md](./docs/SUPABASE_RLS_SETUP.md) for implementation guide.

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

Security & Production
- See [SECURITY.md](./SECURITY.md) for comprehensive security best practices
- See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for pre-launch checklist
- See [docs/SUPABASE_RLS_SETUP.md](./docs/SUPABASE_RLS_SETUP.md) for database access control
- See [docs/RLS_TESTING.md](./docs/RLS_TESTING.md) for RLS testing procedures
- Rate limiting active on `/api/guest/login` and `/api/guest/rsvp` endpoints
- All sensitive data is sanitized in logs (codes, names, IPs masked)

Next steps for developers
- Replace in-memory demo data with Supabase-backed storage
- Implement admin authentication and dashboard (Phase 4)
- Migrate to Next.js 14 + Vercel (Phase 5)
- Deploy and launch! 🚀

Contact
- Project PRD: `amandi-tharindu-wedding-PRD.md`
- Ubiquitous language: `UBIQUITOUS_LANGUAGE.md`
- HITL policy: `HITL.md`
"# Amandi-Tharindu---Website" 
