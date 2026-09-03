import test from 'node:test';
import assert from 'node:assert/strict';

import { hashAdminPassword, verifyAdminCredentials } from '../src/admin/adminAuth.js';

const PASSWORD = 'correct horse battery staple';
const CONFIG = {
  adminEmail: 'admin@example.com',
  passwordHash: hashAdminPassword(PASSWORD),
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

test('accepts the correct email and password', () => {
  const result = verifyAdminCredentials('admin@example.com', PASSWORD, CONFIG);
  assert.equal(result.success, true);
});

test('accepts the email case-insensitively and ignores surrounding whitespace', () => {
  const result = verifyAdminCredentials('  ADMIN@Example.COM  ', PASSWORD, CONFIG);
  assert.equal(result.success, true);
});

test('rejects a wrong password', () => {
  const result = verifyAdminCredentials('admin@example.com', 'wrong-password', CONFIG);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invalid_credentials');
});

test('rejects an unknown email', () => {
  const result = verifyAdminCredentials('someone@else.com', PASSWORD, CONFIG);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invalid_credentials');
});

test('does not reveal whether the email or the password was wrong', () => {
  const badEmail = verifyAdminCredentials('someone@else.com', PASSWORD, CONFIG);
  const badPassword = verifyAdminCredentials('admin@example.com', 'nope', CONFIG);
  assert.equal(badEmail.reason, badPassword.reason);
});

test('rejects missing credentials without throwing', () => {
  assert.equal(verifyAdminCredentials('', PASSWORD, CONFIG).success, false);
  assert.equal(verifyAdminCredentials('admin@example.com', '', CONFIG).success, false);
  assert.equal(verifyAdminCredentials(null, null, CONFIG).success, false);
});

test('reports when the admin account is not configured', () => {
  const result = verifyAdminCredentials('admin@example.com', PASSWORD, {
    adminEmail: '',
    passwordHash: '',
  });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'admin_not_configured');
});

test('rejects a malformed stored hash instead of crashing', () => {
  const result = verifyAdminCredentials('admin@example.com', PASSWORD, {
    adminEmail: 'admin@example.com',
    passwordHash: 'not-a-valid-hash',
  });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'admin_not_configured');
});
