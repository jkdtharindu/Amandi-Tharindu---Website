import crypto from 'node:crypto';
import { query, withTransaction } from '../db.js';
import { hallLayoutItems } from '../data/hallLayoutStore.js';
import { createSeatingTable, listSeatingTables } from '../table-arrangement/tableArrangementRepo.js';
import { COMMON } from '../table-arrangement/tableSides.js';
import { MAX_AREAS, TABLE_SIZE, defaultAreas, placeTables } from './hallLayoutShapes.js';

/**
 * The shared hall map: one layout for both admins, either of whom may move
 * anything (owner's decision, 2026-11-26). It only records where things are
 * drawn. Who sits where stays in table_seats and is never touched from here.
 *
 * Nothing here returns a guest's name: both sides' tables are listed with their
 * number, name and side only, and the screen adds the names it is already allowed
 * to see (own side and Common).
 */

const useDb = Boolean(process.env.DATABASE_URL);

// Postgres: the table does not exist (migration 041 not run yet).
const UNDEFINED_TABLE = '42P01';
// Postgres: a malformed uuid, or a position for a table that was just deleted.
const NO_SUCH_ROW = new Set(['22P02', '23503']);

const TOO_MANY_AREAS = `The hall map holds at most ${MAX_AREAS} areas. Remove one first.`;

export function isHallLayoutError(error) {
  return error?.message === TOO_MANY_AREAS;
}

/** True when the database has no hall_layout_items table yet. */
export function isHallLayoutMissing(error) {
  return error?.code === UNDEFINED_TABLE;
}

const COLUMNS = 'id, shape, seating_table_id AS "tableId", label, x, y, width, height, rotation, color';

const toArea = ({ id, shape, label, x, y, width, height, rotation, color }) => ({
  id, shape, label, x, y, width, height, rotation, color,
});

async function readRows(run) {
  if (!run) return hallLayoutItems.map((row) => ({ ...row }));
  const { rows } = await run(`SELECT ${COLUMNS} FROM hall_layout_items ORDER BY created_at, id`);
  return rows;
}

/** Every seating table, reduced to what the map may show to either admin. */
async function listTableMarkers() {
  const tables = await listSeatingTables();
  return tables.map((table) => ({
    id: table.id,
    number: table.table_number,
    name: table.table_name,
    side: table.side,
  }));
}

/**
 * The map as the screen draws it. `hasLayout` is false until the admin has
 * entered a number of tables for the first time; the screen shows no map before
 * that. A table added since then is placed automatically (saved once moved).
 * `available` is false when migration 041 has not been run.
 */
export async function loadHallLayout() {
  let rows;
  try {
    rows = await readRows(useDb ? query : null);
  } catch (error) {
    if (isHallLayoutMissing(error)) return { available: false, hasLayout: false, tables: [], areas: [] };
    throw error;
  }

  const markers = await listTableMarkers();
  const areas = rows.filter((row) => row.shape !== 'table').map(toArea);
  const saved = new Map(rows.filter((row) => row.shape === 'table').map((row) => [row.tableId, row]));
  const positions = placeTables(markers, saved, areas);

  return {
    available: true,
    hasLayout: rows.length > 0,
    tables: markers.map((table) => ({ ...table, ...positions.get(table.id) })),
    areas,
  };
}

function memoryRow(item) {
  return { id: crypto.randomUUID(), tableId: null, label: '', width: TABLE_SIZE, height: TABLE_SIZE, rotation: 0, color: '#94a3b8', ...item };
}

async function insertItem(run, item) {
  if (!run) {
    const row = memoryRow(item);
    hallLayoutItems.push(row);
    return { ...row };
  }
  const { rows } = await run(
    `INSERT INTO hall_layout_items (shape, seating_table_id, label, x, y, width, height, rotation, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (seating_table_id) WHERE seating_table_id IS NOT NULL DO NOTHING
     RETURNING ${COLUMNS}`,
    [
      item.shape, item.tableId ?? null, item.label ?? '', item.x, item.y,
      item.width ?? TABLE_SIZE, item.height ?? TABLE_SIZE, item.rotation ?? 0, item.color ?? '#94a3b8',
    ]
  );
  return rows[0] ?? null;
}

/** Runs `work` alone: two admins pressing the same button cannot double the areas. */
function exclusively(work) {
  if (!useDb) return work(null);
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('hall_layout'))");
    return work((text, params) => client.query(text, params));
  });
}

/** Saves a starting position for every table that has none, and the plan's areas on a first-time layout. */
async function fillLayout(run, markers) {
  const rows = await readRows(run);
  const firstTime = rows.length === 0;
  const areas = firstTime ? defaultAreas() : rows.filter((row) => row.shape !== 'table');
  if (firstTime) {
    for (const item of areas) await insertItem(run, item);
  }

  const saved = new Map(rows.filter((row) => row.shape === 'table').map((row) => [row.tableId, row]));
  const positions = placeTables(markers, saved, areas);
  for (const table of markers) {
    if (!saved.has(table.id)) {
      await insertItem(run, { shape: 'table', tableId: table.id, ...positions.get(table.id) });
    }
  }
}

