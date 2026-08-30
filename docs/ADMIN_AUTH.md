# Admin Authentication

## Overview

Per PRD P0-09: exactly one admin account (the couple), email + password login,
all `/admin/*` routes protected. This scaffold implements that on the current
Express prototype; it is designed to be swapped for Supabase Auth in Phase 5
without changing the route protection contract.

## Architecture

Mirrors the existing guest-auth module (`src/guest-auth/`) so the two stay
consistent:

```
src/
  password.js               scrypt-based hash/verify (no external dependency)
  data/adminStore.js         DEV-ONLY in-memory admin (used when DATABASE_URL unset)
  admin-auth/
    adminRepo.js              findAdminByEmail / findAdminById (db or in-memory)
    loginAdmin.js             credential verification, generic failure reason
    adminSession.js           session signing + requireAdminAuth middleware
    index.js                  barrel export
migrations/
  004_create_admins.sql       admins table + RLS deny-all-clients policy
scripts/
  seed-admin.js               seed a real admin from ADMIN_EMAIL/ADMIN_PASSWORD
```

## Session model

Guest sessions (`guest_session` cookie) sign a raw guest id. Admin sessions
(`admin_session` cookie) sign the value `admin:<adminId>` instead — using a
different cookie name **and** a namespaced payload. This means:

- A stolen guest session cookie cannot be replayed as an admin session, even
  though both are signed with the same `SESSION_SECRET`.
- `verifyAdminSession()` explicitly rejects any signed value that isn't
  prefixed with `admin:`.

This is covered by an automated test
(`tests/admin-auth.test.mjs`: *"rejects a guest_session cookie"*).

## Password storage

No new dependency was added (no `bcrypt`/`argon2`) — `src/password.js` uses
Node's built-in `crypto.scrypt`:

- `hashPassword(password)` → `"<salt>:<hash>"` (random salt per call)
- `verifyPassword(password, stored)` → timing-safe comparison

## Login flow

`POST /api/admin/login` (rate limited: 5 attempts / 15 minutes per IP — this
is stricter than guest login since there is only one admin account, so any
burst of attempts is either a typo or a targeted guess):

1. Verify CSRF token (same mechanism as guest login).
2. Call `loginAdmin(email, password)`.
3. **Both** "no such admin" and "wrong password" return the same
   `{ success: false, reason: 'invalid_credentials' }` — this prevents an
   attacker from using the login endpoint to discover whether an email
   exists. `verifyPassword` also always runs (against a fixed dummy hash
   when the account doesn't exist) so a nonexistent-email request doesn't
   return measurably faster than a wrong-password one.
4. On success, sign and set the `admin_session` cookie
   (`HttpOnly`, `SameSite=Lax`, `Secure` in production).

`POST /api/admin/logout` clears the cookie (CSRF-protected, same as login).

## Route protection

`requireAdminAuth` middleware (per PRD: *"`/admin/*` routes return 401/
redirect to `/admin` if no valid session"*):

- No valid `admin_session` → redirects to `/admin` for browser navigations
  (`Accept: text/html`), or returns `401 { reason: 'admin_auth_required' }`
  for API/XHR requests (`Accept: application/json`).
- Valid session → sets `req.adminId` and calls `next()`.

`GET /admin/dashboard` demonstrates this — it's currently a placeholder page
proving the protection works end-to-end; guest management, the RSVP
dashboard, messaging, and the theme editor (Phase 4) will be built behind
the same middleware.

## Local development

The dev-mode fallback (`src/data/adminStore.js`, used automatically when
`DATABASE_URL` is not set) seeds one account:

```
email:    admin@example.com
password: change-me-now
```

**This is for local development only.** It is never used once a real
database is configured.

## Setting up a real admin account

Once `DATABASE_URL` points at a real database and migrations have been run
(`npm run migrate`), seed the couple's real admin account:

```bash
ADMIN_EMAIL="couple@example.com" ADMIN_PASSWORD="a-real-strong-password" npm run seed:admin
```

Requirements enforced by the script:
- `DATABASE_URL` must be set (refuses to run against the in-memory store).
- `ADMIN_PASSWORD` must be at least 12 characters.
- Re-running with the same email updates the password (`ON CONFLICT ... DO
  UPDATE`), so this also works to rotate the password later.

⚠️ Per `HITL.md`, seeding or changing the production admin's credentials is a
"changing admin access, authentication, or role configuration" action —
confirm with the couple before running this against a production database.

## Database-level protection

`migrations/004_create_admins.sql` enables RLS on the `admins` table with a
blanket deny-all policy. The admin credential table should **never** be
reachable from a Supabase anon/authenticated client key — only the server,
using the `service_role` key (which bypasses RLS), should query it. The
deny-all policy is a safety net in case a client-side key is ever pointed at
this table by mistake.

## Known gaps / future work (Phase 4-5)

- **Password reset via email** (PRD P0-09) is not implemented — this
  requires an email provider (Resend, per `.env.example`) and is deferred
  until messaging infrastructure is built.
- **Supabase Auth migration**: the PRD specifies Supabase Auth for the final
  stack. This scaffold's contract (`requireAdminAuth` gates `/admin/*`,
  generic invalid-credentials response, one admin only) is designed to
  transfer directly — swap `loginAdmin`/`adminSession.js` internals for a
  Supabase Auth session check without changing calling code.
- **Session expiration**: like the guest session, there's currently no TTL
  enforcement on the signed cookie itself. Track this alongside the guest
  session hardening noted in `SECURITY.md`.

## Tests

`tests/admin-auth.test.mjs` (16 tests) covers:
- Password hashing round-trip, rejection of wrong/malformed input, salt
  uniqueness.
- `loginAdmin()` success, wrong password, unknown email (same generic
  reason), missing credentials.
- Full HTTP flow: CSRF enforcement, wrong-credential 401, successful login
  setting the cookie, dashboard 401 (JSON) vs redirect (HTML) when logged
  out, dashboard access after login, guest-session cross-role rejection,
  and rate limiting after repeated failures.
