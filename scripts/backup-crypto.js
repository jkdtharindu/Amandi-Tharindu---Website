import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { encryptBuffer, decryptBuffer, isEncryptedBackup } from '../src/backup-crypto.js';

/**
 * Encrypts and decrypts backup files so they can be stored off this machine.
 *
 *   npm run backup:encrypt     encrypt the newest backup
 *   npm run backup:decrypt     decrypt a .enc file back to JSON
 *
 * The passphrase comes from BACKUP_PASSPHRASE. Keep it somewhere retrievable
 * that is NOT the folder holding the backups — a passphrase stored beside the
 * ciphertext protects nothing.
 *
 * Flags: --file <path>  --remove-plaintext
 */

const backupsDir = path.resolve('backups');

function newestFile(predicate) {
  if (!fs.existsSync(backupsDir)) return null;
  const files = fs
    .readdirSync(backupsDir)
    .filter((name) => name.startsWith('backup-') && predicate(name))
    .sort();
  return files.length > 0 ? path.join(backupsDir, files[files.length - 1]) : null;
}

function passphrase() {
  const value = process.env.BACKUP_PASSPHRASE;
  if (!value) {
    console.error(
      'BACKUP_PASSPHRASE is not set.\n\n' +
        'Choose a long passphrase, store it somewhere you can reach without this laptop\n' +
        '(a password manager, not the backups folder), then set it in .env.\n\n' +
        'If you lose it, the encrypted backups are unrecoverable — that is the point.'
    );
    process.exit(1);
  }
  return value;
}

function encrypt(args) {
  const source = args.file || newestFile((n) => n.endsWith('.json'));
  if (!source || !fs.existsSync(source)) {
    console.error('No plaintext backup found. Run `npm run backup` first, or pass --file <path>.');
    process.exit(1);
  }

  const plaintext = fs.readFileSync(source);
  if (isEncryptedBackup(plaintext)) {
    console.error(`${source} is already encrypted.`);
    process.exit(1);
  }

  const target = `${source}.enc`;
  const encrypted = encryptBuffer(plaintext, passphrase());
  fs.writeFileSync(target, encrypted);

  // Verify before considering the original expendable. An encrypted file that
  // does not decrypt is indistinguishable from one that does until you need it.
  const roundTripped = decryptBuffer(fs.readFileSync(target), passphrase());
  if (!roundTripped.equals(plaintext)) {
    fs.unlinkSync(target);
    console.error('Encrypted file did not decrypt back to the original. Nothing was kept.');
    process.exit(1);
  }

  console.log(`Wrote ${target}`);
  console.log(`Verified: decrypts back to ${plaintext.length} identical byte(s).`);

  if (args.removePlaintext) {
    fs.unlinkSync(source);
    console.log(`Removed plaintext ${source}`);
  } else {
    console.log(`\nPlaintext still on disk at ${source}`);
    console.log('Pass --remove-plaintext to delete it once you have stored the .enc file safely.');
  }

  console.log('\nThe .enc file is safe to put in cloud storage. The passphrase is not — keep it elsewhere.');
}

function decrypt(args) {
  const source = args.file || newestFile((n) => n.endsWith('.enc'));
  if (!source || !fs.existsSync(source)) {
    console.error('No encrypted backup found. Pass --file <path>.');
    process.exit(1);
  }

  const plaintext = decryptBuffer(fs.readFileSync(source), passphrase());
  const target = source.replace(/\.enc$/, '');

  if (fs.existsSync(target)) {
    console.error(`Refusing to overwrite ${target}. Move it aside first.`);
    process.exit(1);
  }

  fs.writeFileSync(target, plaintext);
  console.log(`Wrote ${target} (${plaintext.length} bytes)`);
  console.log('This file contains guest names, phone numbers and email addresses. Delete it when done.');
}

function run() {
  const argv = process.argv.slice(2);
  const args = {
    file: argv.includes('--file') ? argv[argv.indexOf('--file') + 1] : null,
    removePlaintext: argv.includes('--remove-plaintext'),
  };

  if (argv[0] === 'decrypt') {
    decrypt(args);
    return;
  }
  encrypt(args);
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
