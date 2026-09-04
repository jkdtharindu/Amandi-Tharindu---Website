#!/usr/bin/env node
/**
 * Generates the ADMIN_EMAIL / ADMIN_PASSWORD_HASH pair for `.env`.
 *
 * The application ships with no default admin password, so this is how an admin
 * account comes into existence. Usage:
 *
 *   npm run admin:hash
 *
 * The password is read from stdin rather than argv on purpose: an argument
 * would land in shell history and in the process list, where other users on the
 * machine can read it.
 */
import readline from 'node:readline';
import { hashPassword } from '../src/admin-auth/hashPassword.js';

const MIN_LENGTH = 12;

/**
 * Asks one question. Rejects if stdin closes first — otherwise the callback
 * simply never fires on EOF and the script exits silently having done nothing.
 */
function ask(rl, question) {
  return new Promise((resolve, reject) => {
    const onClose = () => reject(new Error('Input ended early. Run this interactively: npm run admin:hash'));
    rl.once('close', onClose);
    rl.question(question, (answer) => {
      rl.removeListener('close', onClose);
      resolve(answer);
    });
  });
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const email = (await ask(rl, 'Admin email: ')).trim();
    if (!email || !email.includes('@')) {
      console.error('\nA valid email address is required.');
      process.exitCode = 1;
      return;
    }

    const password = await ask(rl, 'Admin password: ');
    if (password.length < MIN_LENGTH) {
      console.error(`\nPassword must be at least ${MIN_LENGTH} characters.`);
      process.exitCode = 1;
      return;
    }

    const confirm = await ask(rl, 'Confirm password: ');
    if (password !== confirm) {
      console.error('\nPasswords did not match.');
      process.exitCode = 1;
      return;
    }

    console.log('\nAdd these two lines to your .env file, then restart the server:\n');
    console.log(`ADMIN_EMAIL=${email}`);
    console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
    console.log('\n.env is gitignored — do not commit these values.');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('\n' + err.message);
  process.exitCode = 1;
});
