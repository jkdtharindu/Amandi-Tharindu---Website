import { query } from '../db.js';
import { guestStore } from '../data/guestStore.js';
import { invitees } from '../data/inviteesStore.js';
import { seatingTables } from '../data/tableArrangementStore.js';
import { COMMON } from '../table-arrangement/tableSides.js';

/**
 * Whether a guest, invitee, table or seat named by id in a request belongs to the
 * signed-in admin's side (bride or groom). Routes answer 404 when it does not, so
 * the other side's ids are indistinguishable from ids that do not exist.
 *
 * People are always exactly one side's. Tables can also be Common (Action 68):
 * both sides reach a Common table and its seats, and each still places only its
 * own people there — see src/table-arrangement/seatingRules.js.
 *
 * `exec` is injectable so tests can drive the SQL path; production uses the default.
 */

const useDb = Boolean(process.env.DATABASE_URL);

// Postgres invalid_text_representation: a malformed id compared against a uuid column.
const INVALID_UUID = '22P02';

const sideOf = (record) => record.assignedToParty ?? 'bride';

/** This side's own table, or a Common table — the tables a side may seat people at. */
const tableIsReachable = (table, party) => sideOf(table) === party || sideOf(table) === COMMON;

async function firstRow(run, sql, params) {
  try {
    const { rows } = await run(sql, params);
    return rows[0] ?? null;
  } catch (error) {
    if (error.code === INVALID_UUID) return null;
    throw error;
  }
}

async function exists(run, sql, params) {
  return (await firstRow(run, sql, params)) !== null;
}

export async function guestIsOnSide(guestId, party, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const guest = guestStore.find((entry) => entry.id === guestId);
    return Boolean(guest) && sideOf(guest) === party;
  }
  return exists(run, 'SELECT 1 FROM guests WHERE id = $1 AND assigned_to_party = $2', [guestId, party]);
}

/** An invitee's side is the side of the guest whose party they belong to. */
export async function inviteeIsOnSide(inviteeId, party, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const invitee = invitees.find((entry) => entry.id === inviteeId);
    return Boolean(invitee) && (await guestIsOnSide(invitee.guestId, party));
  }
  return exists(
    run,
    `SELECT 1 FROM invitees i JOIN guests g ON g.id = i.guest_id
     WHERE i.id = $1 AND g.assigned_to_party = $2`,
    [inviteeId, party]
  );
}

/** The table is this side's own — never a Common table and never the other side's. */
export async function tableIsOnSide(tableId, party, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const table = seatingTables.find((entry) => entry.id === tableId);
    return Boolean(table) && sideOf(table) === party;
  }
  return exists(run, 'SELECT 1 FROM seating_tables WHERE id = $1 AND assigned_to_party = $2', [tableId, party]);
}

/**
 * The side of a table this side may work on — its own (the side's name) or a
 * Common table ('common') — or null for the other side's table or no table at
 * all, which routes answer with 404 (Action 68).
 */
export async function visibleTableSide(tableId, party, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const table = seatingTables.find((entry) => entry.id === tableId);
    return table && tableIsReachable(table, party) ? sideOf(table) : null;
  }
  const row = await firstRow(
    run,
    `SELECT assigned_to_party AS side FROM seating_tables
     WHERE id = $1 AND (assigned_to_party = $2 OR assigned_to_party = '${COMMON}')`,
    [tableId, party]
  );
  return row?.side ?? null;
}

/**
 * The seat is on the table named in the URL, and that table is this side's own
 * or a Common table (Action 68 — a Common table is shared, so both sides reach
 * its seats). Whose people may be placed there is checked separately: a guest
 * or invitee must still be on this side (guestIsOnSide / inviteeIsOnSide).
 */
export async function seatIsOnSideTable(tableId, seatId, party, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const table = seatingTables.find((entry) => entry.id === tableId);
    return Boolean(table) && tableIsReachable(table, party) && table.seats.some((seat) => seat.id === seatId);
  }
  return exists(
    run,
    `SELECT 1 FROM table_seats ts JOIN seating_tables st ON st.id = ts.seating_table_id
     WHERE ts.id = $1 AND st.id = $2 AND (st.assigned_to_party = $3 OR st.assigned_to_party = '${COMMON}')`,
    [seatId, tableId, party]
  );
}

/**
 * The side of the guest or invitee sitting on a seat, or null when the seat is
 * empty, holds an anonymous placeholder, or does not exist. Used to stop one
 * side removing the other side's people from a Common table (Action 68).
 */
export async function seatOccupantSide(seatId, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const seat = seatingTables.flatMap((table) => table.seats).find((entry) => entry.id === seatId);
    const guestId = seat?.guestId || invitees.find((entry) => entry.id === seat?.inviteeId)?.guestId;
    const guest = guestId ? guestStore.find((entry) => entry.id === guestId) : null;
    return guest ? sideOf(guest) : null;
  }
  const row = await firstRow(
    run,
    `SELECT COALESCE(g.assigned_to_party, ig.assigned_to_party) AS side
     FROM table_seats ts
     LEFT JOIN guests g ON g.id = ts.guest_id
     LEFT JOIN invitees i ON i.id = ts.invitee_id
     LEFT JOIN guests ig ON ig.id = i.guest_id
     WHERE ts.id = $1`,
    [seatId]
  );
  return row?.side ?? null;
}
