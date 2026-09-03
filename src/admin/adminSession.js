import crypto from 'node:crypto';

/**
 * Signed admin session tokens (PRD P0-09).
 *
 * Format: `<base64url payload>.<hex hmac>`. The payload is base64url so it
 * never contains a `.` of its own, which keeps the split unambiguous.
 *
 * This is deliberately separate from `src/session.js` (guest sessions): admin
 * sessions carry an expiry and are signed over a structured payload.
 */

const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function resolve(config = {}) {
  return {
    secret: config.secret ?? process.env.SESSION_SECRET ?? '',
    ttlMs: config.ttlMs ?? DEFAULT_TTL_MS,
  };
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** Issues a signed session token for the given admin email. */
export function createAdminSession(email, config = {}) {
  const { secret, ttlMs } = resolve(config);
  if (!secret) {
    throw new Error('session_secret_missing');
  }

  const payload = Buffer.from(
    JSON.stringify({ sub: String(email), exp: Date.now() + ttlMs })
  ).toString('base64url');

  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Verifies a session token.
 *
 * Returns `{ email, expiresAt }` when the signature is valid and the token has
 * not expired, and `null` for every other case — tampering, a wrong secret, a
 * malformed token, or a missing server secret.
 */
export function verifyAdminSession(token, config = {}) {
  const { secret } = resolve(config);
  if (!secret || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  const actualBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (actualBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(actualBuf, expectedBuf)) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!claims || typeof claims.sub !== 'string') return null;
  if (typeof claims.exp !== 'number' || claims.exp <= Date.now()) return null;

  return { email: claims.sub, expiresAt: claims.exp };
}

export const ADMIN_COOKIE_NAME = 'admin_session';
