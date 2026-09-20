import crypto from 'node:crypto';
import { query } from '../db.js';
import { seatingTables } from '../data/tableArrangementStore.js';
import { guestStore } from '../data/guestStore.js';
import { probableAttendees } from '../data/probableAttendeesStore.js';
import { invitees } from '../data/inviteesStore.js';
import { mapGuestRow } from '../guest-auth/guestRepo.js';

const useDb = Boolean(process.env.DATABASE_URL);

const DUPLICATE_TABLE_NUMBER = 'A table with that number already exists';
const GUEST_ALREADY_SEATED = 'Guest is already assigned to another seat';
const PROBABLE_ALREADY_SEATED = 'This probable attendee is already assigned to another seat';
const INVITEE_ALREADY_SEATED = 'This person is already assigned to another seat';
const SEAT_ALREADY_TAKEN = 'That seat already has someone on it.';
const BUFFER_BELOW_SEATED = 'Cannot reduce below the number already seated — unassign them first';
const INVALID_BUFFER_COUNT = 'Count must be a non-negative whole number';

/**
 * The errors above are written *for the admin reading the screen* — "that
 * table number is taken", "unassign them first". Everything else this module
 * can throw is a database or programming fault whose text (Postgres detail
 * lines, constraint names, column types) should never reach a client.
 *
 * Routes use this set to tell the two apart; see isUserFacingError below and
 * Next Action 34, which found six routes forwarding `error.message` verbatim.
 */
const USER_FACING_ERRORS = new Set([
  DUPLICATE_TABLE_NUMBER,
  GUEST_ALREADY_SEATED,
  PROBABLE_ALREADY_SEATED,
  INVITEE_ALREADY_SEATED,
  SEAT_ALREADY_TAKEN,
  BUFFER_BELOW_SEATED,
  INVALID_BUFFER_COUNT,
]);

/** True when `error`'s message was written to be shown to an admin. */
export function isUserFacingError(error) {
  return USER_FACING_ERRORS.has(error?.message);
}

const PROBABLE_BUCKETS = ['declined', 'pending'];

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
        'probableAttendeeId', ts.probable_attendee_id,
        'probableAttendeeLabel',
          CASE WHEN pa.id IS NOT NULL
            THEN 'Probable (' || initcap(pa.rsvp_bucket) || ') #' || pa.slot_index
            ELSE NULL
          END,
        'inviteeId', ts.invitee_id,
        'inviteeName', i.name,
        'inviteeGuestName', ig.name,
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
  LEFT JOIN probable_attendees pa ON ts.probable_attendee_id = pa.id
  LEFT JOIN invitees i ON ts.invitee_id = i.id
  LEFT JOIN guests ig ON i.guest_id = ig.id
`;

function guestNameFor(guestId) {
  if (!guestId) return null;
  const guest = guestStore.find((entry) => entry.id === guestId);
  return guest ? guest.name : null;
}

function probableAttendeeLabel(bucket, slotIndex) {
  const capitalized = bucket.charAt(0).toUpperCase() + bucket.slice(1);
  return `Probable (${capitalized}) #${slotIndex}`;
}

function probableAttendeeLabelFor(probableAttendeeId) {
  if (!probableAttendeeId) return null;
  const slot = probableAttendees.find((entry) => entry.id === probableAttendeeId);
  return slot ? probableAttendeeLabel(slot.bucket, slot.slotIndex) : null;
}

function inviteeNameFor(inviteeId) {
  if (!inviteeId) return null;
  const invitee = invitees.find((entry) => entry.id === inviteeId);
  return invitee ? invitee.name : null;
}

