import test from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, verifyPassword } from '../src/admin-auth/hashPassword.js';
import { verifyAdminCredentials } from '../src/admin-auth/verifyAdminCredentials.js';

test('verifyPassword accepts the correct password for a stored hash', () => {
  const hash = hashPassword('correct-horse-battery-staple');
  assert.equal(verifyPassword('correct-horse-battery-staple', hash), true);
});

test('verifyPassword rejects an incorrect password', () => {
  const hash = hashPassword('correct-horse-battery-staple');
  assert.equal(verifyPassword('wrong-password', hash), false);
});

test('verifyAdminCredentials succeeds for matching email and password', () => {
  const adminRecord = { id: 'admin-1', email: 'admin@example.com', passwordHash: hashPassword('secret123') };
  const result = verifyAdminCredentials('admin@example.com', 'secret123', adminRecord);
  assert.equal(result.success, true);
  assert.equal(result.adminId, 'admin-1');
});

test('verifyAdminCredentials is case-insensitive on email', () => {
  const adminRecord = { id: 'admin-1', email: 'admin@example.com', passwordHash: hashPassword('secret123') };
  const result = verifyAdminCredentials('Admin@Example.com', 'secret123', adminRecord);
  assert.equal(result.success, true);
});

test('verifyAdminCredentials rejects wrong password', () => {
  const adminRecord = { id: 'admin-1', email: 'admin@example.com', passwordHash: hashPassword('secret123') };
  const result = verifyAdminCredentials('admin@example.com', 'nope', adminRecord);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invalid_credentials');
});

test('verifyAdminCredentials rejects missing credentials', () => {
  const result = verifyAdminCredentials('', '', { id: 'admin-1', email: 'a@b.com', passwordHash: hashPassword('x') });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'missing_credentials');
});
