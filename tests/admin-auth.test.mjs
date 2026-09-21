import test from 'node:test';
import assert from 'node:assert/strict';

import { hashAdminPassword, verifyAdminCredentials } from '../src/admin/adminAuth.js';

const PASSWORD = 'correct horse battery staple';
const BRIDE_PASSWORD = 'bride-password-123';
const GROOM_PASSWORD = 'groom-password-456';

const LEGACY_CONFIG = {
  adminEmail: 'admin@example.com',
  passwordHash: hashAdminPassword(PASSWORD),
};

const BRIDE_GROOM_CONFIG = {
  brideEmail: 'bride@example.com',
  bridePasswordHash: hashAdminPassword(BRIDE_PASSWORD),
  groomEmail: 'groom@example.com',
  groomPasswordHash: hashAdminPassword(GROOM_PASSWORD),
};

test('hashAdminPassword produces a salt:key pair in the stored format', () => {
  const hash = hashAdminPassword('some-password');
  const [salt, key] = hash.split(':');

  assert.equal(hash.split(':').length, 2);
  assert.equal(salt.length, 32, 'salt should be 16 bytes of hex');
  assert.equal(key.length, 128, 'derived key should be 64 bytes of hex');
});

test('hashAdminPassword salts each hash so two hashes of one password differ', () => {
  assert.notEqual(hashAdminPassword(PASSWORD), hashAdminPassword(PASSWORD));
});

// Legacy single-admin tests
test('accepts the correct legacy email and password', () => {
  const result = verifyAdminCredentials('admin@example.com', PASSWORD, LEGACY_CONFIG);
  assert.equal(result.success, true);
  assert.equal(result.party, 'bride', 'legacy account defaults to bride party');
});

test('accepts the email case-insensitively and ignores surrounding whitespace (legacy)', () => {
  const result = verifyAdminCredentials('  ADMIN@Example.COM  ', PASSWORD, LEGACY_CONFIG);
  assert.equal(result.success, true);
});

// Bride/Groom multi-admin tests (2026-09-20)
test('accepts the correct bride email and password', () => {
  const result = verifyAdminCredentials('bride@example.com', BRIDE_PASSWORD, BRIDE_GROOM_CONFIG);
  assert.equal(result.success, true);
  assert.equal(result.party, 'bride');
});

test('accepts the correct groom email and password', () => {
  const result = verifyAdminCredentials('groom@example.com', GROOM_PASSWORD, BRIDE_GROOM_CONFIG);
  assert.equal(result.success, true);
  assert.equal(result.party, 'groom');
});

test('rejects a wrong password (bride)', () => {
  const result = verifyAdminCredentials('bride@example.com', 'wrong-password', BRIDE_GROOM_CONFIG);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invalid_credentials');
});

test('rejects a wrong password (groom)', () => {
  const result = verifyAdminCredentials('groom@example.com', 'wrong-password', BRIDE_GROOM_CONFIG);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invalid_credentials');
});

test('rejects an unknown email', () => {
  const result = verifyAdminCredentials('unknown@example.com', BRIDE_PASSWORD, BRIDE_GROOM_CONFIG);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invalid_credentials');
});

test('does not reveal whether the email or the password was wrong', () => {
  const badEmail = verifyAdminCredentials('unknown@example.com', BRIDE_PASSWORD, BRIDE_GROOM_CONFIG);
  const badPassword = verifyAdminCredentials('bride@example.com', 'nope', BRIDE_GROOM_CONFIG);
  assert.equal(badEmail.reason, badPassword.reason);
});

test('rejects missing credentials without throwing', () => {
  assert.equal(verifyAdminCredentials('', BRIDE_PASSWORD, BRIDE_GROOM_CONFIG).success, false);
  assert.equal(verifyAdminCredentials('bride@example.com', '', BRIDE_GROOM_CONFIG).success, false);
  assert.equal(verifyAdminCredentials(null, null, BRIDE_GROOM_CONFIG).success, false);
});

test('reports when no admin accounts are configured', () => {
  const result = verifyAdminCredentials('anyone@example.com', 'anypassword', {
    brideEmail: '',
    bridePasswordHash: '',
    groomEmail: '',
    groomPasswordHash: '',
    adminEmail: '',
    passwordHash: '',
  });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'admin_not_configured');
});

test('rejects a malformed stored hash instead of crashing (bride)', () => {
  const result = verifyAdminCredentials('bride@example.com', BRIDE_PASSWORD, {
    brideEmail: 'bride@example.com',
    bridePasswordHash: 'not-a-valid-hash',
    groomEmail: '',
    groomPasswordHash: '',
    adminEmail: '',
    passwordHash: '',
  });
  assert.equal(result.success, false);
  // Not admin_not_configured: the account was set up, it just cannot be used.
  // Saying so would hand an unauthenticated caller a 500 describing the
  // server's own state.
  assert.equal(result.reason, 'invalid_credentials');
});

test('one broken account does not lock the other one out', () => {
  const result = verifyAdminCredentials('groom@example.com', GROOM_PASSWORD, {
    ...BRIDE_GROOM_CONFIG,
    bridePasswordHash: 'not-a-valid-hash',
  });
  assert.equal(result.success, true);
  assert.equal(result.party, 'groom');
});

test('reports invalid credentials, not misconfiguration, when every hash is broken', () => {
  const result = verifyAdminCredentials('bride@example.com', BRIDE_PASSWORD, {
    brideEmail: 'bride@example.com',
    bridePasswordHash: 'not-a-valid-hash',
    groomEmail: 'groom@example.com',
    groomPasswordHash: 'also-not-valid',
    adminEmail: '',
    passwordHash: '',
  });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invalid_credentials');
});
