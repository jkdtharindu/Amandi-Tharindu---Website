import crypto from 'node:crypto';
import { query } from '../db.js';
import { seatingTables } from '../data/tableArrangementStore.js';
import { guestStore } from '../data/guestStore.js';

const useDb = Boolean(process.env.DATABASE_URL);

const DUPLICATE_TABLE_NUMBER = 'A table with that number already exists';
const GUEST_ALREADY_SEATED = 'Guest is already assigned to another seat';

// Postgres unique_violation.
const UNIQUE_VIOLATION = '23505';

const SEAT_JSON = `
  COALESCE(
    json_agg(
      json_build_object(
        'id', ts.id,
        'seatNumber', ts.seat_number,
        'guestId', ts.guest_id,
        'guestName', g.name,
        'dietaryRequirements', ts.dietary_requirements,
        'specialNotes', ts.special_notes
      ) ORDER BY ts.seat_number
    ) FILTER (WHERE ts.id IS NOT NULL),
    '[]'::json
  ) AS seats
`;

const TABLE_SELECT = `
  SELECT
    st.id,
    st.table_number,
    st.table_name,
    st.capacity,
    ${SEAT_JSON}
  FROM seating_tables st
  LEFT JOIN table_seats ts ON st.id = ts.seating_table_id
  LEFT JOIN guests g ON ts.guest_id = g.id
`;

function guestNameFor(guestId) {
  if (!guestId) return null;
  const guest = guestStore.find((entry) => entry.id === guestId);
  return guest ? guest.name : null;
}

/**
 * Project an in-memory table into the same shape the SQL path returns,
 * resolving guest names the way the LEFT JOIN does.
 */
function hydrateMemoryTable(table) {
  if (!table) return null;
  return {
    id: table.id,
    table_number: table.table_number,
    table_name: table.table_name,
    capacity: table.capacity,
    seats: table.seats.map((seat) => ({
      id: seat.id,
      seatNumber: seat.seatNumber,
      guestId: seat.guestId,
      guestName: guestNameFor(seat.guestId),
      dietaryRequirements: seat.dietaryRequirements,
      specialNotes: seat.specialNotes,
    })),
  };
}

function findMemorySeat(seatId) {
  for (const table of seatingTables) {
    const seat = table.seats.find((entry) => entry.id === seatId);
    if (seat) return { table, seat };
  }
  return null;
}

/**
 * Get all seating tables with their seats and guest information.
 */
export async function listSeatingTables() {
  if (!useDb) {
    return [...seatingTables]
      .sort((a, b) => a.table_number - b.table_number)
      .map(hydrateMemoryTable);
  }

  const { rows } = await query(`
    ${TABLE_SELECT}
    GROUP BY st.id, st.table_number, st.table_name, st.capacity
    ORDER BY st.table_number
  `);
  return rows;
}

/**
 * Get a single seating table with all its seats.
 */
export async function getSeatingTableById(tableId) {
  if (!useDb) {
    return hydrateMemoryTable(seatingTables.find((table) => table.id === tableId));
  }

  const { rows } = await query(`
    ${TABLE_SELECT}
    WHERE st.id = $1
    GROUP BY st.id, st.table_number, st.table_name, st.capacity
  `, [tableId]);
  return rows[0] || null;
}

/**
 * Create a seating table along with its full set of empty seats.
 *
 * The SQL path does both inserts in one statement so a table can never be
 * left behind with a partial seat set.
 */
export async function createSeatingTable({ tableNumber, tableName, capacity = 10 }) {
  const number = Number(tableNumber);
  const seatCount = Number(capacity);

  if (!useDb) {
    if (seatingTables.some((table) => table.table_number === number)) {
      throw new Error(DUPLICATE_TABLE_NUMBER);
    }

    const table = {
      id: crypto.randomUUID(),
      table_number: number,
      table_name: tableName || null,
      capacity: seatCount,
      seats: Array.from({ length: seatCount }, (_, index) => ({
        id: crypto.randomUUID(),
        seatNumber: index + 1,
        guestId: null,
        dietaryRequirements: null,
        specialNotes: null,
      })),
    };

    seatingTables.push(table);
    return hydrateMemoryTable(table);
  }

  let created;
  try {
    const { rows } = await query(`
      WITH new_table AS (
        INSERT INTO seating_tables (table_number, table_name, capacity)
        VALUES ($1, $2, $3)
        RETURNING id
      ), new_seats AS (
        INSERT INTO table_seats (seating_table_id, seat_number)
        SELECT id, generate_series(1, $3) FROM new_table
      )
      SELECT id FROM new_table
    `, [number, tableName || null, seatCount]);
    created = rows[0];
  } catch (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(DUPLICATE_TABLE_NUMBER);
    }
    throw error;
  }

  return getSeatingTableById(created.id);
}

/**
 * Update a seating table's basic info.
 */
