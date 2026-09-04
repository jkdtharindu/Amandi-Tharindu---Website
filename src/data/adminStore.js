/**
 * The single admin account (P0-09).
 *
 * There is deliberately **no fallback password**. The account exists only when
 * ADMIN_EMAIL and ADMIN_PASSWORD_HASH are both configured; otherwise the store
 * is empty and every admin login fails closed.
 *
 * A dev-only default password lived here until 2026-08-29. It was safe in the
 * sense that production refused to boot without the env vars, but the password
 * sat in a public repository and would have granted admin on any deployment
 * where NODE_ENV was not exactly 'production' — too sharp an edge for a site
 * holding ~350 families' contact details and RSVPs. Removing it is enforced by
 * tests/admin-no-fallback.test.mjs, which scans src/ for baked-in passwords.
 *
 * To set up an admin, run `npm run admin:hash` and put the two printed lines
 * in your `.env` (see `.env.example`).
 */

const envEmail = process.env.ADMIN_EMAIL;
const envPasswordHash = process.env.ADMIN_PASSWORD_HASH;

if (process.env.NODE_ENV === 'production' && (!envEmail || !envPasswordHash)) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD_HASH are required in production');
}

export const adminStore = [];

if (envEmail && envPasswordHash) {
  adminStore.push({
    id: 'admin-1',
    email: envEmail,
    passwordHash: envPasswordHash,
  });
}

/** True when no admin account is configured, so login cannot possibly succeed. */
export function isAdminConfigured() {
  return adminStore.length > 0;
}
