import crypto from 'node:crypto';

const KEY_LENGTH = 64;

export function hashPassword(plainPassword, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(plainPassword), salt, KEY_LENGTH).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) return false;
  const [salt, expectedHex] = storedHash.split(':');
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = crypto.scryptSync(String(plainPassword), salt, KEY_LENGTH);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}