export async function updateSeatingTable(tableId, { tableName }) {
  if (!useDb) {
    const table = seatingTables.find((entry) => entry.id === tableId);
    if (!table) return null;
    if (tableName !== undefined && tableName !== null) {
      table.table_name = tableName;
    }
    return hydrateMemoryTable(table);
  }

  const { rowCount } = await query(`
    UPDATE seating_tables
    SET table_name = COALESCE($2, table_name),
        updated_at = now()
    WHERE id = $1
  `, [tableId, tableName ?? null]);

  if (rowCount === 0) return null;
  return getSeatingTableById(tableId);
}

/**
 * Delete a seating table and all its seats.
 */
export async function deleteSeatingTable(tableId) {
  if (!useDb) {
    const index = seatingTables.findIndex((table) => table.id === tableId);
    if (index !== -1) seatingTables.splice(index, 1);
    return { success: true };
  }

  await query('DELETE FROM seating_tables WHERE id = $1', [tableId]);
  return { success: true };
}

/**
 * Assign a guest to a specific seat.
 *
 * Uniqueness is enforced by a partial unique index on table_seats(guest_id),
 * so two concurrent assignments cannot both succeed.
 */
export async function assignGuestToSeat(seatId, guestId, { dietaryRequirements, specialNotes } = {}) {
  if (!useDb) {
    const found = findMemorySeat(seatId);
    if (!found) return null;

    if (guestId) {
      const clash = seatingTables.some((table) =>
        table.seats.some((seat) => seat.guestId === guestId && seat.id !== seatId)
      );
      if (clash) throw new Error(GUEST_ALREADY_SEATED);
    }

    const { seat } = found;
    seat.guestId = guestId || null;
    seat.dietaryRequirements = dietaryRequirements || null;
    seat.specialNotes = specialNotes || null;

    return { id: seat.id, seat_number: seat.seatNumber, guest_id: seat.guestId };
  }

  try {
    const { rows } = await query(`
      UPDATE table_seats
      SET guest_id = $2,
          dietary_requirements = $3,
          special_notes = $4,
          updated_at = now()
      WHERE id = $1
      RETURNING id, seat_number, guest_id
    `, [seatId, guestId || null, dietaryRequirements || null, specialNotes || null]);

    return rows[0] || null;
  } catch (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(GUEST_ALREADY_SEATED);
    }
    throw error;
  }
}

/**
 * Remove guest from a seat.
 */
export async function unassignGuestFromSeat(seatId) {
  return assignGuestToSeat(seatId, null, {});
}

/**
 * Get all accepted guests who are not yet seated.
 */
export async function listUnassignedGuests() {
  if (!useDb) {
    const seated = new Set(
      seatingTables.flatMap((table) => table.seats.map((seat) => seat.guestId).filter(Boolean))
    );
    return guestStore
      .filter((guest) => guest.rsvpStatus === 'accepted' && guest.isDeleted !== true && !seated.has(guest.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const { rows } = await query(`
    SELECT g.* FROM guests g
    WHERE g.rsvp_status = 'accepted'
      AND g.is_deleted = false
      AND NOT EXISTS (
        SELECT 1 FROM table_seats ts WHERE ts.guest_id = g.id
      )
    ORDER BY g.name
  `);
  return rows;
}

/**
 * Get all seated guests with their table info.
 */
export async function listAssignedGuests() {
  if (!useDb) {
    return [...seatingTables]
      .sort((a, b) => a.table_number - b.table_number)
      .flatMap((table) =>
        table.seats
          .filter((seat) => seat.guestId)
          .sort((a, b) => a.seatNumber - b.seatNumber)
          .map((seat) => {
            const guest = guestStore.find((entry) => entry.id === seat.guestId);
            return { ...guest, table_number: table.table_number, seat_number: seat.seatNumber };
          })
      );
  }

  const { rows } = await query(`
    SELECT
      g.*,
      st.table_number,
      ts.seat_number
    FROM table_seats ts
    JOIN guests g ON ts.guest_id = g.id
    JOIN seating_tables st ON ts.seating_table_id = st.id
    ORDER BY st.table_number, ts.seat_number
  `);
  return rows;
}

/**
 * Get a single guest with their current table assignment.
 */
export async function getGuestWithTableAssignment(guestId) {
  if (!useDb) {
    const guest = guestStore.find((entry) => entry.id === guestId);
    if (!guest) return null;

    for (const table of seatingTables) {
      const seat = table.seats.find((entry) => entry.guestId === guestId);
      if (seat) {
        return {
          ...guest,
          table_number: table.table_number,
          seating_table_id: table.id,
          seat_number: seat.seatNumber,
          table_seat_id: seat.id,
        };
      }
    }

    return { ...guest, table_number: null, seating_table_id: null, seat_number: null, table_seat_id: null };
  }

  const { rows } = await query(`
    SELECT
      g.*,
      st.table_number,
      st.id as seating_table_id,
      ts.seat_number,
      ts.id as table_seat_id
    FROM guests g
    LEFT JOIN table_seats ts ON g.id = ts.guest_id
    LEFT JOIN seating_tables st ON ts.seating_table_id = st.id
    WHERE g.id = $1
  `, [guestId]);
  return rows[0] || null;
}
