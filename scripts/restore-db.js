import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {
  topologicalTableOrder,
  buildSequenceResetStatements,
  checkRestoreTarget,
  validateBackupShape,
} from '../src/restore-plan.js';

/**
 * Restores a `npm run backup` JSON file into a database.
 *
 * Deliberately does NOT use src/db.js: that pool is bound to DATABASE_URL, and a
 * restore must never be able to reach the app's own database just because .env
 * happened to be loaded. The target is named separately via RESTORE_TARGET_URL.
 *
 *   npm run restore:dry-run    connect, plan, change nothing
 *   npm run restore            perform the restore (empty target required)
 *
 * Flags: --file <path>  --replace  --overwrite-app-database
 */

const backupsDir = path.resolve('backups');

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    replace: argv.includes('--replace'),
    force: argv.includes('--overwrite-app-database'),
    file: argv.includes('--file') ? argv[argv.indexOf('--file') + 1] : null,
  };
}

function newestBackupFile() {
  if (!fs.existsSync(backupsDir)) return null;
  const files = fs
    .readdirSync(backupsDir)
    .filter((name) => name.startsWith('backup-') && name.endsWith('.json'))
    .sort();
  return files.length > 0 ? path.join(backupsDir, files[files.length - 1]) : null;
}

async function describeTarget(client) {
  const { rows: tableRows } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );

  const { rows: fkRows } = await client.query(
    `SELECT tc.table_name AS child, ccu.table_name AS parent
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`
  );

  const { rows: seqRows } = await client.query(
    `SELECT table_name AS tbl, column_name AS col
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_default LIKE 'nextval(%'`
  );

  return {
    tables: tableRows.map((r) => r.table_name),
    edges: fkRows.map((r) => ({ table: r.child, referencesTable: r.parent })),
    sequenceColumns: seqRows.map((r) => ({ table: r.tbl, column: r.col })),
  };
}

async function currentCounts(client, tables) {
  const counts = {};
  for (const table of tables) {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    counts[table] = rows[0].n;
  }
  return counts;
}

function compareMigrations(backup, targetMigrations) {
  const inBackup = (backup.data.schema_migrations || []).map((r) => r.filename).sort();
  const inTarget = [...targetMigrations].sort();
  return {
    missing: inBackup.filter((m) => !inTarget.includes(m)),
    extra: inTarget.filter((m) => !inBackup.includes(m)),
  };
}

