import test from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword } from '../src/admin-auth/hashPassword.js';
import { verifyAdminCredentials } from '../src/admin-auth/verifyAdminCredentials.js';

/**
 * Covers the legacy Express prototype's admin credential check
 * (src/server.js only — the Next.js app uses src/admin/adminAuth.js).
 *
 * This module had no direct unit tests until Next Action 28, which is part of
 * why the timing side-channel below survived as long as it did.
 */

const PASSWORD = 'legacy-admin-test-password';
const ADMIN = {
  id: 'admin-1',
  email: 'admin@test.invalid',
  passwordHash: hashPassword(PASSWORD),
};

test('accepts the configured admin and returns their id', () => {
  const result = verifyAdminCredentials(ADMIN.email, PASSWORD, ADMIN);
  assert.equal(result.success, true);
  assert.equal(result.adminId, 'admin-1');
});

test('matches the email case-insensitively and ignores surrounding space', () => {
  const result = verifyAdminCredentials('  ADMIN@Test.INVALID  ', PASSWORD, ADMIN);
  assert.equal(result.success, true);
});

test('rejects a wrong password', () => {
  const result = verifyAdminCredentials(ADMIN.email, 'nope', ADMIN);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invalid_credentials');
});

test('rejects an unknown email with no record', () => {
  const result = verifyAdminCredentials('someone@else.invalid', PASSWORD, null);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invalid_credentials');
});

test('gives a wrong email and a wrong password the same reason and message', () => {
  const badEmail = verifyAdminCredentials('someone@else.invalid', PASSWORD, ADMIN);
  const badPassword = verifyAdminCredentials(ADMIN.email, 'nope', ADMIN);

  assert.deepEqual(badEmail, badPassword);
});

test('rejects missing credentials without reaching the password check', () => {
  assert.equal(verifyAdminCredentials('', PASSWORD, ADMIN).reason, 'missing_credentials');
  assert.equal(verifyAdminCredentials(ADMIN.email, '', ADMIN).reason, 'missing_credentials');
  assert.equal(verifyAdminCredentials(null, null, ADMIN).reason, 'missing_credentials');
});

/**
 * Before Next Action 28 this module returned the moment the email failed to
 * match, so it never ran scrypt — an unknown email answered in microseconds
 * while a known one cost tens of milliseconds, which tells an attacker which
 * admin address is real.
 *
 * The tolerance is deliberately wide (an unknown email must cost at least a
 * quarter of a known one). The bug being guarded against is a ~100x gap, not a
 * 2x one, so this catches a regression without being timing-flaky.
 */
test('spends comparable time on an unknown email as on a wrong password', () => {
  const RUNS = 8;

  function timeOf(email, record) {
    const started = process.hrtime.bigint();
    for (let i = 0; i < RUNS; i += 1) {
      verifyAdminCredentials(email, 'some-password-attempt', record);
    }
    return Number(process.hrtime.bigint() - started);
  }

  // Warm up, so first-call JIT/allocation costs don't land inside a measurement.
  timeOf(ADMIN.email, ADMIN);

  const knownEmail = timeOf(ADMIN.email, ADMIN);
  const unknownEmail = timeOf('nobody@else.invalid', null);

  assert.ok(
    unknownEmail > knownEmail / 4,
    `unknown-email path returned far too fast (${unknownEmail}ns vs ${knownEmail}ns) — the KDF is being skipped again`
  );
});
