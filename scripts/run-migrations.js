import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { query, withTransaction, closePool } from '../src/db.js';

const migrationsDir = path.resolve('migrations');

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;

function migrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function appliedMigrations() {
  const { rows } = await query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((row) => row.filename));
}

/**
 * Apply a migration and record it in the same transaction, so the ledger can
 * never claim a migration that did not actually land.
 */
async function applyMigration(file) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  await withTransaction(async (client) => {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
  });
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required to run migrations.');
    process.exit(1);
  }

  await query(LEDGER);
  const applied = await appliedMigrations();

  const pending = migrationFiles().filter((file) => !applied.has(file));

  if (pending.length === 0) {
    console.log(`Database is up to date (${applied.size} migration(s) already applied).`);
    return;
  }

  for (const file of pending) {
    console.log(`Applying migration ${file}`);
    await applyMigration(file);
  }

  console.log(`Migrations completed. Applied ${pending.length} new migration(s).`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
