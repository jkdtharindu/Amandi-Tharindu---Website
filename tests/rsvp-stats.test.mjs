import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRsvpStats } from '../src/rsvp/rsvpStats.js';
import { buildGuestCsv } from '../src/rsvp/guestCsv.js';

// Slice 19 — RSVP Dashboard (P0-08).
// These are the numbers the couple will book catering against, so the counting
// rules are pinned here rather than left implicit in a route handler.

const guests = [
  { id: 'g1', code: 'A-001', name: 'Nimal Silva', relationship: 'Relations', slotCount: 4, isDeleted: false },
  { id: 'g2', code: 'A-002', name: 'Kumara Perera', relationship: 'Friends', slotCount: 2, isDeleted: false },
  { id: 'g3', code: 'A-003', name: 'Sunil Fernando', relationship: 'Colleagues', slotCount: 2, isDeleted: false },
  { id: 'g4', code: 'A-004', name: 'Anula Gunasekara', relationship: 'Neighbours', slotCount: 1, isDeleted: false },
];

const responses = [
  { guestId: 'g1', attending: true, participantNames: ['Nimal Silva', 'Anu Silva', 'Kavi Silva'] },
  { guestId: 'g2', attending: true, participantNames: ['Kumara Perera', 'Sita Perera'] },
  { guestId: 'g3', attending: false, participantNames: [] },
  // g4 has not responded at all
];

test('counts families by RSVP status', () => {
  const stats = computeRsvpStats(guests, responses);

  assert.equal(stats.totalInvited, 4, 'every live guest unit is invited');
  assert.equal(stats.acceptedFamilies, 2);
  assert.equal(stats.declinedFamilies, 1);
  assert.equal(stats.pendingFamilies, 1, 'a guest with no response row is pending');
});

test('headcount sums participant names across accepting families', () => {
  const stats = computeRsvpStats(guests, responses);
  assert.equal(stats.acceptedHeadcount, 5, '3 Silvas + 2 Pereras');
});

test('the three status buckets always account for every invited guest', () => {
  const stats = computeRsvpStats(guests, responses);
  assert.equal(
    stats.acceptedFamilies + stats.declinedFamilies + stats.pendingFamilies,
    stats.totalInvited,
    'no guest may fall outside the breakdown, or the chart lies'
  );
});

test('an acceptance with no participant names still counts as one head', () => {
  // The page JS requires names, but POST /api/guest/rsvp does not enforce it.
  // Counting zero here would understate the catering number, which is the one
  // direction that costs the couple real money on the day.
  const stats = computeRsvpStats(
    [{ id: 'g1', code: 'A-001', name: 'Solo', relationship: 'Friends', slotCount: 1, isDeleted: false }],
    [{ guestId: 'g1', attending: true, participantNames: [] }]
  );
  assert.equal(stats.acceptedHeadcount, 1);
});

test('soft-deleted guests are excluded from every figure', () => {
  const withDeleted = [
    ...guests,
    { id: 'g5', code: 'A-005', name: 'Removed Person', relationship: 'Friends', slotCount: 3, isDeleted: true },
  ];
  const withDeletedResponse = [...responses, { guestId: 'g5', attending: true, participantNames: ['a', 'b', 'c'] }];

  const stats = computeRsvpStats(withDeleted, withDeletedResponse);
  assert.equal(stats.totalInvited, 4, 'a removed guest is not invited');
  assert.equal(stats.acceptedHeadcount, 5, 'and their headcount must not be catered for');
});

test('reports total reserved slots for capacity context', () => {
  const stats = computeRsvpStats(guests, responses);
  assert.equal(stats.totalSlots, 9, '4 + 2 + 2 + 1');
});

test('an empty guest list yields zeroes, not NaN or a crash', () => {
  const stats = computeRsvpStats([], []);
  assert.equal(stats.totalInvited, 0);
  assert.equal(stats.acceptedHeadcount, 0);
  assert.equal(stats.pendingFamilies, 0);
  assert.equal(stats.responseRate, 0, 'a rate over zero guests is 0, not a division by zero');
});

test('response rate is the share of families who have answered', () => {
  const stats = computeRsvpStats(guests, responses);
  assert.equal(stats.responseRate, 75, '3 of 4 answered');
});

// --- CSV export -----------------------------------------------------------

test('CSV has a header row and one row per guest', () => {
  const csv = buildGuestCsv(guests, responses);
  const lines = csv.trim().split('\n');

  assert.equal(lines.length, 5, 'header + 4 guests');
  assert.match(lines[0], /Name/);
  assert.match(lines[0], /Participant Names/);
});

test('CSV quotes values containing commas so columns do not shift', () => {
  const csv = buildGuestCsv(
    [{ id: 'g1', code: 'A-001', name: 'Silva, Nimal', relationship: 'Relations', slotCount: 2, isDeleted: false }],
    [{ guestId: 'g1', attending: true, participantNames: ['Nimal Silva', 'Anu Silva'] }]
  );

  assert.ok(csv.includes('"Silva, Nimal"'), 'a name with a comma must be quoted');
  assert.ok(csv.includes('"Nimal Silva, Anu Silva"'), 'the joined participant list must be quoted');
});

test('CSV escapes embedded double quotes by doubling them', () => {
  const csv = buildGuestCsv(
    [{ id: 'g1', code: 'A-001', name: 'Nimal "Nimi" Silva', relationship: 'Friends', slotCount: 1, isDeleted: false }],
    []
  );
  assert.ok(csv.includes('"Nimal ""Nimi"" Silva"'), 'quotes must be doubled, per RFC 4180');
});

test('SECURITY: CSV neutralises spreadsheet formula injection', () => {
  // A guest name is admin-entered free text. Excel and Google Sheets execute a
  // cell beginning with = + - @, so exporting one verbatim turns the couple's
  // guest list into an attack on their own machine.
  const csv = buildGuestCsv(
    [{ id: 'g1', code: 'A-001', name: '=HYPERLINK("http://evil.test","click")', relationship: 'Friends', slotCount: 1, isDeleted: false }],
    []
  );

  assert.ok(!/(^|,)"?=HYPERLINK/.test(csv), 'a leading = must not survive into a cell');
  assert.ok(csv.includes("'=HYPERLINK"), 'it should be prefixed so the sheet treats it as text');
});

test('CSV includes soft-deleted guests but marks them, so the export is auditable', () => {
  const csv = buildGuestCsv(
    [{ id: 'g1', code: 'A-001', name: 'Removed', relationship: 'Friends', slotCount: 1, isDeleted: true }],
    []
  );
  assert.match(csv, /Removed/);
  assert.match(csv, /yes/i, 'the deleted flag is carried into the export');
});