function inviteeGuestNameFor(inviteeId) {
  if (!inviteeId) return null;
  const invitee = invitees.find((entry) => entry.id === inviteeId);
  return invitee ? guestNameFor(invitee.guestId) : null;
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
      probableAttendeeId: seat.probableAttendeeId || null,
      probableAttendeeLabel: probableAttendeeLabelFor(seat.probableAttendeeId),
      inviteeId: seat.inviteeId || null,
      inviteeName: inviteeNameFor(seat.inviteeId),
      inviteeGuestName: inviteeGuestNameFor(seat.inviteeId),
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
 * A seat holds one occupant. Putting a *different* person on an occupied seat
 * used to succeed and silently unseat whoever was there — reachable from a stale
 * page or a second tab, because the screen has no live refresh (Next Action 59).
 * A write is allowed onto an empty seat, or onto the seat this same occupant
 * already holds (re-saving their dietary notes). Clearing a seat, which passes no
 * occupant, is never guarded.
 */
function seatHeldByAnother(seat, field, id) {
  const occupied = Boolean(seat.guestId || seat.probableAttendeeId || seat.inviteeId);
  return occupied && seat[field] !== id;
}

// The same rule as one predicate on the UPDATE, so the database decides it and
// two simultaneous assignments cannot both pass. `column` is one of our own
// constants, never user input; the occupant's id is always parameter $2.
const seatFreeOrHeldBy = (column) =>
  `AND ((guest_id IS NULL AND probable_attendee_id IS NULL AND invitee_id IS NULL) OR ${column} = $2)`;

// For a guarded UPDATE that changed no row: the seat either does not exist
// (null, as before) or is held by someone else.
async function seatTakenOrMissing(run, seatId) {
  const { rows } = await run('SELECT id FROM table_seats WHERE id = $1', [seatId]);
  if (rows[0]) throw new Error(SEAT_ALREADY_TAKEN);
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
export async function createSeatingTable({ tableNumber, tableName, capacity = 10, party = 'bride' }) {
  const number = Number(tableNumber);
  const seatCount = Number(capacity);

  if (!useDb) {
    if (seatingTables.some((table) => table.table_number === number && (table.assignedToParty ?? 'bride') === party)) {
      throw new Error(DUPLICATE_TABLE_NUMBER);
    }

    const table = {
      id: crypto.randomUUID(),
      table_number: number,
      table_name: tableName || null,
      assignedToParty: party,
      capacity: seatCount,
      seats: Array.from({ length: seatCount }, (_, index) => ({
        id: crypto.randomUUID(),
        seatNumber: index + 1,
        guestId: null,
        probableAttendeeId: null,
        inviteeId: null,
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
        INSERT INTO seating_tables (table_number, table_name, capacity, assigned_to_party)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      ), new_seats AS (
        INSERT INTO table_seats (seating_table_id, seat_number)
        SELECT id, generate_series(1, $3) FROM new_table
      )
      SELECT id FROM new_table
    `, [number, tableName || null, seatCount, party]);
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
 * so two concurrent assignments cannot both succeed. A seat that already holds a
 * different person is refused (SEAT_ALREADY_TAKEN); guestId null clears the seat.
 * `exec` (optional, last) is a query function, used by tests; production omits it.
 */
export async function assignGuestToSeat(seatId, guestId, { dietaryRequirements, specialNotes } = {}, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const found = findMemorySeat(seatId);
    if (!found) return null;

    if (guestId && seatHeldByAnother(found.seat, 'guestId', guestId)) {
      throw new Error(SEAT_ALREADY_TAKEN);
    }

    if (guestId) {
      const clash = seatingTables.some((table) =>
        table.seats.some((seat) => seat.guestId === guestId && seat.id !== seatId)
      );
      if (clash) throw new Error(GUEST_ALREADY_SEATED);
    }

    const { seat } = found;
    seat.guestId = guestId || null;
    // A seat holds one occupant -- real Guest, ProbableAttendee, or Invitee -- never more than one.
    seat.probableAttendeeId = null;
    seat.inviteeId = null;
    seat.dietaryRequirements = dietaryRequirements || null;
    seat.specialNotes = specialNotes || null;

    return { id: seat.id, seat_number: seat.seatNumber, guest_id: seat.guestId };
  }

  try {
    const { rows } = await run(`
      UPDATE table_seats
      SET guest_id = $2,
          probable_attendee_id = NULL,
          invitee_id = NULL,
          dietary_requirements = $3,
          special_notes = $4,
          updated_at = now()
      WHERE id = $1
        ${guestId ? seatFreeOrHeldBy('guest_id') : ''}
      RETURNING id, seat_number, guest_id
    `, [seatId, guestId || null, dietaryRequirements || null, specialNotes || null]);

    if (rows[0]) return rows[0];
    return guestId ? await seatTakenOrMissing(run, seatId) : null;
  } catch (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(GUEST_ALREADY_SEATED);
    }
    throw error;
  }
}

/**
 * Remove guest from a seat. Also clears any ProbableAttendee occupant, since
 * a seat only ever holds one or the other — this is the general "clear seat"
 * path, reused by unassignProbableAttendeeFromSeat below.
 */
export async function unassignGuestFromSeat(seatId) {
  return assignGuestToSeat(seatId, null, {});
}

/**
 * Assign a ProbableAttendee placeholder to a seat. Mirrors assignGuestToSeat:
 * same concurrency-safe partial-unique-index pattern, same clash handling,
 * but for the anonymous buffer pool instead of a real Guest. A seat that already
 * holds a different occupant is refused (SEAT_ALREADY_TAKEN).
 */
export async function assignProbableAttendeeToSeat(seatId, probableAttendeeId, { dietaryRequirements, specialNotes } = {}, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const found = findMemorySeat(seatId);
    if (!found) return null;

    if (probableAttendeeId && seatHeldByAnother(found.seat, 'probableAttendeeId', probableAttendeeId)) {
      throw new Error(SEAT_ALREADY_TAKEN);
    }

    if (probableAttendeeId) {
      const clash = seatingTables.some((table) =>
        table.seats.some((seat) => seat.probableAttendeeId === probableAttendeeId && seat.id !== seatId)
      );
      if (clash) throw new Error(PROBABLE_ALREADY_SEATED);
    }

    const { seat } = found;
    seat.probableAttendeeId = probableAttendeeId || null;
    seat.guestId = null;
    seat.inviteeId = null;
    seat.dietaryRequirements = dietaryRequirements || null;
    seat.specialNotes = specialNotes || null;

    return { id: seat.id, seat_number: seat.seatNumber, probable_attendee_id: seat.probableAttendeeId };
  }

  try {
    const { rows } = await run(`
      UPDATE table_seats
      SET probable_attendee_id = $2,
          guest_id = NULL,
          invitee_id = NULL,
          dietary_requirements = $3,
          special_notes = $4,
          updated_at = now()
      WHERE id = $1
        ${probableAttendeeId ? seatFreeOrHeldBy('probable_attendee_id') : ''}
      RETURNING id, seat_number, probable_attendee_id
    `, [seatId, probableAttendeeId || null, dietaryRequirements || null, specialNotes || null]);

    if (rows[0]) return rows[0];
    return probableAttendeeId ? await seatTakenOrMissing(run, seatId) : null;
  } catch (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(PROBABLE_ALREADY_SEATED);
    }
    throw error;
  }
}

/**
 * Remove a ProbableAttendee from a seat. A thin alias — clearing a seat is
 * the same operation regardless of what occupied it.
 */
export async function unassignProbableAttendeeFromSeat(seatId) {
  return assignGuestToSeat(seatId, null, {});
}

/**
 * Assign an individual Invitee (a named person from a multi-person
 * invitation) to a seat. Mirrors assignGuestToSeat/assignProbableAttendeeToSeat:
 * same concurrency-safe partial-unique-index pattern. A seat that already holds
 * a different occupant is refused (SEAT_ALREADY_TAKEN).
 */
export async function assignInviteeToSeat(seatId, inviteeId, { dietaryRequirements, specialNotes } = {}, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const found = findMemorySeat(seatId);
    if (!found) return null;

    if (inviteeId && seatHeldByAnother(found.seat, 'inviteeId', inviteeId)) {
      throw new Error(SEAT_ALREADY_TAKEN);
    }

    if (inviteeId) {
      const clash = seatingTables.some((table) =>
        table.seats.some((seat) => seat.inviteeId === inviteeId && seat.id !== seatId)
      );
      if (clash) throw new Error(INVITEE_ALREADY_SEATED);
    }

    const { seat } = found;
    seat.inviteeId = inviteeId || null;
    seat.guestId = null;
    seat.probableAttendeeId = null;
    seat.dietaryRequirements = dietaryRequirements || null;
    seat.specialNotes = specialNotes || null;

    return { id: seat.id, seat_number: seat.seatNumber, invitee_id: seat.inviteeId };
  }

  try {
    const { rows } = await run(`
      UPDATE table_seats
      SET invitee_id = $2,
          guest_id = NULL,
          probable_attendee_id = NULL,
          dietary_requirements = $3,
          special_notes = $4,
          updated_at = now()
      WHERE id = $1
        ${inviteeId ? seatFreeOrHeldBy('invitee_id') : ''}
      RETURNING id, seat_number, invitee_id
    `, [seatId, inviteeId || null, dietaryRequirements || null, specialNotes || null]);

    if (rows[0]) return rows[0];
    return inviteeId ? await seatTakenOrMissing(run, seatId) : null;
  } catch (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(INVITEE_ALREADY_SEATED);
    }
    throw error;
  }
}

/**
 * Remove an Invitee from a seat. A thin alias — clearing a seat is the same
 * operation regardless of what occupied it.
 */
export async function unassignInviteeFromSeat(seatId) {
  return assignGuestToSeat(seatId, null, {});
}

/**
 * Finds whichever seat (if any) currently holds this invitee and clears it,
 * so deleting the invitee doesn't leave a seat stranded on a now-nonexistent
 * occupant. A no-op if the invitee was never seated. Called before deleting
 * the invitee row itself (see removeInvitee.js).
 *
 * `exec` (optional) is the open transaction's query function. On Postgres this is
 * one UPDATE that clears exactly what assignGuestToSeat(seatId, null) clears —
 * the invitee link plus the dietary requirements and notes — so it can run inside
 * the removal transaction without dragging assignGuestToSeat into it. The seat's
 * invitee_id has a unique partial index, so at most one seat can match.
 */
export async function unassignSeatByInviteeId(inviteeId, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    for (const table of seatingTables) {
      const seat = table.seats.find((entry) => entry.inviteeId === inviteeId);
      if (seat) return unassignInviteeFromSeat(seat.id);
    }
    return null;
  }

  const { rows } = await run(
    `UPDATE table_seats
     SET invitee_id = NULL,
         dietary_requirements = NULL,
         special_notes = NULL,
         updated_at = now()
     WHERE invitee_id = $1
     RETURNING id, seat_number, guest_id`,
    [inviteeId]
  );
  return rows[0] || null;
}

/**
 * Frees every seat held by a guest, or by any of that guest's invitees, and
 * wipes the dietary requirements and notes on them — the same end state as
 * assignGuestToSeat(seatId, null) leaves. Used when a whole guest is removed:
 * the table window reads seats with no is_deleted filter, so a removed guest
 * whose seats were never freed keeps showing on them. Returns how many seats
 * were freed.
 *
 * `exec` (optional) is the open transaction's query function.
 */
export async function unassignSeatsForGuest(guestId, exec) {
  const run = exec ?? (useDb ? query : null);
  if (!run) {
    const inviteeIds = new Set(
      invitees.filter((entry) => entry.guestId === guestId).map((entry) => entry.id)
    );
    let freed = 0;
    for (const table of seatingTables) {
      for (const seat of table.seats) {
        if (seat.guestId === guestId || (seat.inviteeId && inviteeIds.has(seat.inviteeId))) {
          seat.guestId = null;
          seat.inviteeId = null;
          seat.dietaryRequirements = null;
          seat.specialNotes = null;
          freed += 1;
        }
      }
    }
    return freed;
  }

  const { rows } = await run(
    `UPDATE table_seats
     SET guest_id = NULL,
         invitee_id = NULL,
         dietary_requirements = NULL,
         special_notes = NULL,
         updated_at = now()
     WHERE guest_id = $1
        OR invitee_id IN (SELECT id FROM invitees WHERE guest_id = $1)
     RETURNING id`,
    [guestId]
  );
  return rows.length;
}

/**
 * Get all accepted guests who are not yet seated. A guest that has any
 * invitee rows is seated individually instead (see listUnassignedInvitees),
 * so it's excluded here even if the party itself shows 'accepted'.
 */
export async function listUnassignedGuests() {
  if (!useDb) {
    const seated = new Set(
      seatingTables.flatMap((table) => table.seats.map((seat) => seat.guestId).filter(Boolean))
    );
    const guestIdsWithInvitees = new Set(invitees.map((invitee) => invitee.guestId));
    return guestStore
      .filter(
        (guest) =>
          guest.rsvpStatus === 'accepted' &&
          guest.isDeleted !== true &&
          !seated.has(guest.id) &&
          !guestIdsWithInvitees.has(guest.id)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const { rows } = await query(`
    SELECT g.* FROM guests g
    WHERE g.rsvp_status = 'accepted'
      AND g.is_deleted = false
      AND NOT EXISTS (
        SELECT 1 FROM table_seats ts WHERE ts.guest_id = g.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM invitees i WHERE i.guest_id = g.id
      )
    ORDER BY g.name
  `);
  return rows;
}

/**
 * Individually accepted invitees (approved + accepted) with no seat yet —
 * feeds the "Accepted invitees" seat-assignment picker and the Balance to
 * Arrange count. People belonging to a removed (soft-deleted) guest are left
 * out: their records are kept for RSVP history, but they are no longer coming,
 * so they must not be offered for a seat or counted as still to arrange
 * (Next Action 57 — the guest list side of this, listUnassignedGuests, has
 * always skipped removed guests).
 */
export async function listUnassignedInvitees() {
  if (!useDb) {
    const seated = new Set(
      seatingTables.flatMap((table) => table.seats.map((seat) => seat.inviteeId).filter(Boolean))
    );
    const removedGuestIds = new Set(
      guestStore.filter((guest) => guest.isDeleted === true).map((guest) => guest.id)
    );
    return invitees
      .filter(
        (invitee) =>
          invitee.approvalStatus === 'approved' &&
          invitee.rsvpStatus === 'accepted' &&
          !seated.has(invitee.id) &&
          !removedGuestIds.has(invitee.guestId)
      )
      .map((invitee) => ({
        id: invitee.id,
        name: invitee.name,
        guestId: invitee.guestId,
        guestName: guestNameFor(invitee.guestId),
      }))
      .sort((a, b) => (a.guestName || '').localeCompare(b.guestName || '') || a.name.localeCompare(b.name));
  }

  const { rows } = await query(`
    SELECT i.id, i.name, i.guest_id AS "guestId", g.name AS "guestName"
    FROM invitees i
    JOIN guests g ON g.id = i.guest_id
    WHERE i.approval_status = 'approved'
      AND i.rsvp_status = 'accepted'
      AND g.is_deleted = false
      AND NOT EXISTS (SELECT 1 FROM table_seats ts WHERE ts.invitee_id = i.id)
    ORDER BY g.name, i.name
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
  return rows.map((row) => ({
    ...mapGuestRow(row),
    table_number: row.table_number,
    seat_number: row.seat_number,
  }));
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

function memorySeatedProbableIds() {
  return new Set(
    seatingTables.flatMap((table) => table.seats.map((seat) => seat.probableAttendeeId).filter(Boolean))
  );
}

/**
 * ProbableAttendee buffer per RSVP bucket (declined | pending) — see
 * PRD §16. Always returns both buckets, even at zero, so the dashboard
 * doesn't need to special-case an empty bucket.
 */
export async function getProbableAttendanceSummary() {
  if (!useDb) {
    const seatedIds = memorySeatedProbableIds();
    return PROBABLE_BUCKETS.map((bucket) => {
      const slots = probableAttendees.filter((slot) => slot.bucket === bucket);
      const seatedCount = slots.filter((slot) => seatedIds.has(slot.id)).length;
      return {
        bucket,
        bufferCount: slots.length,
        seatedCount,
        unseatedCount: slots.length - seatedCount,
      };
    });
  }

  const { rows } = await query(`
    SELECT pa.rsvp_bucket AS bucket, COUNT(*)::int AS buffer_count, COUNT(ts.id)::int AS seated_count
    FROM probable_attendees pa
    LEFT JOIN table_seats ts ON ts.probable_attendee_id = pa.id
    GROUP BY pa.rsvp_bucket
  `);
  const byBucket = new Map(rows.map((row) => [row.bucket, row]));

  return PROBABLE_BUCKETS.map((bucket) => {
    const row = byBucket.get(bucket);
    const bufferCount = row ? row.buffer_count : 0;
    const seatedCount = row ? row.seated_count : 0;
    return { bucket, bufferCount, seatedCount, unseatedCount: bufferCount - seatedCount };
  });
}

/**
 * Resize a bucket's ProbableAttendee pool to exactly `count`. Raising it
 * appends new anonymous slots; lowering it removes unseated slots first
 * (highest slot_index first) and refuses to drop below the currently-seated
 * count — the Admin must unassign those seats first.
 */
export async function setProbableAttendeeBuffer(bucket, count) {
  if (!PROBABLE_BUCKETS.includes(bucket)) {
    throw new Error(`Unknown RSVP bucket: ${bucket}`);
  }
  const targetCount = Number(count);
  if (!Number.isInteger(targetCount) || targetCount < 0) {
    throw new Error(INVALID_BUFFER_COUNT);
  }

  if (!useDb) {
    const seatedIds = memorySeatedProbableIds();
    const current = probableAttendees.filter((slot) => slot.bucket === bucket);
    const seatedSlots = current.filter((slot) => seatedIds.has(slot.id));

    if (targetCount < seatedSlots.length) {
      throw new Error(BUFFER_BELOW_SEATED);
    }

    if (targetCount > current.length) {
      const maxIndex = current.reduce((max, slot) => Math.max(max, slot.slotIndex), 0);
      for (let i = 1; i <= targetCount - current.length; i += 1) {
        probableAttendees.push({ id: crypto.randomUUID(), bucket, slotIndex: maxIndex + i });
      }
    } else if (targetCount < current.length) {
      const removable = current
        .filter((slot) => !seatedIds.has(slot.id))
        .sort((a, b) => b.slotIndex - a.slotIndex);
      const removeIds = new Set(removable.slice(0, current.length - targetCount).map((slot) => slot.id));
      for (let i = probableAttendees.length - 1; i >= 0; i -= 1) {
        if (removeIds.has(probableAttendees[i].id)) probableAttendees.splice(i, 1);
      }
    }

    return getProbableAttendanceSummary();
  }

  const { rows: seatedRows } = await query(`
    SELECT COUNT(*)::int AS seated_count
    FROM probable_attendees pa
    JOIN table_seats ts ON ts.probable_attendee_id = pa.id
    WHERE pa.rsvp_bucket = $1
  `, [bucket]);
  const seatedCount = seatedRows[0]?.seated_count || 0;
  if (targetCount < seatedCount) {
    throw new Error(BUFFER_BELOW_SEATED);
  }

  const { rows: countRows } = await query(`
    SELECT COUNT(*)::int AS total, COALESCE(MAX(slot_index), 0) AS max_index
    FROM probable_attendees WHERE rsvp_bucket = $1
  `, [bucket]);
  const total = countRows[0]?.total || 0;
  const maxIndex = countRows[0]?.max_index || 0;

  if (targetCount > total) {
    const params = [bucket];
    const valueRows = [];
    for (let i = 1; i <= targetCount - total; i += 1) {
      params.push(maxIndex + i);
      valueRows.push(`($1, $${params.length})`);
    }
    await query(
      `INSERT INTO probable_attendees (rsvp_bucket, slot_index) VALUES ${valueRows.join(', ')}`,
      params
    );
  } else if (targetCount < total) {
    await query(`
      DELETE FROM probable_attendees
      WHERE id IN (
        SELECT pa.id FROM probable_attendees pa
        LEFT JOIN table_seats ts ON ts.probable_attendee_id = pa.id
        WHERE pa.rsvp_bucket = $1 AND ts.id IS NULL
        ORDER BY pa.slot_index DESC
        LIMIT $2
      )
    `, [bucket, total - targetCount]);
  }

  return getProbableAttendanceSummary();
}

/**
 * ProbableAttendee placeholders not currently seated — feeds the seat
 * assignment picker, grouped by bucket.
 */
export async function listUnassignedProbableAttendees() {
  if (!useDb) {
    const seatedIds = memorySeatedProbableIds();
    return [...probableAttendees]
      .filter((slot) => !seatedIds.has(slot.id))
      .sort((a, b) => a.bucket.localeCompare(b.bucket) || a.slotIndex - b.slotIndex)
      .map((slot) => ({
        id: slot.id,
        bucket: slot.bucket,
        slotIndex: slot.slotIndex,
        label: probableAttendeeLabel(slot.bucket, slot.slotIndex),
      }));
  }

  const { rows } = await query(`
    SELECT pa.id, pa.rsvp_bucket AS bucket, pa.slot_index AS "slotIndex"
    FROM probable_attendees pa
    WHERE NOT EXISTS (SELECT 1 FROM table_seats ts WHERE ts.probable_attendee_id = pa.id)
    ORDER BY pa.rsvp_bucket, pa.slot_index
  `);
  return rows.map((row) => ({ ...row, label: probableAttendeeLabel(row.bucket, row.slotIndex) }));
}

/**
 * PARTY-AWARE FUNCTIONS (2026-09-20, P1-14H)
 * Filter table arrangement data by party (bride or groom).
 */

/** Get all seating tables for a specific party. */
export async function listSeatingTablesByParty(party) {
  if (!useDb) {
    return [...seatingTables]
      .filter((t) => (t.assignedToParty ?? 'bride') === party)
      .sort((a, b) => a.table_number - b.table_number)
      .map(hydrateMemoryTable);
  }

  const { rows } = await query(`
    ${TABLE_SELECT}
    WHERE st.assigned_to_party = $1
    GROUP BY st.id, st.table_number, st.table_name, st.capacity
    ORDER BY st.table_number
  `, [party]);
  return rows;
}

/** Get unassigned guests for a specific party. */
export async function listUnassignedGuestsByParty(party) {
  if (!useDb) {
    const seatedIds = memorySeatedGuestIds();
    return [...guestStore]
      .filter((g) => (g.assignedToParty ?? 'bride') === party && g.rsvpStatus === 'accepted' && !seatedIds.has(g.id) && !g.isDeleted)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const { rows } = await query(`
    SELECT g.id, g.name, g.code, g.relationship, g.slot_count
    FROM guests g
    WHERE g.assigned_to_party = $1
      AND g.rsvp_status = 'accepted'
      AND NOT EXISTS (SELECT 1 FROM table_seats ts WHERE ts.guest_id = g.id)
      AND g.is_deleted = false
    ORDER BY g.created_at DESC
  `, [party]);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    relationship: row.relationship,
    slotCount: row.slot_count,
  }));
}

/** Get assigned guests for a specific party. */
export async function listAssignedGuestsByParty(party) {
  if (!useDb) {
    const seatedIds = memorySeatedGuestIds();
    return [...guestStore]
      .filter((g) => (g.assignedToParty ?? 'bride') === party && seatedIds.has(g.id) && !g.isDeleted)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const { rows } = await query(`
    SELECT DISTINCT g.id, g.name, g.code, g.relationship, g.slot_count
    FROM guests g
    INNER JOIN table_seats ts ON g.id = ts.guest_id
    WHERE g.assigned_to_party = $1 AND g.is_deleted = false
    ORDER BY g.created_at DESC
  `, [party]);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    relationship: row.relationship,
    slotCount: row.slot_count,
  }));
}
