import crypto from 'node:crypto';

/**
 * Admin credential verification (PRD P1-14B).
 *
 * Two admin accounts live in the environment, not the database:
 *   BRIDE_EMAIL          — the bride's login email
 *   BRIDE_PASSWORD_HASH  — `<16-byte salt hex>:<64-byte scrypt key hex>`
 *   GROOM_EMAIL          — the groom's login email
 *   GROOM_PASSWORD_HASH  — `<16-byte salt hex>:<64-byte scrypt key hex>`
 *
 * Generate hashes with `npm run admin:set-password`.
 *
 * Updated 2026-09-20: Previously supported single ADMIN_EMAIL/ADMIN_PASSWORD_HASH.
 * Now supports separate bride and groom accounts. Falls back to legacy single account
 * for backwards compatibility during transition.
 */

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const HASH_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{128}$/i;

/** Hashes a plaintext password into the stored `salt:key` format. */
export function hashAdminPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const key = crypto.scryptSync(String(password), salt, KEY_BYTES).toString('hex');
  return `${salt}:${key}`;
}

function passwordMatches(password, storedHash) {
  const [salt, expectedKey] = storedHash.split(':');
  const actualKey = crypto.scryptSync(String(password), salt, KEY_BYTES).toString('hex');

  const actual = Buffer.from(actualKey, 'hex');
  const expected = Buffer.from(expectedKey, 'hex');
  if (actual.length !== expected.length) return false;

  return crypto.timingSafeEqual(actual, expected);
}

/**
 * Reads the three admin accounts out of `config`, falling back to the
 * environment. Order matters: the first match wins, so the legacy single
 * account is tried last.
 */
function readAccounts(config) {
  return [
    {
      label: 'BRIDE',
      party: 'bride',
      email: config.brideEmail ?? process.env.BRIDE_EMAIL ?? '',
      hash: config.bridePasswordHash ?? process.env.BRIDE_PASSWORD_HASH ?? '',
    },
    {
      label: 'GROOM',
      party: 'groom',
      email: config.groomEmail ?? process.env.GROOM_EMAIL ?? '',
      hash: config.groomPasswordHash ?? process.env.GROOM_PASSWORD_HASH ?? '',
    },
    {
      // The single pre-2026-09-20 account. It has no side of its own, so it
      // signs in as the bride — an arbitrary but fixed choice.
      label: 'ADMIN',
      party: 'bride',
      email: config.adminEmail ?? process.env.ADMIN_EMAIL ?? '',
      hash: config.passwordHash ?? process.env.ADMIN_PASSWORD_HASH ?? '',
    },
  ];
}

/**
 * Verifies an admin login attempt (bride or groom).
 *
 * Returns `{ success: true, party: 'bride' | 'groom' }` or `{ success: false, reason, message }`.
 * The reason is deliberately identical for a wrong email and a wrong password so
 * the response cannot be used to enumerate admin addresses.
 *
 * Tries bride first, then groom, then the legacy single account.
 *
 * `admin_not_configured` means no account has been set up at all — the login
 * route turns it into a 500, because it is a server fault rather than a bad
 * guess. An account whose hash is present but malformed does **not** report
 * that: it is a configured account that cannot be used, so the attempt fails
 * closed as `invalid_credentials` and the misconfiguration is logged for the
 * operator instead of being described to an unauthenticated caller.
 */
export function verifyAdminCredentials(email, password, config = {}) {
  const invalid = {
    success: false,
    reason: 'invalid_credentials',
    message: 'Incorrect email or password.',
  };

  const accounts = readAccounts(config);

  // "Configured" is email plus hash, whether or not the hash is well-formed.
  // "Usable" additionally requires a hash we can actually compare against.
  const configured = accounts.filter((a) => a.email && a.hash);
  const usable = configured.filter((a) => HASH_PATTERN.test(a.hash));

  for (const account of configured) {
    if (!HASH_PATTERN.test(account.hash)) {
      console.warn(
        `[admin-auth] ${account.label}_PASSWORD_HASH is not in the expected ` +
          'salt:key format, so that account cannot be used. Regenerate it with ' +
          '`npm run admin:set-password`.'
      );
    }
  }

  if (configured.length === 0) {
    return {
      success: false,
      reason: 'admin_not_configured',
      message: 'Admin login is not configured on this server.',
    };
  }

  if (!email || !password) return invalid;

  const trimmedEmail = String(email).trim().toLowerCase();

  let matched = null;
  for (const account of usable) {
    const emailMatches = trimmedEmail === String(account.email).trim().toLowerCase();
    // Compared even when the email does not match, so that the time taken does
    // not reveal whether an address is one of the admin accounts.
    const passwordOk = passwordMatches(password, account.hash);

    if (emailMatches && passwordOk && !matched) {
      matched = account;
    }
  }

  return matched ? { success: true, party: matched.party } : invalid;
}
