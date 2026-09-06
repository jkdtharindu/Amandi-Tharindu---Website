import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptBuffer, decryptBuffer, isEncryptedBackup } from '../src/backup-crypto.js';

const PASSPHRASE = 'correct horse battery staple';
const PLAINTEXT = Buffer.from(
  JSON.stringify({ takenAt: '2026-09-06T09:40:05.581Z', tables: { guests: 1 }, data: { guests: [{ id: 1, name: 'Test Guest' }] } })
);

test('round-trips a backup unchanged', () => {
  const restored = decryptBuffer(encryptBuffer(PLAINTEXT, PASSPHRASE), PASSPHRASE);
  assert.deepEqual(restored, PLAINTEXT);
  assert.equal(JSON.parse(restored).data.guests[0].name, 'Test Guest');
});

test('the wrong passphrase fails loudly instead of returning garbage', () => {
  const encrypted = encryptBuffer(PLAINTEXT, PASSPHRASE);
  assert.throws(
    () => decryptBuffer(encrypted, 'a different passphrase'),
    /wrong passphrase, or the file has been altered/
  );
});

test('an edited ciphertext is detected, not silently accepted', () => {
  const encrypted = encryptBuffer(PLAINTEXT, PASSPHRASE);
  encrypted[encrypted.length - 1] ^= 0xff;
  assert.throws(() => decryptBuffer(encrypted, PASSPHRASE), /altered or truncated/);
});

test('an edited authentication tag is detected', () => {
  const encrypted = encryptBuffer(PLAINTEXT, PASSPHRASE);
  encrypted[8 + 16 + 12] ^= 0xff; // first byte of the tag
  assert.throws(() => decryptBuffer(encrypted, PASSPHRASE), /altered or truncated/);
});

test('a truncated file is rejected rather than half-decrypted', () => {
  const encrypted = encryptBuffer(PLAINTEXT, PASSPHRASE);
  assert.throws(() => decryptBuffer(encrypted.subarray(0, 20), PASSPHRASE), /too short|altered or truncated/);
});

test('encrypting the same backup twice produces different bytes', () => {
  const a = encryptBuffer(PLAINTEXT, PASSPHRASE);
  const b = encryptBuffer(PLAINTEXT, PASSPHRASE);
  assert.notDeepEqual(a, b, 'a fresh salt and IV must be used each time');
  assert.deepEqual(decryptBuffer(a, PASSPHRASE), decryptBuffer(b, PASSPHRASE));
});

test('the plaintext guest name does not appear in the ciphertext', () => {
  const encrypted = encryptBuffer(PLAINTEXT, PASSPHRASE);
  assert.equal(encrypted.includes(Buffer.from('Test Guest')), false);
});

test('an encrypted backup is recognisable by its header', () => {
  assert.equal(isEncryptedBackup(encryptBuffer(PLAINTEXT, PASSPHRASE)), true);
  assert.equal(isEncryptedBackup(PLAINTEXT), false);
});

test('a plain JSON file gives a clear error rather than a crypto stack trace', () => {
  assert.throws(() => decryptBuffer(PLAINTEXT, PASSPHRASE), /Not an encrypted backup/);
});

test('rejects an empty passphrase', () => {
  assert.throws(() => encryptBuffer(PLAINTEXT, ''), /passphrase is required/);
});

test('rejects a passphrase too short to be worth having', () => {
  assert.throws(() => encryptBuffer(PLAINTEXT, 'short'), /at least 12 characters/);
});
