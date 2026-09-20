import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { seatOccupantLabel } from '../src/table-arrangement/seatLabel.js';
import {
  createSeatingTable,
  assignGuestToSeat,
  assignInviteeToSeat,
  listSeatingTables,
} from '../src/table-arrangement/tableArrangementRepo.js';
import { createInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';

// Two families can each have a person called "Nimal". The seat chart used to show
// just "Nimal" for both, so an admin could not tell whose Nimal was on which seat.
// A seated invitee is now shown as "Name (Party)", matching the seat picker.
// There is no Postgres in the test environment, so the repo checks run against the
// in-memory stores; the SQL adds one LEFT JOIN and one field and is not covered here.

beforeEach(() => {
  seatingTables.length = 0;
  invitees.length = 0;
  guestStore.length = 0;
  guestStore.push(
    { id: 'g1', code: 'A-001', name: 'Silva Family', relationship: 'Family', slotCount: 1, whatsappNumber: null, email: null, rsvpStatus: 'accepted', isDeleted: false, hasVisited: false },
    { id: 'g2', code: 'A-002', name: 'Colleagues', relationship: 'Friend', slotCount: 1, whatsappNumber: null, email: null, rsvpStatus: 'accepted', isDeleted: false, hasVisited: false }
  );
});

test('an invitee is labelled with the party they belong to', () => {
  assert.equal(
    seatOccupantLabel({ inviteeName: 'Nimal', inviteeGuestName: 'Silva Family' }),
    'Nimal (Silva Family)'
  );
});

test('a whole-guest seat is labelled with the guest name and no brackets', () => {
  assert.equal(seatOccupantLabel({ guestName: 'Silva Family' }), 'Silva Family');
});

test('an invitee whose party is unknown falls back to the bare name', () => {
  assert.equal(seatOccupantLabel({ inviteeName: 'Nimal', inviteeGuestName: null }), 'Nimal');
});

test('a probable-attendance placeholder keeps its own label', () => {
  assert.equal(
    seatOccupantLabel({ probableAttendeeLabel: 'Probable (Pending) #2' }),
    'Probable (Pending) #2'
  );
});

test('an empty seat has no label', () => {
  assert.equal(seatOccupantLabel({}), null);
});

test('two people with the same name in different parties get different labels on the chart', async () => {
  const [silvaNimal] = await createInviteesForGuest('g1', ['Nimal']);
  const [colleagueNimal] = await createInviteesForGuest('g2', ['Nimal']);
  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  await assignInviteeToSeat(table.seats[0].id, silvaNimal.id);
  await assignInviteeToSeat(table.seats[1].id, colleagueNimal.id);

  const [listed] = await listSeatingTables();
  const labels = listed.seats.map(seatOccupantLabel);

  assert.deepEqual(labels, ['Nimal (Silva Family)', 'Nimal (Colleagues)']);
});

test('the chart data carries the party name for a seated invitee and none for a whole-guest seat', async () => {
  const [nimal] = await createInviteesForGuest('g1', ['Nimal']);
  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  await assignInviteeToSeat(table.seats[0].id, nimal.id);
  await assignGuestToSeat(table.seats[1].id, 'g2');

  const [listed] = await listSeatingTables();

  assert.equal(listed.seats[0].inviteeGuestName, 'Silva Family');
  assert.equal(listed.seats[1].inviteeGuestName, null);
  assert.equal(listed.seats[1].guestName, 'Colleagues');
});

test('a person who is their own party (a party of one) is not repeated in brackets', async () => {
  const { seatOccupantLabel } = await import('../src/table-arrangement/seatLabel.js');
  assert.equal(
    seatOccupantLabel({ inviteeName: 'Ruwan Solo', inviteeGuestName: 'Ruwan Solo' }),
    'Ruwan Solo'
  );
});
