import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { loadDashboardStats } from '../src/admin/loadDashboardStats.js';
import { guestStore } from '../src/data/guestStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';
import { invitees as inviteesStore } from '../src/data/inviteesStore.js';

// The RSVP dashboard's "Your Party" and "Overall (Both Parties)" rows.
// Runs the in-memory path (DATABASE_URL unset).

const GUESTS = [
  { id: 'b1', code: 'B-1', name: 'Bride Aunt', relationship: 'Family', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'bride' },
  { id: 'b2', code: 'B-2', name: 'Bride Pending', relationship: 'Friends', slotCount: 1, rsvpStatus: 'pending', isDeleted: false, assignedToParty: 'bride' },
  { id: 'bx', code: 'B-X', name: 'Bride Removed', relationship: 'Friends', slotCount: 1, rsvpStatus: 'accepted', isDeleted: true, assignedToParty: 'bride' },
  { id: 'g1', code: 'G-1', name: 'Groom Family', relationship: 'Family', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false, assignedToParty: 'groom' },
  { id: 'g2', code: 'G-2', name: 'Groom Declined', relationship: 'Friends', slotCount: 1, rsvpStatus: 'declined', isDeleted: false, assignedToParty: 'groom' },
];

const RESPONSES = [
  { guestId: 'b1', attending: true, participantNames: ['Bride Aunt', 'Plus One'] },
  { guestId: 'bx', attending: true, participantNames: ['Gone'] },
  { guestId: 'g1', attending: true, participantNames: ['Sunil'] },
  { guestId: 'g2', attending: false, participantNames: [] },
];

beforeEach(() => {
  guestStore.length = 0;
  guestStore.push(...GUESTS.map((guest) => ({ ...guest })));
  rsvpResponses.length = 0;
  rsvpResponses.push(...RESPONSES.map((response) => ({ ...response })));
});

test("the side's row counts that side's guests only, a removed guest excluded", async () => {
  const { sideStats } = await loadDashboardStats('bride');

  assert.deepEqual(sideStats, {
    totalInvited: 2, // b1, b2 — not the removed bx
    accepted: 1,
    acceptedHeadcount: 2,
    declined: 0,
    pending: 1,
  });
});

test("the other side's row mirrors it", async () => {
  const { sideStats } = await loadDashboardStats('groom');

  assert.deepEqual(sideStats, {
    totalInvited: 2,
    accepted: 1,
    acceptedHeadcount: 1,
    declined: 1,
    pending: 0,
  });
});

test('the code table counts people per code: half declined, headcount-only, removed code left out', async () => {
  inviteesStore.length = 0;
  inviteesStore.push(
    { id: 'i1', guestId: 'b1', name: 'A', rsvpStatus: 'accepted', approvalStatus: 'approved' },
    { id: 'i2', guestId: 'b1', name: 'B', rsvpStatus: 'declined', approvalStatus: 'approved' },
    { id: 'i3', guestId: 'b1', name: 'C', rsvpStatus: 'pending', approvalStatus: 'approved' },
    { id: 'i4', guestId: 'b1', name: 'D', rsvpStatus: 'pending', approvalStatus: 'pending_approval' },
  );

  const { overallBreakdown } = await loadDashboardStats('bride');
  const byCode = Object.fromEntries(overallBreakdown.rows.map((row) => [row.code, row]));

  assert.deepEqual(byCode['B-1'], { code: 'B-1', name: 'Bride Aunt', invited: 3, accepted: 1, declined: 1, pending: 1 });
  assert.equal(byCode['B-X'], undefined);
  assert.equal(byCode['G-2'].declined, 1); // headcount-only, declined as a party
  assert.equal(byCode['B-2'].pending, 1);
  assert.deepEqual(overallBreakdown.totals, { codes: 4, invited: 6, accepted: 2, declined: 2, pending: 2, codesPending: 1 });
  inviteesStore.length = 0;
});

test('the overall row covers both sides and matches the sum of the two side rows', async () => {
  const bride = await loadDashboardStats('bride');
  const groom = await loadDashboardStats('groom');

  assert.deepEqual(bride.overallStats, {
    totalInvited: 4,
    accepted: 2,
    acceptedHeadcount: 3,
    declined: 1,
    pending: 1,
  });
  assert.deepEqual(bride.overallStats, groom.overallStats, 'both sides see the same wedding total');
  assert.equal(bride.overallStats.totalInvited, bride.sideStats.totalInvited + groom.sideStats.totalInvited);
});
