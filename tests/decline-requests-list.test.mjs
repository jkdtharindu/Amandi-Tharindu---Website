import test from 'node:test';
import assert from 'node:assert/strict';

import { declineRequestSeats } from '../src/table-arrangement/declineRequests.js';

const seat = (id, extra = {}) => ({
  id,
  seatNumber: Number(id.slice(-1)),
  guestId: null,
  inviteeId: `inv-${id}`,
  inviteeName: `Person ${id}`,
  inviteeGuestName: `Person ${id}`,
  occupantSide: 'bride',
  occupantRsvpStatus: 'accepted',
  inviteeDeclineRequested: false,
  ...extra,
});

const tables = [
  { id: 't1', table_number: 1, table_name: 'Rose', side: 'bride', seats: [seat('s1', { inviteeDeclineRequested: true }), seat('s2')] },
  {
    id: 't2',
    table_number: 1,
    table_name: 'Shared',
    side: 'common',
    seats: [
      seat('s3', { inviteeDeclineRequested: true }),
      seat('s4', { inviteeDeclineRequested: true, occupantSide: 'groom' }),
    ],
  },
];

test('lists the seats whose person was asked to decline, with their table', () => {
  const requests = declineRequestSeats(tables, 'bride');
  assert.deepEqual(
    requests.map((request) => [request.tableId, request.seatId, request.name]),
    [['t1', 's1', 'Person s1'], ['t2', 's3', 'Person s3']]
  );
});

test('the other side\'s person at a Common table is not listed', () => {
  assert.ok(!declineRequestSeats(tables, 'bride').some((request) => request.seatId === 's4'));
  // The groom admin is only ever given the groom's own tables and the Common ones.
  assert.deepEqual(declineRequestSeats(tables.slice(1), 'groom').map((request) => request.seatId), ['s4']);
});

test('someone already declined is no longer a request', () => {
  const done = [{ ...tables[0], seats: [seat('s1', { inviteeDeclineRequested: true, occupantRsvpStatus: 'declined' })] }];
  assert.deepEqual(declineRequestSeats(done, 'bride'), []);
});
