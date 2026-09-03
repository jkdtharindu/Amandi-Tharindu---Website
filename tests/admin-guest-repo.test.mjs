import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeRsvpStats,
  filterGuests,
  guestsToCsv,
} from '../src/admin/guestQueries.js';

const GUESTS = [
  {
    id: 'g1',
    code: 'NIMAL-001',
    name: 'Nimal Silva',
    relationship: 'Relations',
    slotCount: 2,
    rsvpStatus: 'accepted',
    whatsappNumber: '+94123456789',
    isDeleted: false,
  },
  {
    id: 'g2',
    code: 'KAMALA-001',
    name: 'Kamala Fernando',
    relationship: 'Friends',
    slotCount: 1,
    rsvpStatus: 'declined',
    whatsappNumber: null,
    isDeleted: false,
  },
  {
    id: 'g3',
    code: 'RUWAN-001',
    name: 'Ruwan Perera',
    relationship: 'Neighbours',
    slotCount: 1,
    rsvpStatus: 'pending',
    whatsappNumber: null,
    isDeleted: false,
  },
  {
    id: 'g4',
    code: 'SUNIL-001',
    name: 'Sunil Bandara',
    relationship: 'Colleagues',
    slotCount: 3,
    rsvpStatus: 'accepted',
    whatsappNumber: null,
    isDeleted: false,
  },
  {
    id: 'g5',
    code: 'OLD-001',
    name: 'Removed Guest',
    relationship: 'Friends',
    slotCount: 1,
    rsvpStatus: 'pending',
    whatsappNumber: null,
    isDeleted: true,
  },
];

const RESPONSES = [
  { guestId: 'g1', attending: true, participantNames: ['Nimal Silva', 'Anu Silva'] },
  { guestId: 'g2', attending: false, participantNames: [] },
  { guestId: 'g4', attending: true, participantNames: ['Sunil Bandara'] },
];

test('filterGuests excludes soft-deleted guests by default', () => {
  const result = filterGuests(GUESTS, {});
  assert.equal(result.length, 4);
  assert.ok(!result.some((g) => g.isDeleted));
});

test('filterGuests filters by RSVP status', () => {
  const accepted = filterGuests(GUESTS, { status: 'accepted' });
  assert.deepEqual(accepted.map((g) => g.code).sort(), ['NIMAL-001', 'SUNIL-001']);
});

test('filterGuests treats the "all" status as no status filter', () => {
  assert.equal(filterGuests(GUESTS, { status: 'all' }).length, 4);
});

test('filterGuests filters by relationship group', () => {
  const friends = filterGuests(GUESTS, { relationship: 'Friends' });
  assert.deepEqual(friends.map((g) => g.code), ['KAMALA-001']);
});

test('filterGuests searches by name, case-insensitively and partially', () => {
  assert.deepEqual(filterGuests(GUESTS, { search: 'silva' }).map((g) => g.code), [
    'NIMAL-001',
  ]);
});

test('filterGuests searches by code', () => {
  assert.deepEqual(filterGuests(GUESTS, { search: 'RUWAN' }).map((g) => g.code), [
    'RUWAN-001',
  ]);
});

test('filterGuests combines status, relationship, and search', () => {
  const result = filterGuests(GUESTS, {
    status: 'accepted',
    relationship: 'Colleagues',
    search: 'sunil',
  });
  assert.deepEqual(result.map((g) => g.code), ['SUNIL-001']);
});

test('filterGuests returns an empty list when nothing matches', () => {
  assert.deepEqual(filterGuests(GUESTS, { search: 'nobody-by-this-name' }), []);
});

test('computeRsvpStats counts invited, accepted, declined, and pending', () => {
  const stats = computeRsvpStats(GUESTS, RESPONSES);

  assert.equal(stats.totalInvited, 4, 'soft-deleted guests are not invited');
  assert.equal(stats.accepted, 2);
  assert.equal(stats.declined, 1);
  assert.equal(stats.pending, 1);
});

test('computeRsvpStats sums the individual headcount from participant names', () => {
  const stats = computeRsvpStats(GUESTS, RESPONSES);
  assert.equal(stats.acceptedHeadcount, 3, '2 from Nimal + 1 from Sunil');
});

test('computeRsvpStats ignores responses belonging to soft-deleted guests', () => {
  const withDeletedResponse = [
    ...RESPONSES,
    { guestId: 'g5', attending: true, participantNames: ['Removed Guest'] },
  ];
  const stats = computeRsvpStats(GUESTS, withDeletedResponse);
  assert.equal(stats.acceptedHeadcount, 3);
});

test('computeRsvpStats handles an empty guest list', () => {
  const stats = computeRsvpStats([], []);
  assert.deepEqual(stats, {
    totalInvited: 0,
    accepted: 0,
    acceptedHeadcount: 0,
    declined: 0,
    pending: 0,
  });
});

test('guestsToCsv emits a header row and one row per guest', () => {
  const csv = guestsToCsv(filterGuests(GUESTS, {}), RESPONSES);
  const lines = csv.trim().split('\n');

  assert.match(lines[0], /^Code,Name,Relationship/);
  assert.equal(lines.length, 5, 'header + 4 non-deleted guests');
});

test('guestsToCsv quotes fields containing commas or quotes', () => {
  const guests = [
    {
      id: 'g1',
      code: 'X-001',
      name: 'Silva, Nimal "Nim"',
      relationship: 'Relations',
      slotCount: 1,
      rsvpStatus: 'accepted',
      whatsappNumber: null,
      isDeleted: false,
    },
  ];
  const csv = guestsToCsv(guests, [
    { guestId: 'g1', attending: true, participantNames: ['A, B'] },
  ]);

  assert.ok(csv.includes('"Silva, Nimal ""Nim"""'), 'comma and quotes escaped');
  assert.ok(csv.includes('"A, B"'), 'participant names escaped');
});

test('guestsToCsv cannot be used to inject a spreadsheet formula', () => {
  const guests = [
    {
      id: 'g1',
      code: 'X-001',
      name: '=cmd|calc',
      relationship: 'Relations',
      slotCount: 1,
      rsvpStatus: 'pending',
      whatsappNumber: null,
      isDeleted: false,
    },
  ];
  const csv = guestsToCsv(guests, []);
  assert.ok(!/(^|,)"?=/m.test(csv), 'leading = must be neutralised');
});
