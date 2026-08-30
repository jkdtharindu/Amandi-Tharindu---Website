import crypto from 'node:crypto';

const KEY_LENGTH = 64;

/**
 * Hash a plaintext password for storage.
 * Uses Node's built-in scrypt (no external dependency required).
 * Returns "salt:hash" as a single string suitable for a text column.
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a plaintext password against a stored "salt:hash" value.
 * Uses a timing-safe comparison to avoid leaking hash equality via timing.
 */
export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;

  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;

  const candidateHash = crypto.scryptSync(password, salt, KEY_LENGTH);
  const storedHash = Buffer.from(hashHex, 'hex');

  if (candidateHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(candidateHash, storedHash);
}
