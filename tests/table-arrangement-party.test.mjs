import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSeatingTable,
  assignGuestToSeat,
  listSeatingTablesByParty,
  listUnassignedGuestsByParty,
  listAssignedGuestsByParty,
} from '../src/table-arrangement/tableArrangementRepo.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';
import { createInviteesForGuest } from '../src/invitees/inviteesRepo.js';

// The party-aware Table Arrangement functions (P1-14H, multi-admin).
//
// These had no test at all when they were written, and two faults survived
// because of it (TASKS.md Action 69): they called a `memorySeatedGuestIds()`
// helper nobody had written, so the in-memory path threw a ReferenceError
// rather than returning anything; and the unassigned list forgot the rule that
// a party with named people is seated one person at a time, not as a block.
//
// Everything here runs the in-memory path (DATABASE_URL unset), which is what
// the throwaway dev server used for click-testing runs on.

const SEEDED_GUESTS = [
  { id: 'b1', code: 'B-001', name: 'Bride Aunt', relationship: 'Family', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'bride' },
  { id: 'b2', code: 'B-002', name: 'Bride Friend', relationship: 'Friend', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'bride' },
  { id: 'g1', code: 'G-001', name: 'Groom Uncle', relationship: 'Family', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'groom' },
  { id: 'b3', code: 'B-003', name: 'Bride Pending', relationship: 'Friend', slotCount: 1, rsvpStatus: 'pending', isDeleted: false, assignedToParty: 'bride' },
  { id: 'b4', code: 'B-004', name: 'Bride Removed', relationship: 'Friend', slotCount: 1, rsvpStatus: 'accepted', isDeleted: true, assignedToParty: 'bride' },
  // No assignedToParty at all: every guest created before migration 020 looks
  // like this, and the column defaults to the bride.
  { id: 'old', code: 'B-OLD', name: 'Legacy Guest', relationship: 'Family', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false },
];

function resetStores() {
  seatingTables.length = 0;
  guestStore.length = 0;
  guestStore.push(...SEEDED_GUESTS.map((guest) => ({ ...guest })));
  invitees.length = 0;
}

test('listUnassignedGuestsByParty returns that side only, without throwing', async () => {
  resetStores();

  const bride = await listUnassignedGuestsByParty('bride');
  const groom = await listUnassignedGuestsByParty('groom');

  assert.deepEqual(
    bride.map((g) => g.id).sort(),
    ['b1', 'b2', 'old'],
    'accepted, unseated, not removed, bride side (including the legacy guest)'
  );
  assert.deepEqual(groom.map((g) => g.id), ['g1']);
});

test('a guest with no party recorded counts as the bride', async () => {
  resetStores();

  const bride = await listUnassignedGuestsByParty('bride');
  const groom = await listUnassignedGuestsByParty('groom');

  assert.ok(bride.some((g) => g.id === 'old'));
  assert.ok(!groom.some((g) => g.id === 'old'));
});

test('a seated party drops off its side\'s unassigned list', async () => {
  resetStores();
  const table = await createSeatingTable({ tableNumber: 1, capacity: 2, party: 'bride' });
  await assignGuestToSeat(table.seats[0].id, 'b1');

  const bride = await listUnassignedGuestsByParty('bride');
  assert.ok(!bride.some((g) => g.id === 'b1'), 'b1 is seated, so it is no longer waiting');
  assert.ok(bride.some((g) => g.id === 'b2'));
});

test('a party with named people is not offered as a whole party', async () => {
  resetStores();
  // Those people are seated one at a time through listUnassignedInvitees, so
  // offering the party as a block too would let them be seated twice.
  await createInviteesForGuest('b1', ['Bride Aunt', 'Her Husband']);

  const bride = await listUnassignedGuestsByParty('bride');
  assert.ok(!bride.some((g) => g.id === 'b1'), 'b1 has named people');
  assert.ok(bride.some((g) => g.id === 'b2'), 'b2 has none, so it still appears');
});

test('listAssignedGuestsByParty returns that side\'s seated guests, without throwing', async () => {
  resetStores();
  const brideTable = await createSeatingTable({ tableNumber: 1, capacity: 2, party: 'bride' });
  const groomTable = await createSeatingTable({ tableNumber: 1, capacity: 2, party: 'groom' });
  await assignGuestToSeat(brideTable.seats[0].id, 'b1');
  await assignGuestToSeat(groomTable.seats[0].id, 'g1');

  const bride = await listAssignedGuestsByParty('bride');
  const groom = await listAssignedGuestsByParty('groom');

  assert.deepEqual(bride.map((g) => g.id), ['b1']);
  assert.deepEqual(groom.map((g) => g.id), ['g1']);
});

test('listSeatingTablesByParty keeps each side\'s tables apart', async () => {
  resetStores();
  await createSeatingTable({ tableNumber: 1, capacity: 2, party: 'bride' });
  await createSeatingTable({ tableNumber: 1, capacity: 2, party: 'groom' });

  const bride = await listSeatingTablesByParty('bride');
  const groom = await listSeatingTablesByParty('groom');

  assert.equal(bride.length, 1);
  assert.equal(groom.length, 1);
  // Migration 022 lets both sides have a "Table 1"; they must not merge.
  assert.equal(bride[0].table_number, 1);
  assert.equal(groom[0].table_number, 1);
  assert.notEqual(bride[0].id, groom[0].id);
});
