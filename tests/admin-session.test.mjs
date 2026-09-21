import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAdminSession,
  verifyAdminSession,
} from '../src/admin/adminSession.js';

const CONFIG = { secret: 'test-secret-value', ttlMs: 60_000 };
const EMAIL = 'admin@example.com';

/**
 * Signs an arbitrary claims object with CONFIG's secret, the way
 * createAdminSession does. Used to build tokens createAdminSession itself
 * refuses to issue, so the verify side can be tested on its own.
 */
function signClaims(claims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', CONFIG.secret)
    .update(payload)
    .digest('hex');
  return `${payload}.${signature}`;
}

test('round-trips the admin email through a signed token', () => {
  const token = createAdminSession(EMAIL, CONFIG);
  const session = verifyAdminSession(token, CONFIG);

  assert.equal(session.email, EMAIL);
});

test('the token body is opaque and contains no dot separators of its own', () => {
  const token = createAdminSession(EMAIL, CONFIG);
  assert.equal(token.split('.').length, 2, 'exactly payload.signature');
});

test('rejects a token whose payload was tampered with', () => {
  const token = createAdminSession(EMAIL, CONFIG);
  const [, signature] = token.split('.');

  const forgedPayload = Buffer.from(
    JSON.stringify({ sub: 'attacker@evil.com', exp: Date.now() + 60_000 })
  ).toString('base64url');

  assert.equal(verifyAdminSession(`${forgedPayload}.${signature}`, CONFIG), null);
});

test('rejects a token whose signature was tampered with', () => {
  const token = createAdminSession(EMAIL, CONFIG);
  const [payload] = token.split('.');

  assert.equal(verifyAdminSession(`${payload}.deadbeef`, CONFIG), null);
});

test('rejects a token signed with a different secret', () => {
  const token = createAdminSession(EMAIL, { ...CONFIG, secret: 'other-secret' });
  assert.equal(verifyAdminSession(token, CONFIG), null);
});

test('rejects an expired token', () => {
  const token = createAdminSession(EMAIL, { ...CONFIG, ttlMs: -1000 });
  assert.equal(verifyAdminSession(token, CONFIG), null);
});

test('accepts a token that has not yet expired', () => {
  const token = createAdminSession(EMAIL, { ...CONFIG, ttlMs: 5_000 });
  assert.ok(verifyAdminSession(token, CONFIG));
});

test('rejects malformed tokens without throwing', () => {
  for (const bad of [null, undefined, '', 'no-dot', 'a.b.c', '.', 'x.']) {
    assert.equal(verifyAdminSession(bad, CONFIG), null, `should reject ${bad}`);
  }
});

test('refuses to create a session when no secret is configured', () => {
  assert.throws(
    () => createAdminSession(EMAIL, { secret: '', ttlMs: 1000 }),
    /session_secret_missing/
  );
});

test('refuses to verify a session when no secret is configured', () => {
  const token = createAdminSession(EMAIL, CONFIG);
  assert.equal(verifyAdminSession(token, { secret: '', ttlMs: 1000 }), null);
});

// The party claim (P1-14B). Every side-scoped admin query filters on it, so
// the value that comes back out has to be the one that went in.
test('round-trips the groom party through a signed token', () => {
  const token = createAdminSession(EMAIL, { ...CONFIG, party: 'groom' });
  assert.equal(verifyAdminSession(token, CONFIG).party, 'groom');
});

test('round-trips the bride party through a signed token', () => {
  const token = createAdminSession(EMAIL, { ...CONFIG, party: 'bride' });
  assert.equal(verifyAdminSession(token, CONFIG).party, 'bride');
});

test('defaults to the bride when no party is given', () => {
  const token = createAdminSession(EMAIL, CONFIG);
  assert.equal(verifyAdminSession(token, CONFIG).party, 'bride');
});

test('refuses to sign a token for an unrecognised party', () => {
  // 'BRIDE' is in the list on purpose: the match is exact, so a differently
  // cased value is a mistake rather than a synonym.
  for (const bad of ['everyone', '', 'BRIDE', 'groom ', 0, {}]) {
    assert.throws(
      () => createAdminSession(EMAIL, { ...CONFIG, party: bad }),
      /invalid_party/,
      `should refuse party ${JSON.stringify(bad)}`
    );
  }
});

test('treats a null or undefined party as unspecified, not as an error', () => {
  // `??` cannot tell "absent" from "explicitly null", and the default has to
  // stay for the legacy single-admin path, so both mean the bride.
  for (const unset of [null, undefined]) {
    const token = createAdminSession(EMAIL, { ...CONFIG, party: unset });
    assert.equal(verifyAdminSession(token, CONFIG).party, 'bride');
  }
});

test('a config object is never mistaken for a party', () => {
  // Guards the Action 69 regression: `party` was briefly the second positional
  // argument, so this call signed a token whose party was '[object Object]'.
  const session = verifyAdminSession(createAdminSession(EMAIL, CONFIG), CONFIG);
  assert.equal(session.party, 'bride');
  assert.equal(session.email, EMAIL);
});

test('reads a legacy token with no party claim as the bride', () => {
  const token = signClaims({ sub: EMAIL, exp: Date.now() + 60_000 });
  assert.equal(verifyAdminSession(token, CONFIG).party, 'bride');
});

test('rejects a validly signed token whose party is unrecognised', () => {
  const token = signClaims({
    sub: EMAIL,
    party: '[object Object]',
    exp: Date.now() + 60_000,
  });
  assert.equal(verifyAdminSession(token, CONFIG), null);
});
