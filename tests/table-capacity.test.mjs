import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSeatingTable,
  updateSeatingTable,
  assignGuestToSeat,
  userFacingStatus,
} from '../src/table-arrangement/tableArrangementRepo.js';
import { validateTableUpdate } from '../src/table-arrangement/tableSides.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { guestStore } from '../src/data/guestStore.js';

// Changing how many seats a table has, after it was created. In-memory path.

beforeEach(() => {
  seatingTables.length = 0;
  guestStore.length = 0;
  guestStore.push(
    { id: 'g1', code: 'A-1', name: 'Anula', relationship: 'Relations', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'bride' },
    { id: 'g2', code: 'A-2', name: 'Bandula', relationship: 'Relations', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'bride' },
  );
});

test('adding seats keeps everyone seated and numbers the new seats after the last', async () => {
  const table = await createSeatingTable({ tableNumber: 1, tableName: 'Rose', capacity: 4 });
  await assignGuestToSeat(table.seats[1].id, 'g1');

  const updated = await updateSeatingTable(table.id, { capacity: 6 });

  assert.equal(updated.capacity, 6);
  assert.deepEqual(updated.seats.map((seat) => seat.seatNumber), [1, 2, 3, 4, 5, 6]);
  assert.equal(updated.seats[1].guestId, 'g1', 'the seated guest has not moved');
});

test('removing seats drops only empty ones and never unseats anyone', async () => {
  const table = await createSeatingTable({ tableNumber: 1, tableName: 'Rose', capacity: 6 });
  // The last two seats are taken, so shrinking must remove empty seats from the middle.
  await assignGuestToSeat(table.seats[4].id, 'g1');
  await assignGuestToSeat(table.seats[5].id, 'g2');

  const updated = await updateSeatingTable(table.id, { capacity: 3 });

  assert.equal(updated.seats.length, 3);
  assert.equal(updated.capacity, 3);
  const seated = updated.seats.filter((seat) => seat.guestId).map((seat) => seat.guestId).sort();
  assert.deepEqual(seated, ['g1', 'g2'], 'both guests are still seated');
});

test('fewer seats than people seated is refused, and nothing changes', async () => {
  const table = await createSeatingTable({ tableNumber: 1, tableName: 'Rose', capacity: 4 });
  await assignGuestToSeat(table.seats[0].id, 'g1');
  await assignGuestToSeat(table.seats[1].id, 'g2');

  await assert.rejects(updateSeatingTable(table.id, { capacity: 1 }), (error) => {
    assert.equal(userFacingStatus(error), 409, 'a conflict the admin can fix by moving someone');
    return true;
  });
  assert.equal(seatingTables[0].seats.length, 4);
  assert.equal(seatingTables[0].capacity, 4);

  const exact = await updateSeatingTable(table.id, { capacity: 2 });
  assert.equal(exact.seats.length, 2, 'down to exactly the number seated is fine');
});

test('a name and a seat count can change together, and a bad name leaves the seats alone', async () => {
  const table = await createSeatingTable({ tableNumber: 1, tableName: 'Rose', capacity: 4 });
  await createSeatingTable({ tableNumber: 2, tableName: 'Lotus', capacity: 4 });

  const both = await updateSeatingTable(table.id, { tableName: 'Orchid', capacity: 8 });
  assert.equal(both.table_name, 'Orchid');
  assert.equal(both.seats.length, 8);

  await assert.rejects(updateSeatingTable(table.id, { tableName: 'Lotus', capacity: 2 }), /name already exists/);
  assert.equal(seatingTables.find((entry) => entry.id === table.id).seats.length, 8);
});

test('the edit form check accepts a seat count and rejects nonsense', () => {
  assert.deepEqual(validateTableUpdate({ capacity: '12' }, 'bride'), { ok: true, value: { capacity: 12 } });
  assert.equal(validateTableUpdate({ capacity: 0 }, 'bride').ok, false);
  assert.equal(validateTableUpdate({ capacity: 101 }, 'bride').ok, false);
  assert.equal(validateTableUpdate({ capacity: 2.5 }, 'bride').ok, false);
  assert.equal(validateTableUpdate({}, 'bride').ok, false, 'an empty edit is still "nothing to change"');
});
