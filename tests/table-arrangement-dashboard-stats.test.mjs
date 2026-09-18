import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDashboardStats } from '../src/table-arrangement/dashboardStats.js';

/**
 * The formula behind the Table Arrangement stat cards (Next Action 29).
 * It now runs on every post-action refresh as well as on page load, so it is
 * worth pinning down independently of either caller.
 */

const RSVP = { accepted: 5, declined: 2, pending: 3 };

function seat(inviteeId = null) {
  return { inviteeId };
}

test('an empty seating plan arranges nobody and leaves every unseated guest in the balance', () => {
  const stats = buildDashboardStats({
    tables: [],
    assignedGuests: [],
    unassignedGuests: [{}, {}],
    unassignedInvitees: [{}],
    rsvpStats: RSVP,
  });

  assert.deepEqual(stats, {
    accepted: 5,
    tableArranged: 0,
    balanceToArrange: 3,
    declined: 2,
    pending: 3,
  });
});

test('seated accepted guests and seated invitees both count as arranged', () => {
  const stats = buildDashboardStats({
    tables: [
      { seats: [seat('inv-1'), seat(), seat('inv-2')] },
      { seats: [seat('inv-3')] },
    ],
    assignedGuests: [{ rsvpStatus: 'accepted' }, { rsvpStatus: 'accepted' }],
    unassignedGuests: [],
    unassignedInvitees: [],
    rsvpStats: RSVP,
  });

  assert.equal(stats.tableArranged, 5, '2 guests + 3 invitees');
});

test('a seated guest who later declined no longer counts as arranged', () => {
  const stats = buildDashboardStats({
    tables: [],
    assignedGuests: [{ rsvpStatus: 'accepted' }, { rsvpStatus: 'declined' }],
    unassignedGuests: [],
    unassignedInvitees: [],
    rsvpStats: RSVP,
  });

  assert.equal(stats.tableArranged, 1);
});

test('seats holding a probable attendee or nobody do not count as arranged', () => {
  const stats = buildDashboardStats({
    tables: [{ seats: [seat(), seat(), { inviteeId: null, probableAttendeeId: 'pa-1' }] }],
    assignedGuests: [],
    unassignedGuests: [],
    unassignedInvitees: [],
    rsvpStats: RSVP,
  });

  assert.equal(stats.tableArranged, 0);
});

test('seating someone moves them from the balance into arranged', () => {
  const before = buildDashboardStats({
    tables: [{ seats: [seat()] }],
    assignedGuests: [],
    unassignedGuests: [{ rsvpStatus: 'accepted' }],
    unassignedInvitees: [],
    rsvpStats: RSVP,
  });
  const after = buildDashboardStats({
    tables: [{ seats: [seat()] }],
    assignedGuests: [{ rsvpStatus: 'accepted' }],
    unassignedGuests: [],
    unassignedInvitees: [],
    rsvpStats: RSVP,
  });

  assert.deepEqual([before.tableArranged, before.balanceToArrange], [0, 1]);
  assert.deepEqual([after.tableArranged, after.balanceToArrange], [1, 0]);
});
