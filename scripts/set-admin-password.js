#!/usr/bin/env node
/**
 * Generates an ADMIN_PASSWORD_HASH value for .env.
 *
 * Usage:
 *   echo "your-password" | node scripts/set-admin-password.js
 *
 * This script deliberately only PRINTS the hash. Writing it into .env is a
 * secrets change, which HITL.md reserves for a human.
 */
import { hashAdminPassword } from '../src/admin/adminAuth.js';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

const password = await readStdin();

if (!password) {
  console.error('No password received on stdin.');
  console.error('Usage: echo "your-password" | node scripts/set-admin-password.js');
  process.exit(1);
}

if (password.length < 12) {
  console.error(`Password is ${password.length} characters; use at least 12.`);
  process.exit(1);
}

console.log('\nAdd (or replace) this line in your .env file:\n');
console.log(`ADMIN_PASSWORD_HASH=${hashAdminPassword(password)}`);
console.log('\nAlso make sure ADMIN_EMAIL and SESSION_SECRET are set.\n');
