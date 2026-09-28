import { query } from '../db.js';
import { guestStore } from '../data/guestStore.js';
import { invitees } from '../data/inviteesStore.js';
import { seatingTables } from '../data/tableArrangementStore.js';

/**
 * Whether a guest, invitee, table or seat named by id in a request belongs to the
 * signed-in admin's side (bride or groom). Routes answer 404 when it does not, so
 * the other side's ids are indistinguishable from ids that do not exist.
 *
 * `exec` is injectable so tests can drive the SQL path; production uses the default.
 */

const useDb = Boolean(process.env.DATABASE_URL);

// Postgres invalid_text_representation: a malformed id compared against a uuid column.
const INVALID_UUID = '22P02';

const sideOf = (record) => record.assignedToParty ?? 'bride';

async function exists(run, sql, params) {
  try {
    const { rows } = await run(sql, params);
    return rows.length > 0;
  } catch (error) {
    if (error.code === INVALID_UUID) return false;
    throw error;
  }
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

export async function tableIsOnSide(tableId, party, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const table = seatingTables.find((entry) => entry.id === tableId);
    return Boolean(table) && sideOf(table) === party;
  }
  return exists(run, 'SELECT 1 FROM seating_tables WHERE id = $1 AND assigned_to_party = $2', [tableId, party]);
}

/** The seat is on the table named in the URL, and that table is this side's. */
export async function seatIsOnSideTable(tableId, seatId, party, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const table = seatingTables.find((entry) => entry.id === tableId);
    return Boolean(table) && sideOf(table) === party && table.seats.some((seat) => seat.id === seatId);
  }
  return exists(
    run,
    `SELECT 1 FROM table_seats ts JOIN seating_tables st ON st.id = ts.seating_table_id
     WHERE ts.id = $1 AND st.id = $2 AND st.assigned_to_party = $3`,
    [seatId, tableId, party]
  );
}
