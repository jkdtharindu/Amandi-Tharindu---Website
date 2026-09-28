import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { guestIsOnSide, inviteeIsOnSide, tableIsOnSide, seatIsOnSideTable } from '../src/admin/sideAccess.js';
import { createSeatingTable } from '../src/table-arrangement/tableArrangementRepo.js';
import { createInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';

// The checks every by-id admin route runs before acting: an id from the other
// side must look exactly like an id that does not exist. In-memory path, plus
// the SQL path through a fake query function.

let brideTable;
let groomTable;
let kamala;
let sunil;

beforeEach(async () => {
  seatingTables.length = 0;
  invitees.length = 0;
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

test('a malformed id reads as not found; any other database error still surfaces', async () => {
  const malformed = async () => {
    throw Object.assign(new Error('invalid input syntax for type uuid'), { code: '22P02' });
  };
  const down = async () => {
    throw Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
  };

  assert.equal(await guestIsOnSide('not-a-uuid', 'bride', malformed), false);
  assert.equal(await tableIsOnSide('not-a-uuid', 'bride', malformed), false);
  await assert.rejects(guestIsOnSide('id', 'bride', down), /connection refused/);
});