function unusedTableName(number, taken) {
  let name = `Table ${number}`;
  for (let extra = 2; taken.has(name.toLowerCase()); extra += 1) name = `Table ${number} (${extra})`;
  taken.add(name.toLowerCase());
  return name;
}

/**
 * The "number of tables" rule: makes sure every number from 1 to `count` exists
 * (new ones are empty Common tables with 10 seats), then lays out the map.
 * It never deletes, renames, moves or reseats an existing table, so a lower count
 * than before changes nothing. Returns the numbers it created, or null when the
 * map's database table is missing — checked first, so no table is created then.
 */
export async function generateHallLayout(count) {
  try {
    await readRows(useDb ? query : null);
  } catch (error) {
    if (isHallLayoutMissing(error)) return null;
    throw error;
  }

  const before = await listTableMarkers();
  const numbers = new Set(before.map((table) => table.number));
  const names = new Set(before.map((table) => String(table.name ?? '').trim().toLowerCase()));
  const created = [];

  for (let number = 1; number <= count; number += 1) {
    if (numbers.has(number)) continue;
    try {
      await createSeatingTable({ tableNumber: number, tableName: unusedTableName(number, names), capacity: 10, party: COMMON });
      created.push(number);
    } catch (error) {
      // The other admin created this number a moment ago: it exists, which is all that was asked.
      if (error.message !== 'A table with that number already exists') throw error;
    }
  }

  const markers = await listTableMarkers();
  await exclusively((run) => fillLayout(run, markers));
  return { created };
}

/** Puts the whole map back to the hotel plan: custom areas and every moved position are discarded. */
export async function resetHallLayout() {
  const markers = await listTableMarkers();
  await exclusively(async (run) => {
    if (run) await run('DELETE FROM hall_layout_items');
    else hallLayoutItems.length = 0;
    await fillLayout(run, markers);
  });
}

/** Saves where one table stands. False when there is no such table. */
export async function saveTablePosition(tableId, { x, y }) {
  if (!useDb) {
    const markers = await listTableMarkers();
    if (!markers.some((table) => table.id === tableId)) return false;
    const row = hallLayoutItems.find((entry) => entry.tableId === tableId);
    if (row) Object.assign(row, { x, y });
    else hallLayoutItems.push(memoryRow({ shape: 'table', tableId, x, y }));
    return true;
  }

  try {
    await query(
      `INSERT INTO hall_layout_items (shape, seating_table_id, x, y)
       VALUES ('table', $1, $2, $3)
       ON CONFLICT (seating_table_id) WHERE seating_table_id IS NOT NULL
       DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, updated_at = now()`,
      [tableId, x, y]
    );
    return true;
  } catch (error) {
    if (NO_SUCH_ROW.has(error.code)) return false;
    throw error;
  }
}

export async function createHallArea(values) {
  return exclusively(async (run) => {
    const rows = await readRows(run);
    if (rows.filter((row) => row.shape !== 'table').length >= MAX_AREAS) throw new Error(TOO_MANY_AREAS);
    return toArea(await insertItem(run, values));
  });
}

const AREA_FIELDS = ['label', 'x', 'y', 'width', 'height', 'rotation', 'color'];

/** Changes only the fields given. Null when there is no such area (a table's position is not an area). */
export async function updateHallArea(areaId, changes) {
  const fields = AREA_FIELDS.filter((field) => changes[field] !== undefined);
  if (!useDb) {
    const row = hallLayoutItems.find((entry) => entry.id === areaId && entry.shape !== 'table');
    if (!row) return null;
    for (const field of fields) row[field] = changes[field];
    return toArea(row);
  }

  // Column names come from AREA_FIELDS, never from the request.
  const sets = fields.map((field, index) => `${field} = $${index + 2}`);
  try {
    const { rows } = await query(
      `UPDATE hall_layout_items SET ${[...sets, 'updated_at = now()'].join(', ')}
       WHERE id = $1 AND shape <> 'table' RETURNING ${COLUMNS}`,
      [areaId, ...fields.map((field) => changes[field])]
    );
    return rows[0] ? toArea(rows[0]) : null;
  } catch (error) {
    if (NO_SUCH_ROW.has(error.code)) return null;
    throw error;
  }
}

/** False when there is no such area. Never removes a table's position or a seating table. */
export async function deleteHallArea(areaId) {
  if (!useDb) {
    const index = hallLayoutItems.findIndex((entry) => entry.id === areaId && entry.shape !== 'table');
    if (index === -1) return false;
    hallLayoutItems.splice(index, 1);
    return true;
  }
  try {
    const { rows } = await query(
      "DELETE FROM hall_layout_items WHERE id = $1 AND shape <> 'table' RETURNING id",
      [areaId]
    );
    return rows.length > 0;
  } catch (error) {
    if (NO_SUCH_ROW.has(error.code)) return false;
    throw error;
  }
}
