import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadTableArrangementView } from '../src/table-arrangement/loadTableArrangementView.js';
import {
  createSeatingTable,
  assignGuestToSeat,
  assignInviteeToSeat,
} from '../src/table-arrangement/tableArrangementRepo.js';
import { createInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';

// The two stat rows on Table Arrangement: the signed-in side's and the whole
// wedding's. Runs the in-memory path (DATABASE_URL unset).
//
// Seeded wedding:
//   bride  b1  accepted, no named people, seated as a whole party   1 head
//   bride  b2  accepted, 2 named people: one seated, one not        2 heads
//   bride  b3  pending
//   bride  bx  accepted but removed — must count nowhere
//   groom  g1  accepted, 2 named people: one seated, one not        2 heads
//   groom  g2  declined

const GUESTS = [
  { id: 'b1', code: 'B-1', name: 'Bride Aunt', relationship: 'Family', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'bride' },
  { id: 'b2', code: 'B-2', name: 'Bride Friends', relationship: 'Friends', slotCount: 2, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'bride' },
  { id: 'b3', code: 'B-3', name: 'Bride Pending', relationship: 'Friends', slotCount: 1, rsvpStatus: 'pending', isDeleted: false, assignedToParty: 'bride' },
  { id: 'bx', code: 'B-X', name: 'Bride Removed', relationship: 'Friends', slotCount: 1, rsvpStatus: 'accepted', isDeleted: true, assignedToParty: 'bride' },
  { id: 'g1', code: 'G-1', name: 'Groom Family', relationship: 'Family', slotCount: 2, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'groom' },
  { id: 'g2', code: 'G-2', name: 'Groom Declined', relationship: 'Friends', slotCount: 1, rsvpStatus: 'declined', isDeleted: false, assignedToParty: 'groom' },
];

const RESPONSES = [
  { guestId: 'b1', attending: true, participantNames: ['Bride Aunt'] },
  { guestId: 'b2', attending: true, participantNames: ['Kamala', 'Nirmala'] },
  { guestId: 'bx', attending: true, participantNames: ['Gone'] },
  { guestId: 'g1', attending: true, participantNames: ['Sunil', 'Rani'] },
  { guestId: 'g2', attending: false, participantNames: [] },
];

async function acceptedPeople(guestId, names) {
  const created = await createInviteesForGuest(guestId, names);
  for (const person of created) person.rsvpStatus = 'accepted';
  return created;
}

beforeEach(async () => {
  seatingTables.length = 0;
  invitees.length = 0;
  guestStore.length = 0;
  guestStore.push(...GUESTS.map((guest) => ({ ...guest })));
  rsvpResponses.length = 0;
  rsvpResponses.push(...RESPONSES.map((response) => ({ ...response })));

  const [kamala] = await acceptedPeople('b2', ['Kamala', 'Nirmala']);
  const [sunil] = await acceptedPeople('g1', ['Sunil', 'Rani']);

  const brideTable = await createSeatingTable({ tableNumber: 1, capacity: 3, party: 'bride' });
  const groomTable = await createSeatingTable({ tableNumber: 1, capacity: 3, party: 'groom' });
  await assignGuestToSeat(brideTable.seats[0].id, 'b1');
  await assignInviteeToSeat(brideTable.seats[1].id, kamala.id);
  await assignInviteeToSeat(groomTable.seats[0].id, sunil.id);
});

test("the side's row counts that side's people only", async () => {
  const { dashboardStats } = await loadTableArrangementView('bride');

  assert.deepEqual(dashboardStats, {
    accepted: 3, // b1 (1) + b2 (2); the removed guest is not counted
    tableArranged: 2, // b1's party seat + Kamala
    balanceToArrange: 1, // Nirmala; the groom's unseated Rani is not the bride's to arrange
    declined: 0,
    pending: 1,
  });
});

test("the other side's row mirrors it", async () => {
  const { dashboardStats } = await loadTableArrangementView('groom');

  assert.deepEqual(dashboardStats, {
    accepted: 2,
    tableArranged: 1, // Sunil
    balanceToArrange: 1, // Rani
    declined: 1,
    pending: 0,
  });
});

test("the seat picker offers only the signed-in side's unseated people", async () => {
  const bride = await loadTableArrangementView('bride');
  const groom = await loadTableArrangementView('groom');

  assert.deepEqual(bride.unassignedInvitees.map((person) => person.name), ['Nirmala']);
  assert.deepEqual(groom.unassignedInvitees.map((person) => person.name), ['Rani']);
});

test("the side's RSVP Accepted is a number, not blank", async () => {
  const { dashboardStats } = await loadTableArrangementView('bride');
  assert.equal(typeof dashboardStats.accepted, 'number');
});

test('the wedding row covers both sides and counts seated people across every table', async () => {
  const { overallDashboardStats } = await loadTableArrangementView('bride');

  assert.deepEqual(overallDashboardStats, {
    accepted: 5, // 3 bride + 2 groom
    tableArranged: 3, // b1's party seat + Kamala + Sunil
    balanceToArrange: 2, // Nirmala + Rani — pending and declined guests are not waiting for a seat
    declined: 1,
    pending: 1,
  });
});

test('both sides see the same wedding row', async () => {
  const bride = await loadTableArrangementView('bride');
  const groom = await loadTableArrangementView('groom');

  assert.deepEqual(bride.overallDashboardStats, groom.overallDashboardStats);
});

test('seating someone moves them from Balance to Arrange to Table Arranged in both rows', async () => {
  const nirmala = invitees.find((person) => person.name === 'Nirmala');
  const brideTable = seatingTables.find((table) => table.assignedToParty === 'bride');
  await assignInviteeToSeat(brideTable.seats[2].id, nirmala.id);

  const { dashboardStats, overallDashboardStats } = await loadTableArrangementView('bride');

  assert.equal(dashboardStats.tableArranged, 3);
  assert.equal(dashboardStats.balanceToArrange, 0);
  assert.equal(overallDashboardStats.tableArranged, 4);
  assert.equal(overallDashboardStats.balanceToArrange, 1);
});
