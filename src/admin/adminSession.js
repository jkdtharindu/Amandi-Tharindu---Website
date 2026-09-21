import crypto from 'node:crypto';

/**
 * Signed admin session tokens (PRD P0-09, P1-14B).
 *
 * Format: `<base64url payload>.<hex hmac>`. The payload is base64url so it
 * never contains a `.` of its own, which keeps the split unambiguous.
 *
 * This is deliberately separate from `src/session.js` (guest sessions): admin
 * sessions carry an expiry and are signed over a structured payload.
 *
 * Updated 2026-09-20: Payload now includes `party: 'bride' | 'groom'` to support
 * separate bride/groom admin accounts (P1-14B).
 *
 * Updated 2026-09-21 (Action 69): `party` moved into the config object. It was
 * briefly the second positional argument, ahead of `config`, which silently
 * reinterpreted every existing `createAdminSession(email, config)` call — the
 * config object became the party. With one optional argument that cannot
 * happen again. The party is also validated now: `String({})` is
 * `'[object Object]'`, so the old signature would have baked a nonsense party
 * into a real token on any server that had SESSION_SECRET set.
 */

const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/** The only sides an admin session may belong to. */
const PARTIES = new Set(['bride', 'groom']);

/** Legacy tokens predate the party claim; they are read as the bride's. */
const DEFAULT_PARTY = 'bride';

function resolve(config = {}) {
  return {
    secret: config.secret ?? process.env.SESSION_SECRET ?? '',
    ttlMs: config.ttlMs ?? DEFAULT_TTL_MS,
    party: config.party ?? DEFAULT_PARTY,
  };
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Issues a signed session token for the given admin email.
 *
 * `config` takes `{ secret, ttlMs, party }`. `party` is `'bride'` or `'groom'`
 * and defaults to the bride; anything else throws rather than being signed
 * into a token, because the party is what every side-scoped admin query
 * filters on.
 */
export function createAdminSession(email, config = {}) {
  const { secret, ttlMs, party } = resolve(config);
  if (!secret) {
    throw new Error('session_secret_missing');
  }
  if (!PARTIES.has(party)) {
    throw new Error('invalid_party');
  }

  const payload = Buffer.from(
    JSON.stringify({ sub: String(email), party: String(party), exp: Date.now() + ttlMs })
  ).toString('base64url');

  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Verifies a session token.
 *
 * Returns `{ email, party, expiresAt }` when the signature is valid and the token has
 * not expired, and `null` for every other case — tampering, a wrong secret, a
 * malformed token, or a missing server secret.
 *
 * For legacy tokens (before 2026-09-20) without a party field, returns `party: 'bride'`.
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

  // A token minted before the party claim existed has none, and is read as the
  // bride's. A token that carries an unrecognised party is rejected outright
  // rather than passed on to the side-scoped queries, which would otherwise
  // filter on a value matching neither side.
  const party = claims.party ?? DEFAULT_PARTY;
  if (!PARTIES.has(party)) return null;

  return { email: claims.sub, party, expiresAt: claims.exp };
}

export const ADMIN_COOKIE_NAME = 'admin_session';
