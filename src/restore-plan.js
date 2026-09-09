/**
 * Pure planning logic for a JSON-backup restore.
 *
 * Kept separate from `scripts/restore-db.js` so the parts that are easy to get
 * wrong — insert ordering across foreign keys, sequence resets, and the guard
 * that stops a restore landing on the live database — are testable without a
 * Postgres server. The script is the thin shell that runs this plan.
 */

/**
 * Orders tables so a parent is always inserted before anything referencing it.
 *
 * Derived from the target's catalog rather than a hardcoded list: the same drift
 * the backup script avoids by discovering tables from the catalog applies here,
 * and a hardcoded order silently rots the moment a migration adds a foreign key.
 *
 * Self-references are excluded from ordering — no table order can satisfy them,
 * so they are reported for the caller to handle rather than being treated as a
 * cycle. Genuine cycles between distinct tables throw, because a plain restore
 * cannot satisfy them without deferrable constraints.
 */
export function topologicalTableOrder(tables, edges = []) {
  const names = [...tables].sort();
  const known = new Set(names);
  const selfReferencing = [];

  const dependsOn = new Map(names.map((name) => [name, new Set()]));

  for (const edge of edges) {
    const { table, referencesTable } = edge;
    if (!known.has(table) || !known.has(referencesTable)) continue;
    if (table === referencesTable) {
      if (!selfReferencing.includes(table)) selfReferencing.push(table);
      continue;
    }
    dependsOn.get(table).add(referencesTable);
  }

  const order = [];
  const placed = new Set();

  while (order.length < names.length) {
    const ready = names.filter(
      (name) => !placed.has(name) && [...dependsOn.get(name)].every((dep) => placed.has(dep))
    );

    if (ready.length === 0) {
      const stuck = names.filter((name) => !placed.has(name));
      throw new Error(
        `Cannot order tables for restore — foreign keys form a cycle between: ${stuck.join(', ')}`
      );
    }

    for (const name of ready) {
      order.push(name);
      placed.add(name);
    }
  }

  return { order, selfReferencing: selfReferencing.sort() };
}

/**
 * Advances each serial/identity sequence past the highest restored id.
 *
 * Without this the table looks correct and the next insert collides with a
 * restored row — a failure that shows up later, after the restore is believed
 * to have succeeded.
 */
export function buildSequenceResetStatements(sequenceColumns = []) {
  return sequenceColumns
    .filter(({ table, column }) => table && column)
    .map(({ table, column }) => ({
      table,
      column,
      sql:
        `SELECT setval(` +
        `pg_get_serial_sequence('"${table}"', '${column}'), ` +
        `COALESCE((SELECT MAX("${column}") FROM "${table}"), 0) + 1, ` +
        `false)`,
    }));
}

/**
 * Decides whether a restore may proceed against the given target.
 *
 * The invariant: this never reads DATABASE_URL. A restore has to be aimed
 * deliberately at RESTORE_TARGET_URL, so merely having .env loaded can never
 * overwrite the database the application uses. Pointing the two at the same
 * place is possible but has to be stated explicitly, and is HITL-gated per
 * HITL.md.
 */
export function checkRestoreTarget({ targetUrl, appUrl, force = false } = {}) {
  const target = (targetUrl || '').trim();
  const app = (appUrl || '').trim();

  if (!target) {
    return {
      allowed: false,
      reason:
        'RESTORE_TARGET_URL is not set. A restore must name its target explicitly — it deliberately does not fall back to DATABASE_URL.',
    };
  }

  if (app && target === app && !force) {
    return {
      allowed: false,
      reason:
        'RESTORE_TARGET_URL is the same database the app uses (DATABASE_URL). This would overwrite live data. Re-run with --overwrite-app-database if that is genuinely intended — HITL.md requires explicit human confirmation first.',
    };
  }

  return {
    allowed: true,
    overwritesAppDatabase: Boolean(app && target === app),
  };
}

/** Rejects a malformed or truncated backup before any of it reaches a database. */
export function validateBackupShape(parsed) {
  const problems = [];

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, problems: ['Backup is not a JSON object.'] };
  }
  if (!parsed.data || typeof parsed.data !== 'object') {
    problems.push('Backup has no `data` object.');
  }
  if (!parsed.takenAt) {
    problems.push('Backup has no `takenAt` timestamp.');
  }

  if (parsed.data && parsed.tables) {
    for (const [table, claimed] of Object.entries(parsed.tables)) {
      const actual = Array.isArray(parsed.data[table]) ? parsed.data[table].length : null;
      if (actual === null) {
        problems.push(`Header lists "${table}" but data has no rows array for it.`);
      } else if (actual !== claimed) {
        problems.push(`"${table}": header claims ${claimed} row(s), data has ${actual}.`);
      }
    }
  }

  return { valid: problems.length === 0, problems };
}
