import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAdminSession,
  verifyAdminSession,
} from '../src/admin/adminSession.js';

const CONFIG = { secret: 'test-secret-value', ttlMs: 60_000 };
const EMAIL = 'admin@example.com';

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
