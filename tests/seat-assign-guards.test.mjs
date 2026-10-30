import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSeatingTable,
  assignGuestToSeat,
  assignInviteeToSeat,
  isUserFacingError,
} from '../src/table-arrangement/tableArrangementRepo.js';
import { createInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';

// Who may be put on a seat (Action 61, finding 2). Runs the in-memory path.
// Party "p1" has accepted; its people are Asha (accepted), Binu (declined) and
// Chamari (named but not yet approved by the admin).

let table;
let asha;
let binu;
let chamari;

beforeEach(async () => {
  seatingTables.length = 0;
  invitees.length = 0;
  guestStore.length = 0;
  guestStore.push(
    { id: 'p1', code: 'P-1', name: 'Party One', relationship: 'Family', slotCount: 3, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'bride' },
    { id: 'gone', code: 'P-2', name: 'Removed Guest', relationship: 'Family', slotCount: 1, rsvpStatus: 'accepted', isDeleted: true, assignedToParty: 'bride' }
  );
  [asha, binu] = await createInviteesForGuest('p1', ['Asha', 'Binu']);
  [chamari] = await createInviteesForGuest('p1', ['Chamari'], { addedBy: 'guest', approvalStatus: 'pending' });
  asha.rsvpStatus = 'accepted';
  binu.rsvpStatus = 'declined';
  table = await createSeatingTable({ tableNumber: 1, tableName: 'Rose', capacity: 4, party: 'bride' });
});

test('an accepted person can be seated', async () => {
  const seat = await assignInviteeToSeat(table.seats[0].id, asha.id);
  assert.equal(seat.invitee_id, asha.id);
});

test('a person who declined cannot be seated, even though their party accepted', async () => {
  await assert.rejects(() => assignInviteeToSeat(table.seats[0].id, binu.id), (error) => {
    assert.match(error.message, /declined/);
    assert.ok(isUserFacingError(error), 'the admin sees this message');
    return true;
  });
});

test('a person the admin has not approved cannot be seated', async () => {
  await assert.rejects(() => assignInviteeToSeat(table.seats[0].id, chamari.id), /no longer exists/);
});

test('a removed guest cannot be seated', async () => {
  await assert.rejects(() => assignGuestToSeat(table.seats[0].id, 'gone'), /removed/);
});

test('seating on a seat that does not exist reports nothing seated, not success', async () => {
  assert.equal(await assignGuestToSeat('no-such-seat', 'p1'), null);
  assert.equal(await assignInviteeToSeat('no-such-seat', asha.id), null);
});

// The SQL path, through a fake query function: the checks must read the person's own
// answer and approval, not only their party's.
function fakeExec(inviteeRow) {
  const statements = [];
  const exec = async (sql) => {
    statements.push(sql.trim());
    if (/^SELECT i.id, i.approval_status/.test(sql.trim())) return { rows: [inviteeRow] };
    return { rows: [{ id: 'seat-1', seat_number: 1, invitee_id: 'i-1' }] };
  };
  return { exec, statements };
}

const ROW = { approval_status: 'approved', invitee_rsvp_status: 'accepted', is_deleted: false, rsvp_status: 'accepted' };

test('SQL path: an accepted, approved person is seated', async () => {
  const { exec } = fakeExec(ROW);
  assert.equal((await assignInviteeToSeat('seat-1', 'i-1', {}, exec)).invitee_id, 'i-1');
});

test('SQL path: a person who declined on their own is refused, and nothing is updated', async () => {
  const { exec, statements } = fakeExec({ ...ROW, invitee_rsvp_status: 'declined' });
  await assert.rejects(() => assignInviteeToSeat('seat-1', 'i-1', {}, exec), /declined/);
  assert.ok(!statements.some((sql) => sql.startsWith('UPDATE')));
});

test('SQL path: a person not yet approved is refused', async () => {
  const { exec } = fakeExec({ ...ROW, approval_status: 'pending' });
  await assert.rejects(() => assignInviteeToSeat('seat-1', 'i-1', {}, exec), /no longer exists/);
});
