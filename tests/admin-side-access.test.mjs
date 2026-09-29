import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  guestIsOnSide,
  inviteeIsOnSide,
  tableIsOnSide,
  seatIsOnSideTable,
  visibleTableSide,
  seatOccupantSide,
} from '../src/admin/sideAccess.js';
import {
  createSeatingTable,
  assignGuestToSeat,
  assignInviteeToSeat,
  assignProbableAttendeeToSeat,
  setProbableAttendeeBuffer,
  listUnassignedProbableAttendees,
} from '../src/table-arrangement/tableArrangementRepo.js';
import { createInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { probableAttendees } from '../src/data/probableAttendeesStore.js';

// The checks every by-id admin route runs before acting: an id from the other
// side must look exactly like an id that does not exist. In-memory path, plus
// the SQL path through a fake query function.

let brideTable;
let groomTable;
let commonTable;
let kamala;
let sunil;

beforeEach(async () => {
  seatingTables.length = 0;
  invitees.length = 0;
  probableAttendees.length = 0;
  guestStore.length = 0;
  guestStore.push(
    { id: 'b1', code: 'B-1', name: 'Perera Family', relationship: 'Relations', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'bride' },
    { id: 'old', code: 'B-OLD', name: 'Legacy Guest', relationship: 'Relations', slotCount: 1, rsvpStatus: 'pending', isDeleted: false },
    { id: 'g1', code: 'G-1', name: 'Fernando Family', relationship: 'Relations', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'groom' }
  );
  [kamala] = await createInviteesForGuest('b1', ['Kamala']);
  [sunil] = await createInviteesForGuest('g1', ['Sunil']);
  brideTable = await createSeatingTable({ tableNumber: 1, capacity: 2, party: 'bride' });
  groomTable = await createSeatingTable({ tableNumber: 1, capacity: 2, party: 'groom' });
  commonTable = await createSeatingTable({ tableNumber: 1, tableName: 'Lotus', capacity: 4, party: 'common' });
});

test("a guest is on their own side only; a guest with no side recorded is the bride's", async () => {
  assert.equal(await guestIsOnSide('b1', 'bride'), true);
  assert.equal(await guestIsOnSide('b1', 'groom'), false);
  assert.equal(await guestIsOnSide('g1', 'groom'), true);
  assert.equal(await guestIsOnSide('g1', 'bride'), false);
  assert.equal(await guestIsOnSide('old', 'bride'), true);
  assert.equal(await guestIsOnSide('old', 'groom'), false);
  assert.equal(await guestIsOnSide('nobody', 'bride'), false);
});

test("an invitee is on their party's side", async () => {
  assert.equal(await inviteeIsOnSide(kamala.id, 'bride'), true);
  assert.equal(await inviteeIsOnSide(kamala.id, 'groom'), false);
  assert.equal(await inviteeIsOnSide(sunil.id, 'groom'), true);
  assert.equal(await inviteeIsOnSide(sunil.id, 'bride'), false);
  assert.equal(await inviteeIsOnSide('nobody', 'bride'), false);
});

test('a table is on the side it was created for', async () => {
  assert.equal(await tableIsOnSide(brideTable.id, 'bride'), true);
  assert.equal(await tableIsOnSide(brideTable.id, 'groom'), false);
  assert.equal(await tableIsOnSide(groomTable.id, 'groom'), true);
  assert.equal(await tableIsOnSide('nowhere', 'bride'), false);
  // A Common table is neither side's own table (Action 68).
  assert.equal(await tableIsOnSide(commonTable.id, 'bride'), false);
  assert.equal(await tableIsOnSide(commonTable.id, 'groom'), false);
});

test("a side sees its own tables and Common tables, never the other side's (Action 68)", async () => {
  assert.equal(await visibleTableSide(brideTable.id, 'bride'), 'bride');
  assert.equal(await visibleTableSide(brideTable.id, 'groom'), null, "the groom cannot reach the bride's table");
  assert.equal(await visibleTableSide(groomTable.id, 'bride'), null, "the bride cannot reach the groom's table");
  assert.equal(await visibleTableSide(commonTable.id, 'bride'), 'common');
  assert.equal(await visibleTableSide(commonTable.id, 'groom'), 'common');
  assert.equal(await visibleTableSide('nowhere', 'bride'), null);
});

test("a seat counts only on its own table, and only for that table's side", async () => {
  const brideSeat = brideTable.seats[0].id;
  const groomSeat = groomTable.seats[0].id;

  assert.equal(await seatIsOnSideTable(brideTable.id, brideSeat, 'bride'), true);
  assert.equal(await seatIsOnSideTable(brideTable.id, brideSeat, 'groom'), false, "the groom cannot touch the bride's seat");
  assert.equal(await seatIsOnSideTable(brideTable.id, groomSeat, 'bride'), false, "the groom's seat under the bride's table id");
  assert.equal(await seatIsOnSideTable(brideTable.id, 'no-seat', 'bride'), false);

  const brideTable2 = await createSeatingTable({ tableNumber: 2, capacity: 2, party: 'bride' });
  assert.equal(
    await seatIsOnSideTable(brideTable.id, brideTable2.seats[0].id, 'bride'),
    false,
    'a seat from another table, even on the same side, does not belong to this table'
  );
});

test("both sides reach a Common table's seats, still only through that table (Action 68)", async () => {
  const commonSeat = commonTable.seats[0].id;

  assert.equal(await seatIsOnSideTable(commonTable.id, commonSeat, 'bride'), true);
  assert.equal(await seatIsOnSideTable(commonTable.id, commonSeat, 'groom'), true);
  assert.equal(
    await seatIsOnSideTable(commonTable.id, groomTable.seats[0].id, 'bride'),
    false,
    "the groom's seat under the Common table's id"
  );
  assert.equal(
    await seatIsOnSideTable(brideTable.id, commonSeat, 'groom'),
    false,
    "a Common seat under the bride's table id"
  );
});

test("a seat's occupant side is their party's side; a placeholder or an empty seat has none", async () => {
  await assignInviteeToSeat(commonTable.seats[0].id, kamala.id);
  await assignGuestToSeat(commonTable.seats[1].id, 'g1');
  await setProbableAttendeeBuffer('pending', 1);
  const [slot] = await listUnassignedProbableAttendees();
  await assignProbableAttendeeToSeat(commonTable.seats[2].id, slot.id);

  assert.equal(await seatOccupantSide(commonTable.seats[0].id), 'bride', "Kamala is in the bride's party");
  assert.equal(await seatOccupantSide(commonTable.seats[1].id), 'groom');
  assert.equal(await seatOccupantSide(commonTable.seats[2].id), null, 'a placeholder belongs to no side');
  assert.equal(await seatOccupantSide(commonTable.seats[3].id), null, 'an empty seat');
  assert.equal(await seatOccupantSide('no-seat'), null);
});

test('the SQL path passes the side as a parameter and answers from the database', async () => {
  const calls = [];
  const found = async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ '?column?': 1 }] };
  };
  const missing = async () => ({ rows: [] });

  assert.equal(await guestIsOnSide('id-1', 'groom', found), true);
  assert.equal(await inviteeIsOnSide('id-2', 'groom', found), true);
  assert.equal(await tableIsOnSide('id-3', 'groom', found), true);
  assert.equal(await seatIsOnSideTable('table-4', 'seat-4', 'groom', found), true);
  for (const call of calls) {
    assert.match(call.sql, /assigned_to_party = \$\d/);
    assert.ok(call.params.includes('groom'));
  }

  assert.equal(await guestIsOnSide('id-1', 'groom', missing), false);
  assert.equal(await seatIsOnSideTable('table-4', 'seat-4', 'groom', missing), false);
});

