/**
 * Table sides and Common tables (PRD §20, TASKS.md Action 68).
 *
 * Every seating table has a side: the bride's, the groom's, or `common`. A bride
 * or groom table seats only that side's people; a Common table seats the people
 * both sides have left over once their own tables are full.
 *
 * The admin never names a side directly. The create form sends "own" or
 * "common", and "own" becomes the signed-in admin's side here on the server, so
 * a bride admin cannot put a table on the groom's side by editing the request.
 *
 * Pure: no database access, so the Table Arrangement screen can import it too.
 */

export const COMMON = 'common';
export const TABLE_SIDES = ['bride', 'groom', COMMON];

/** Seats assumed per Common table before any exists — the create form's default size. */
export const DEFAULT_TABLE_SIZE = 10;

const SIDE_LABELS = { bride: 'Bride', groom: 'Groom', common: 'Common' };

/** "Bride", "Groom" or "Common"; blank for a value that is none of them. */
export function sideLabel(side) {
  return SIDE_LABELS[side] ?? '';
}

/**
 * The side a request asks for: "own" is the signed-in admin's side, "common" is
 * Common. Anything else — including a raw "bride" or "groom" — is refused (null).
 */
export function resolveRequestedSide(requested, party) {
  if (requested === 'own') return party;
  if (requested === COMMON) return COMMON;
  return null;
}

/**
 * What a guest and the admin see for a table: its name, or "Table N" for a table
 * created before names were required. Guests never see the number otherwise.
 */
export function tableLabel(table) {
  const name = String(table?.table_name ?? '').trim();
  return name || `Table ${table?.table_number}`;
}

/** Whether anyone — a guest, one of their people, or a placeholder — sits on the seat. */
export function isSeatOccupied(seat) {
  return Boolean(seat.guestId || seat.probableAttendeeId || seat.inviteeId);
}

function tableNameFrom(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Checks the create-table form. The name is required (uniqueness is the
 * database's job, see createSeatingTable); the side defaults to "own".
 *
 * @returns {{ ok: true, value: { tableNumber: number, tableName: string, capacity: number, party: string } }
 *   | { ok: false, message: string }}
 */
export function validateNewTable(body, party) {
  const input = body ?? {};
  const tableNumber = Number(input.tableNumber);
  const capacity = Number(input.capacity);
  const tableName = tableNameFrom(input.tableName);
  const side = resolveRequestedSide(input.side ?? 'own', party);

  if (!Number.isInteger(tableNumber) || tableNumber < 1) {
    return { ok: false, message: 'Valid table number required.' };
  }
  if (!tableName) {
    return { ok: false, message: 'Give the table a name, for example "Rose Table".' };
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
    return { ok: false, message: 'Capacity must be between 1 and 100.' };
  }
  if (!side) {
    return { ok: false, message: 'Choose "My side" or "Common" for the table.' };
  }
  return { ok: true, value: { tableNumber, tableName, capacity, party: side } };
}

/**
 * Checks a table edit: a new name (never blank — names are required now) and/or
 * a new side ("own" or "common"). Whether the side may change is decided by the
 * repository, which refuses while anyone is seated.
 *
 * @returns {{ ok: true, value: { tableName?: string, side?: string } } | { ok: false, message: string }}
 */
export function validateTableUpdate(body, party) {
  const input = body ?? {};
  const value = {};

  if (input.tableName !== undefined) {
    const tableName = tableNameFrom(input.tableName);
    if (!tableName) return { ok: false, message: 'A table name cannot be blank.' };
    value.tableName = tableName;
  }
  if (input.side !== undefined) {
    const side = resolveRequestedSide(input.side, party);
    if (!side) return { ok: false, message: 'Choose "My side" or "Common" for the table.' };
    value.side = side;
  }
  if (value.tableName === undefined && value.side === undefined) {
    return { ok: false, message: 'Nothing to change.' };
  }
  return { ok: true, value };
}

/**
 * The leftover summary (counts only — never names). For each side: how many of
 * its accepted people are not seated yet, how many empty seats its own tables
 * still have, and how many of its people will not fit there (the leftover).
 * Then the combined leftover, the empty seats on Common tables, and roughly how
 * many more Common tables the rest would need.
 *
 * "Roughly" uses the average size of the Common tables that exist, or the form's
 * default of 10 before there are any. Probable-attendance placeholders are a
 * shared pool, not either side's people, so they are left out.
 *
 * @param {object} input
 * @param {{ side: string, capacity?: number, seats: object[] }[]} input.tables every table, both sides and Common
 * @param {{ bride: number, groom: number }} input.unseated accepted people not yet seated, per side
 */
export function buildLeftoverSummary({ tables, unseated }) {
  const freeSeats = { bride: 0, groom: 0, common: 0 };
  const commonSizes = [];

  for (const table of tables) {
    if (!(table.side in freeSeats)) continue;
    freeSeats[table.side] += table.seats.filter((seat) => !isSeatOccupied(seat)).length;
    if (table.side === COMMON) commonSizes.push(table.capacity ?? table.seats.length);
  }

  const sideRow = (side) => {
    const count = unseated?.[side] ?? 0;
    return { unseated: count, freeSeats: freeSeats[side], leftover: Math.max(0, count - freeSeats[side]) };
  };
  const bride = sideRow('bride');
  const groom = sideRow('groom');
  const combinedLeftover = bride.leftover + groom.leftover;

  const averageSize = commonSizes.length
    ? Math.round(commonSizes.reduce((total, size) => total + size, 0) / commonSizes.length)
    : DEFAULT_TABLE_SIZE;
  const seatsPerCommonTable = Math.max(1, averageSize);
  const stillWithoutSeat = Math.max(0, combinedLeftover - freeSeats.common);

  return {
    bride,
    groom,
    combinedLeftover,
    commonFreeSeats: freeSeats.common,
    seatsPerCommonTable,
    commonTablesNeeded: Math.ceil(stillWithoutSeat / seatsPerCommonTable),
  };
}
