import crypto from 'node:crypto';

/**
 * Admin credential verification (PRD P0-09).
 *
 * The single admin account lives in the environment, not the database:
 *   ADMIN_EMAIL          — the admin's login email
 *   ADMIN_PASSWORD_HASH  — `<16-byte salt hex>:<64-byte scrypt key hex>`
 *
 * Generate a hash with `npm run admin:set-password`.
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
 * Verifies an admin login attempt.
 *
 * Returns `{ success: true }` or `{ success: false, reason, message }`. The
 * reason is deliberately identical for a wrong email and a wrong password so
 * the response cannot be used to enumerate the admin address.
 */
export function verifyAdminCredentials(email, password, config = {}) {
  const adminEmail = config.adminEmail ?? process.env.ADMIN_EMAIL ?? '';
  const passwordHash = config.passwordHash ?? process.env.ADMIN_PASSWORD_HASH ?? '';

  if (!adminEmail || !passwordHash || !HASH_PATTERN.test(passwordHash)) {
    return {
      success: false,
      reason: 'admin_not_configured',
      message: 'Admin login is not configured on this server.',
    };
  }

  const invalid = {
    success: false,
    reason: 'invalid_credentials',
    message: 'Incorrect email or password.',
  };

  if (!email || !password) return invalid;

  const emailMatches =
    String(email).trim().toLowerCase() === String(adminEmail).trim().toLowerCase();

  // Always run the KDF so a wrong email and a wrong password cost the same.
  const pwMatches = passwordMatches(password, passwordHash);

  return emailMatches && pwMatches ? { success: true } : invalid;
}
