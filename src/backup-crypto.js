import crypto from 'node:crypto';

/**
 * Passphrase encryption for backup files.
 *
 * Uses only Node's own crypto for the same reason the backup uses the `pg`
 * driver instead of `pg_dump`: a backup you cannot decrypt on the machine in
 * front of you is worse than no backup. `age` and `gpg` are not installed here
 * and would reintroduce exactly the dependency that made `pg_dump` unusable.
 *
 * AES-256-GCM, key derived with scrypt from a random per-file salt. GCM is
 * authenticated, so a truncated or edited file fails loudly on decrypt rather
 * than yielding plausible-looking garbage.
 *
 * Losing the passphrase means losing the backup. It must be stored somewhere
 * retrievable independently of this laptop, and NOT beside the backups — a
 * passphrase in the same folder as the ciphertext protects nothing.
 */

const MAGIC = Buffer.from('WEDBAK1\0', 'utf8'); // 8 bytes, version in the last char
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };

function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, KEY_BYTES, SCRYPT);
}

function requirePassphrase(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new Error('A passphrase is required.');
  }
  if (passphrase.length < 12) {
    throw new Error('Passphrase must be at least 12 characters — this is the only thing protecting every guest\'s contact details.');
  }
}

/** Returns MAGIC | salt | iv | tag | ciphertext. */
export function encryptBuffer(plaintext, passphrase) {
  requirePassphrase(passphrase);

  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([MAGIC, salt, iv, tag, ciphertext]);
}

export function decryptBuffer(payload, passphrase) {
  requirePassphrase(passphrase);

  const headerLength = MAGIC.length + SALT_BYTES + IV_BYTES + TAG_BYTES;
  if (!Buffer.isBuffer(payload) || payload.length < headerLength) {
    throw new Error('Not an encrypted backup — file is too short.');
  }
  if (!payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Not an encrypted backup — missing file header.');
  }

  let offset = MAGIC.length;
  const salt = payload.subarray(offset, (offset += SALT_BYTES));
  const iv = payload.subarray(offset, (offset += IV_BYTES));
  const tag = payload.subarray(offset, (offset += TAG_BYTES));
  const ciphertext = payload.subarray(offset);

  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('Could not decrypt — wrong passphrase, or the file has been altered or truncated.');
  }
}

export function isEncryptedBackup(payload) {
  return (
    Buffer.isBuffer(payload) &&
    payload.length >= MAGIC.length &&
    payload.subarray(0, MAGIC.length).equals(MAGIC)
  );
}
