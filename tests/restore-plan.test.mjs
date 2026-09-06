import test from 'node:test';
import assert from 'node:assert/strict';
import {
  topologicalTableOrder,
  buildSequenceResetStatements,
  checkRestoreTarget,
  validateBackupShape,
} from '../src/restore-plan.js';

// The real foreign-key shape of this project's schema as of migration 010.
const TABLES = [
  'admin_users', 'celebration_events', 'guests', 'message_logs', 'message_templates',
  'probable_attendees', 'rsvp_responses', 'schema_migrations', 'seating_tables',
  'site_sections', 'table_seats', 'theme_settings',
];

const EDGES = [
  { table: 'rsvp_responses', referencesTable: 'guests' },
  { table: 'message_logs', referencesTable: 'guests' },
  { table: 'table_seats', referencesTable: 'guests' },
  { table: 'table_seats', referencesTable: 'seating_tables' },
  { table: 'table_seats', referencesTable: 'probable_attendees' },
];

function positionOf(order, table) {
  return order.indexOf(table);
}

test('orders every parent before the tables that reference it', () => {
  const { order } = topologicalTableOrder(TABLES, EDGES);

  for (const { table, referencesTable } of EDGES) {
    assert.ok(
      positionOf(order, referencesTable) < positionOf(order, table),
      `${referencesTable} must be restored before ${table}`
    );
  }
});

test('includes every table exactly once', () => {
  const { order } = topologicalTableOrder(TABLES, EDGES);
  assert.equal(order.length, TABLES.length);
  assert.deepEqual([...order].sort(), [...TABLES].sort());
});

test('produces a deterministic order for the same input', () => {
  const a = topologicalTableOrder(TABLES, EDGES).order;
  const b = topologicalTableOrder([...TABLES].reverse(), EDGES).order;
  assert.deepEqual(a, b, 'order must not depend on input ordering');
});

test('ignores foreign keys pointing at tables not in the backup', () => {
  const { order } = topologicalTableOrder(['guests'], [
    { table: 'guests', referencesTable: 'a_table_not_being_restored' },
  ]);
  assert.deepEqual(order, ['guests']);
});

test('reports a self-referencing table instead of calling it a cycle', () => {
  const { order, selfReferencing } = topologicalTableOrder(
    ['guests', 'categories'],
    [{ table: 'categories', referencesTable: 'categories' }]
  );
  assert.deepEqual(selfReferencing, ['categories']);
  assert.equal(order.length, 2);
});

test('throws and names the tables when foreign keys form a real cycle', () => {
  assert.throws(
    () =>
      topologicalTableOrder(
        ['a', 'b'],
        [
          { table: 'a', referencesTable: 'b' },
          { table: 'b', referencesTable: 'a' },
        ]
      ),
    /cycle between: a, b/
  );
});

test('builds a setval statement that advances past the highest restored id', () => {
  const [stmt] = buildSequenceResetStatements([{ table: 'guests', column: 'id' }]);
  assert.match(stmt.sql, /setval/);
  assert.match(stmt.sql, /pg_get_serial_sequence\('"guests"', 'id'\)/);
  assert.match(stmt.sql, /MAX\("id"\) FROM "guests"/);
  assert.match(stmt.sql, /\+ 1/, 'must advance past the max, not sit on it');
});

test('skips sequence entries missing a table or column', () => {
  const stmts = buildSequenceResetStatements([
    { table: 'guests', column: 'id' },
    { table: 'guests' },
    { column: 'id' },
  ]);
  assert.equal(stmts.length, 1);
});

test('refuses to restore when no target is named', () => {
  const result = checkRestoreTarget({ targetUrl: '', appUrl: 'postgres://live/db' });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /RESTORE_TARGET_URL is not set/);
});

test('refuses when the target is the database the app itself uses', () => {
  const url = 'postgres://user:pw@host/live';
  const result = checkRestoreTarget({ targetUrl: url, appUrl: url });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /overwrite live data/);
});

test('a trailing newline cannot slip past the live-database guard', () => {
  const url = 'postgres://user:pw@host/live';
  const result = checkRestoreTarget({ targetUrl: `${url}\n`, appUrl: url });
  assert.equal(result.allowed, false, 'whitespace must not defeat the comparison');
});

test('allows overwriting the app database only when explicitly forced', () => {
  const url = 'postgres://user:pw@host/live';
  const result = checkRestoreTarget({ targetUrl: url, appUrl: url, force: true });
  assert.equal(result.allowed, true);
  assert.equal(result.overwritesAppDatabase, true, 'caller must still be told what this is');
});

test('allows a scratch target that differs from the app database', () => {
  const result = checkRestoreTarget({
    targetUrl: 'postgres://user:pw@host/scratch',
    appUrl: 'postgres://user:pw@host/live',
  });
  assert.equal(result.allowed, true);
  assert.equal(result.overwritesAppDatabase, false);
});

test('accepts a well-formed backup', () => {
  const result = validateBackupShape({
    takenAt: '2026-09-06T09:40:05.581Z',
    tables: { guests: 2 },
    data: { guests: [{ id: 1 }, { id: 2 }] },
  });
  assert.equal(result.valid, true, result.problems.join('; '));
});

test('catches a backup whose header disagrees with its data', () => {
  const result = validateBackupShape({
    takenAt: '2026-09-06T09:40:05.581Z',
    tables: { guests: 6 },
    data: { guests: [{ id: 1 }] },
  });
  assert.equal(result.valid, false);
  assert.match(result.problems.join(' '), /header claims 6 row\(s\), data has 1/);
});

test('rejects a backup with no data object', () => {
  const result = validateBackupShape({ takenAt: '2026-09-06T09:40:05.581Z' });
  assert.equal(result.valid, false);
  assert.match(result.problems.join(' '), /no `data` object/);
});
