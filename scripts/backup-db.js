import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { query, closePool } from '../src/db.js';

/**
 * Logical backup of every table, written as JSON.
 *
 * Deliberately not `pg_dump`: that binary is not installed on this project's dev
 * machine, and a backup you cannot actually run is worse than none. This uses the
 * `pg` driver the app already depends on, so it works anywhere `npm test` does.
 * The trade-off is that it captures rows, not schema — `migrations/` is the schema
 * of record, and a restore replays migrations first (see docs/BACKUP_RECOVERY.md).
 *
 * Tables are discovered from the catalog rather than listed here, so a future
 * migration cannot silently leave its table out of the backup.
 *
 *   npm run backup            write a new backup
 *   npm run backup:verify     report what is inside the newest backup
 */

const backupsDir = path.resolve('backups');

async function listTables() {
  const { rows } = await query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );
  return rows.map((row) => row.table_name);
}

async function backup() {
  const tables = await listTables();
  if (tables.length === 0) {
    throw new Error('No tables found — is DATABASE_URL pointing at the right database?');
  }

  const data = {};
  const counts = {};

  for (const table of tables) {
    // Identifiers cannot be parameterised, so this is quoted instead. The names
    // come from the catalog, not from user input.
    const { rows } = await query(`SELECT * FROM "${table}"`);
    data[table] = rows;
    counts[table] = rows.length;
  }

  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(backupsDir, `backup-${stamp}.json`);

  fs.writeFileSync(
    file,
    JSON.stringify({ takenAt: new Date().toISOString(), tables: counts, data }, null, 2)
  );

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  console.log(`Wrote ${file}`);
  for (const table of tables) {
    console.log(`  ${table}: ${counts[table]} row(s)`);
  }
  console.log(`${total} row(s) across ${tables.length} table(s).`);

  if ((counts.guests ?? 0) === 0) {
    console.warn('\nWARNING: the guests table is empty. That is expected on a fresh database and alarming on a live one.');
  }
}

function newestBackupFile() {
  if (!fs.existsSync(backupsDir)) return null;
  const files = fs
    .readdirSync(backupsDir)
    .filter((name) => name.startsWith('backup-') && name.endsWith('.json'))
    .sort();
  return files.length > 0 ? path.join(backupsDir, files[files.length - 1]) : null;
}

/**
 * Reads the newest backup back off disk and reports it. A backup nobody has ever
 * opened is a guess, not a backup — this is the cheap half of that check, and
 * docs/BACKUP_RECOVERY.md covers the full restore rehearsal.
 */
function verify() {
  const file = newestBackupFile();
  if (!file) {
    console.error(`No backups found in ${backupsDir}. Run \`npm run backup\` first.`);
    process.exitCode = 1;
    return;
  }

  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const tables = Object.keys(parsed.data || {});

  console.log(`${file}`);
  console.log(`Taken at: ${parsed.takenAt}`);
  for (const table of tables) {
    const actual = parsed.data[table].length;
    const claimed = parsed.tables?.[table];
    const agrees = claimed === undefined || claimed === actual;
    console.log(`  ${table}: ${actual} row(s)${agrees ? '' : ` — MISMATCH, header claims ${claimed}`}`);
  }

  const guests = parsed.data.guests?.length ?? 0;
  console.log(guests > 0 ? `\nGuest list present (${guests} guest(s)).` : '\nWARNING: this backup contains no guests.');
}

async function run() {
  const mode = process.argv[2] === 'verify' ? 'verify' : 'backup';

  if (mode === 'verify') {
    verify();
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required to take a backup.');
    process.exit(1);
  }

  await backup();
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    if (process.argv[2] !== 'verify') return closePool();
  });
