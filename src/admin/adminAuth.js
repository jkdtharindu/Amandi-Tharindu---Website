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
 * Verifies an admin login attempt (bride or groom).
 *
 * Returns `{ success: true, party: 'bride' | 'groom' }` or `{ success: false, reason, message }`.
 * The reason is deliberately identical for a wrong email and a wrong password so
 * the response cannot be used to enumerate admin addresses.
 *
 * Tries bride first, then groom. Falls back to legacy ADMIN_EMAIL/ADMIN_PASSWORD_HASH
 * for backwards compatibility.
 */
export function verifyAdminCredentials(email, password, config = {}) {
  const invalid = {
    success: false,
    reason: 'invalid_credentials',
    message: 'Incorrect email or password.',
  };

  if (!email || !password) return invalid;

  const trimmedEmail = String(email).trim().toLowerCase();

  // Try bride account
  const brideEmail = config.brideEmail ?? process.env.BRIDE_EMAIL ?? '';
  const brideHash = config.bridePasswordHash ?? process.env.BRIDE_PASSWORD_HASH ?? '';

  if (brideEmail && brideHash && HASH_PATTERN.test(brideHash)) {
    const brideEmailMatches = trimmedEmail === String(brideEmail).trim().toLowerCase();
    const bridePwMatches = passwordMatches(password, brideHash);

    if (brideEmailMatches && bridePwMatches) {
      return { success: true, party: 'bride' };
    }
  }

  // Try groom account
  const groomEmail = config.groomEmail ?? process.env.GROOM_EMAIL ?? '';
  const groomHash = config.groomPasswordHash ?? process.env.GROOM_PASSWORD_HASH ?? '';

  if (groomEmail && groomHash && HASH_PATTERN.test(groomHash)) {
    const groomEmailMatches = trimmedEmail === String(groomEmail).trim().toLowerCase();
    const groomPwMatches = passwordMatches(password, groomHash);

    if (groomEmailMatches && groomPwMatches) {
      return { success: true, party: 'groom' };
    }
  }

  // Fallback to legacy single admin account (for backwards compatibility during transition)
  const legacyEmail = config.adminEmail ?? process.env.ADMIN_EMAIL ?? '';
  const legacyHash = config.passwordHash ?? process.env.ADMIN_PASSWORD_HASH ?? '';

  if (legacyEmail && legacyHash && HASH_PATTERN.test(legacyHash)) {
    const legacyEmailMatches = trimmedEmail === String(legacyEmail).trim().toLowerCase();
    const legacyPwMatches = passwordMatches(password, legacyHash);

    if (legacyEmailMatches && legacyPwMatches) {
      // Default to bride party if using legacy account (arbitrary choice)
      return { success: true, party: 'bride' };
    }
  }

  // If no accounts are configured at all, report misconfiguration
  if (
    (!brideEmail || !brideHash || !HASH_PATTERN.test(brideHash)) &&
    (!groomEmail || !groomHash || !HASH_PATTERN.test(groomHash)) &&
    (!legacyEmail || !legacyHash || !HASH_PATTERN.test(legacyHash))
  ) {
    return {
      success: false,
      reason: 'admin_not_configured',
      message: 'Admin login is not configured on this server.',
    };
  }

  // One or more accounts exist, but credentials didn't match any
  return invalid;
}