async function insertRows(client, table, rows) {
  for (const row of rows) {
    const columns = Object.keys(row);
    if (columns.length === 0) continue;
    const placeholders = columns.map((_, i) => '$' + (i + 1)).join(', ');
    const quoted = columns.map((c) => `"${c}"`).join(', ');
    await client.query(
      `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders})`,
      columns.map((c) => row[c])
    );
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  // A dry run cannot write — it returns before BEGIN and issues only SELECTs — so
  // it is allowed to inspect the app's own database without the overwrite flag.
  // Requiring that flag for a read-only check would only teach the habit of typing it.
  const guard = checkRestoreTarget({
    targetUrl: process.env.RESTORE_TARGET_URL,
    appUrl: process.env.DATABASE_URL,
    force: args.force || args.dryRun,
  });

  if (!guard.allowed) {
    console.error(`Refusing to restore.\n\n${guard.reason}`);
    process.exit(1);
  }

  if (guard.overwritesAppDatabase) {
    console.warn(
      args.dryRun
        ? '\nNote: inspecting the database the application uses. This is a dry run — it issues only SELECTs and writes nothing.\n'
        : '\n*** This restore targets the database the application uses. ***\n' +
            'HITL.md requires explicit human confirmation for this. Proceeding because --overwrite-app-database was passed.\n'
    );
  }

  const file = args.file || newestBackupFile();
  if (!file || !fs.existsSync(file)) {
    console.error('No backup file found. Run `npm run backup` first, or pass --file <path>.');
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const shape = validateBackupShape(parsed);
  if (!shape.valid) {
    console.error(`Backup at ${file} is not usable:\n  - ${shape.problems.join('\n  - ')}`);
    process.exit(1);
  }

  console.log(`Backup:  ${file}`);
  console.log(`Taken:   ${parsed.takenAt}`);
  console.log(`Mode:    ${args.dryRun ? 'DRY RUN — nothing will be written' : 'RESTORE'}\n`);

  const pool = new pg.Pool({ connectionString: process.env.RESTORE_TARGET_URL });
  const client = await pool.connect();

  try {
    const target = await describeTarget(client);

    if (target.tables.length === 0) {
      console.error(
        'The target database has no tables. Run `npm run migrate` against it first — a backup carries rows, not schema.'
      );
      process.exit(1);
    }

    const restorable = Object.keys(parsed.data).filter((t) => target.tables.includes(t));
    const missingInTarget = Object.keys(parsed.data).filter((t) => !target.tables.includes(t));

    const { order, selfReferencing } = topologicalTableOrder(restorable, target.edges);

    const targetMigrations = target.tables.includes('schema_migrations')
      ? (await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename)
      : [];
    const migrations = compareMigrations(parsed, targetMigrations);

    const before = await currentCounts(client, restorable);
    const nonEmpty = restorable.filter((t) => before[t] > 0);

    console.log('Restore order (parents first):');
    console.log(`  ${order.join(' -> ')}\n`);

    if (missingInTarget.length > 0) {
      console.warn(`Tables in the backup but not in the target (skipped): ${missingInTarget.join(', ')}`);
    }
    if (selfReferencing.length > 0) {
      console.warn(`Self-referencing tables — row order within them may matter: ${selfReferencing.join(', ')}`);
    }
    if (migrations.missing.length > 0) {
      console.warn(
        `\nWARNING: the target is missing migrations the backup expects: ${migrations.missing.join(', ')}\n` +
          '         Run `npm run migrate` against the target before restoring.'
      );
    }
    if (migrations.extra.length > 0) {
      console.warn(`\nNote: the target has migrations the backup predates: ${migrations.extra.join(', ')}`);
    }
    if (nonEmpty.length > 0) {
      console.warn(
        `\nTarget is not empty: ${nonEmpty.map((t) => `${t}=${before[t]}`).join(', ')}` +
          (args.replace ? '\n  --replace given: these will be TRUNCATEd first.' : '')
      );
      if (!args.replace && !args.dryRun) {
        console.error('\nRefusing to restore into a non-empty database. Re-run with --replace to clear it first.');
        process.exit(1);
      }
    }

    if (args.dryRun) {
      const planned = order.reduce((sum, t) => sum + parsed.data[t].length, 0);
      console.log(`\nWould insert ${planned} row(s) across ${order.length} table(s).`);
      console.log(`Would reset ${buildSequenceResetStatements(target.sequenceColumns).length} sequence(s).`);
      console.log('\nDry run complete. Nothing was written.');
      return;
    }

    await client.query('BEGIN');

    if (args.replace && nonEmpty.length > 0) {
      for (const table of [...order].reverse()) {
        await client.query(`TRUNCATE TABLE "${table}" CASCADE`);
      }
    }

    for (const table of order) {
      await insertRows(client, table, parsed.data[table]);
    }

    const sequenceStatements = buildSequenceResetStatements(
      target.sequenceColumns.filter((s) => order.includes(s.table))
    );
    for (const { sql } of sequenceStatements) {
      await client.query(sql);
    }

    await client.query('COMMIT');

    const after = await currentCounts(client, restorable);
    let mismatch = false;
    console.log('Restored:');
    for (const table of order) {
      const expected = parsed.data[table].length;
      const actual = after[table];
      const ok = expected === actual;
      if (!ok) mismatch = true;
      console.log(`  ${table}: ${actual} row(s)${ok ? '' : ` — MISMATCH, backup had ${expected}`}`);
    }
    console.log(`\nReset ${sequenceStatements.length} sequence(s).`);

    if (mismatch) {
      console.error('\nRow counts do not match the backup. Do not treat this restore as successful.');
      process.exitCode = 1;
    } else {
      console.log('\nRestore complete — every table matches the backup.');
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK');
      console.error('\nRolled back — the target was left unchanged.');
    } catch {
      // Connection already unusable; the original error is the useful one.
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
