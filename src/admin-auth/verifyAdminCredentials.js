import crypto from 'node:crypto';
import { hashPassword, verifyPassword } from './hashPassword.js';

/**
 * A real, valid-shaped hash of a value nobody can know. It exists only so an
 * unknown email still pays the same scrypt cost as a known one.
 *
 * Before 2026-09-16 (Next Action 28) this module returned as soon as the email
 * failed to match, skipping the KDF entirely — so a wrong email answered
 * measurably faster than a wrong password, which tells an attacker which admin
 * address is real. `src/admin/adminAuth.js` (the Next.js app's equivalent)
 * already guarded against this; the legacy Express prototype did not.
 */
const DUMMY_HASH = hashPassword(crypto.randomBytes(32).toString('hex'));

export function verifyAdminCredentials(email, password, adminRecord) {
  if (!email || !password) {
    return { success: false, reason: 'missing_credentials', message: 'Email and password are required.' };
  }

  const invalid = { success: false, reason: 'invalid_credentials', message: 'Incorrect email or password.' };

  const emailMatches =
    Boolean(adminRecord) &&
    String(adminRecord.email).toLowerCase() === String(email).trim().toLowerCase();

  // Always run the KDF so a wrong email and a wrong password cost the same.
  const passwordMatches = verifyPassword(
    password,
    emailMatches ? adminRecord.passwordHash : DUMMY_HASH
  );

  return emailMatches && passwordMatches
    ? { success: true, adminId: adminRecord.id }
    : invalid;
}