test('the SQL path opens Common tables to both sides, and only the table and seat checks (Action 68)', async () => {
  const sqlOf = async (check) => {
    let seen = '';
    await check(async (sql) => {
      seen = sql;
      return { rows: [{ side: 'common' }] };
    });
    return seen;
  };

  // The table and seat checks let a Common table through as well as the side's own.
  assert.match(await sqlOf((run) => seatIsOnSideTable('t', 's', 'bride', run)), /assigned_to_party = 'common'/);
  assert.match(await sqlOf((run) => visibleTableSide('t', 'bride', run)), /assigned_to_party = 'common'/);
  // Whose people may be seated never widens: a guest, an invitee and an own-table check stay exact.
  assert.doesNotMatch(await sqlOf((run) => guestIsOnSide('g', 'bride', run)), /common/);
  assert.doesNotMatch(await sqlOf((run) => inviteeIsOnSide('i', 'bride', run)), /common/);
  assert.doesNotMatch(await sqlOf((run) => tableIsOnSide('t', 'bride', run)), /common/);

  assert.equal(await visibleTableSide('t', 'bride', async () => ({ rows: [{ side: 'common' }] })), 'common');
  assert.equal(await visibleTableSide('t', 'bride', async () => ({ rows: [] })), null);
  assert.equal(await seatOccupantSide('s', async () => ({ rows: [{ side: 'groom' }] })), 'groom');
  assert.equal(await seatOccupantSide('s', async () => ({ rows: [{ side: null }] })), null);
});

test('a malformed id reads as not found; any other database error still surfaces', async () => {
  const malformed = async () => {
    throw Object.assign(new Error('invalid input syntax for type uuid'), { code: '22P02' });
  };
  const down = async () => {
    throw Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
  };

  assert.equal(await guestIsOnSide('not-a-uuid', 'bride', malformed), false);
  assert.equal(await tableIsOnSide('not-a-uuid', 'bride', malformed), false);
  assert.equal(await visibleTableSide('not-a-uuid', 'bride', malformed), null);
  assert.equal(await seatOccupantSide('not-a-uuid', malformed), null);
  await assert.rejects(guestIsOnSide('id', 'bride', down), /connection refused/);
});
