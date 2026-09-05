import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTableArrangementExport,
  buildTableArrangementSummary,
} from '../src/table-arrangement/tableArrangementExport.js';
import {
  listSeatingTables,
  createSeatingTable,
  deleteSeatingTable,
  assignGuestToSeat,
  unassignGuestFromSeat,
  listUnassignedGuests,
  listAssignedGuests,
  getGuestWithTableAssignment,
  getProbableAttendanceSummary,
  setProbableAttendeeBuffer,
  listUnassignedProbableAttendees,
  assignProbableAttendeeToSeat,
  unassignProbableAttendeeFromSeat,
} from '../src/table-arrangement/tableArrangementRepo.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { guestStore } from '../src/data/guestStore.js';
import { probableAttendees } from '../src/data/probableAttendeesStore.js';

// Table Arrangement (P2).
//
// The repo tests below exercise the in-memory path, which is what runs whenever
// DATABASE_URL is unset. That path is not a convenience: without it the admin
// nav link 500s on every admin page, since the nav is rendered by the shared
// adminPageWrapper.

const SEEDED_GUESTS = [
  { id: 'g1', code: 'A-001', name: 'Anula Gunasekara', relationship: 'Family', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false },
  { id: 'g2', code: 'A-002', name: 'Nimal Silva', relationship: 'Family', slotCount: 2, rsvpStatus: 'accepted', isDeleted: false },
  { id: 'g3', code: 'A-003', name: 'Kumara Perera', relationship: 'Friend', slotCount: 1, rsvpStatus: 'declined', isDeleted: false },
  { id: 'g4', code: 'A-004', name: 'Sunil Fernando', relationship: 'Friend', slotCount: 1, rsvpStatus: 'pending', isDeleted: false },
  { id: 'g5', code: 'A-005', name: 'Removed Person', relationship: 'Friend', slotCount: 1, rsvpStatus: 'accepted', isDeleted: true },
];

function resetStores() {
  seatingTables.length = 0;
  guestStore.length = 0;
  guestStore.push(...SEEDED_GUESTS.map((guest) => ({ ...guest })));
  probableAttendees.length = 0;
}

// --- Export -----------------------------------------------------------------

test('the export always emits its header row, even with no tables', () => {
  const tsv = buildTableArrangementExport([]);
  assert.equal(
    tsv,
    'Table\tTable Name\tSeat\tGuest Name\tContact\tDietary Requirements\tSpecial Notes\n'
  );
});

test('a table with no seats still gets a row, so it is not silently dropped', () => {
  const tsv = buildTableArrangementExport([
    { table_number: 3, table_name: 'Overflow', seats: [] },
  ]);
  const rows = tsv.trimEnd().split('\n');

  assert.equal(rows.length, 2, 'header plus the empty table');
  assert.match(rows[1], /^3\tOverflow\t—\t\(No seats assigned\)/);
});

test('unassigned seats are labelled rather than left blank', () => {
  const tsv = buildTableArrangementExport([
    {
      table_number: 1,
      table_name: 'Head Table',
      seats: [
        { seatNumber: 1, guestId: 'g1', guestName: 'Anula Gunasekara' },
        { seatNumber: 2, guestId: null, guestName: null },
      ],
    },
  ]);
  const rows = tsv.trimEnd().split('\n');

  assert.equal(rows.length, 3);
  assert.match(rows[1], /Anula Gunasekara/);
  assert.match(rows[2], /\(Unassigned\)/);
});

test('leading formula characters are neutralised so Excel does not execute them', () => {
  const tsv = buildTableArrangementExport([
    {
      table_number: 1,
      table_name: '',
      seats: [
        { seatNumber: 1, guestId: 'g1', guestName: '=HYPERLINK("http://evil.test")' },
        { seatNumber: 2, guestId: 'g2', guestName: '+1 555 0100' },
        { seatNumber: 3, guestId: 'g3', guestName: '@lookup' },
        { seatNumber: 4, guestId: 'g4', guestName: '-5' },
      ],
    },
  ]);

  assert.match(tsv, /'=HYPERLINK/, 'formula prefix is quoted out');
  assert.match(tsv, /'\+1 555 0100/);
  assert.match(tsv, /'@lookup/);
  assert.match(tsv, /'-5/);
});

test('tabs, newlines and quotes inside a value cannot break the column layout', () => {
  const tsv = buildTableArrangementExport([
    {
      table_number: 1,
      table_name: '',
      seats: [
        {
          seatNumber: 1,
          guestId: 'g1',
          guestName: 'Anula',
          dietaryRequirements: 'nuts\tdairy',
          specialNotes: 'says "no seafood"',
        },
      ],
    },
  ]);

  assert.match(tsv, /"nuts\tdairy"/, 'a tabbed value is wrapped in quotes');
  assert.match(tsv, /"says ""no seafood"""/, 'inner quotes are doubled');
});

test('the summary counts capacity, assignment and the gap between them', () => {
  const summary = buildTableArrangementSummary([
    {
      table_number: 1,
      capacity: 4,
      seats: [
        { seatNumber: 1, guestId: 'g1', guestName: 'Anula' },
        { seatNumber: 2, guestId: 'g2', guestName: 'Nimal' },
        { seatNumber: 3, guestId: null },
        { seatNumber: 4, guestId: null },
      ],
    },
    { table_number: 2, capacity: 6, seats: [] },
  ]);

  assert.match(summary, /Total Tables\t2/);
  assert.match(summary, /Total Capacity\t10/);
  assert.match(summary, /Assigned Guests\t2/);
  assert.match(summary, /Unassigned Seats\t8/);
});

test('dietary requirements and special notes only appear when there are some', () => {
  const withNone = buildTableArrangementSummary([
    { table_number: 1, capacity: 1, seats: [{ seatNumber: 1, guestId: 'g1', guestName: 'Anula' }] },
  ]);
  assert.doesNotMatch(withNone, /DIETARY REQUIREMENTS/);
  assert.doesNotMatch(withNone, /SPECIAL NOTES/);

  const withSome = buildTableArrangementSummary([
    {
      table_number: 1,
      capacity: 1,
      seats: [
        {
          seatNumber: 1,
          guestId: 'g1',
          guestName: 'Anula',
          dietaryRequirements: 'vegetarian',
          specialNotes: 'wheelchair access',
        },
      ],
    },
  ]);
  assert.match(withSome, /DIETARY REQUIREMENTS/);
  assert.match(withSome, /vegetarian/);
  assert.match(withSome, /SPECIAL NOTES/);
  assert.match(withSome, /wheelchair access/);
});

test('a ProbableAttendee-occupied seat exports its placeholder label, not a real name (P1-16)', () => {
  const tsv = buildTableArrangementExport([
    {
      table_number: 1,
      table_name: '',
      seats: [
        { seatNumber: 1, guestId: null, guestName: null, probableAttendeeId: 'p1', probableAttendeeLabel: 'Probable (Declined) #1' },
      ],
    },
  ]);
  const rows = tsv.trimEnd().split('\n');

  assert.match(rows[1], /Probable \(Declined\) #1/);
  assert.doesNotMatch(rows[1], /\(Unassigned\)/);
});

test('the summary counts a ProbableAttendee-occupied seat as assigned (P1-16)', () => {
  const summary = buildTableArrangementSummary([
    {
      table_number: 1,
      capacity: 2,
      seats: [
        { seatNumber: 1, guestId: null, probableAttendeeId: 'p1', probableAttendeeLabel: 'Probable (Pending) #1', dietaryRequirements: 'vegetarian' },
        { seatNumber: 2, guestId: null, probableAttendeeId: null },
      ],
    },
  ]);

  assert.match(summary, /Assigned Guests\t1/);
  assert.match(summary, /Unassigned Seats\t1/);
  assert.match(summary, /Probable \(Pending\) #1/, 'the placeholder label is used for the dietary requirements row');
});

test('a requirement on an unassigned seat is not counted', () => {
  const summary = buildTableArrangementSummary([
    {
      table_number: 1,
      capacity: 2,
      seats: [
        { seatNumber: 1, guestId: null, dietaryRequirements: 'stale leftover' },
        { seatNumber: 2, guestId: 'g1', guestName: 'Anula' },
      ],
    },
  ]);

  assert.match(summary, /Dietary Requirements\t0/);
  assert.doesNotMatch(summary, /stale leftover/);
});

// --- Repo (in-memory path) --------------------------------------------------

test('creating a table generates exactly `capacity` empty seats', async (t) => {
  resetStores();
  t.after(resetStores);

  const table = await createSeatingTable({ tableNumber: 1, tableName: 'Head Table', capacity: 8 });

  assert.equal(table.table_number, 1);
  assert.equal(table.table_name, 'Head Table');
  assert.equal(table.seats.length, 8);
  assert.deepEqual(
    table.seats.map((seat) => seat.seatNumber),
    [1, 2, 3, 4, 5, 6, 7, 8]
  );
  assert.ok(table.seats.every((seat) => seat.guestId === null));
});

test('a table with no seats reports an empty array, never a phantom seat', async (t) => {
  resetStores();
  t.after(resetStores);

  await createSeatingTable({ tableNumber: 1, capacity: 0 });
  const [table] = await listSeatingTables();

  assert.deepEqual(table.seats, [], 'an empty table has zero seats, not one null-filled seat');
});

test('duplicate table numbers are rejected', async (t) => {
  resetStores();
  t.after(resetStores);

  await createSeatingTable({ tableNumber: 4, capacity: 2 });
  await assert.rejects(
    () => createSeatingTable({ tableNumber: 4, capacity: 2 }),
    /already exists/
  );
});

test('tables list in table-number order regardless of creation order', async (t) => {
  resetStores();
  t.after(resetStores);

  await createSeatingTable({ tableNumber: 3, capacity: 1 });
  await createSeatingTable({ tableNumber: 1, capacity: 1 });
  await createSeatingTable({ tableNumber: 2, capacity: 1 });

  const tables = await listSeatingTables();
  assert.deepEqual(tables.map((table) => table.table_number), [1, 2, 3]);
});

test('assigning a guest resolves their name on read', async (t) => {
  resetStores();
  t.after(resetStores);

  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  await assignGuestToSeat(table.seats[0].id, 'g2', { dietaryRequirements: 'vegetarian' });

  const [refreshed] = await listSeatingTables();
  assert.equal(refreshed.seats[0].guestId, 'g2');
  assert.equal(refreshed.seats[0].guestName, 'Nimal Silva');
  assert.equal(refreshed.seats[0].dietaryRequirements, 'vegetarian');
});

test('one guest cannot occupy two seats', async (t) => {
  resetStores();
  t.after(resetStores);

  const table = await createSeatingTable({ tableNumber: 1, capacity: 3 });
  await assignGuestToSeat(table.seats[0].id, 'g1');

  await assert.rejects(
    () => assignGuestToSeat(table.seats[1].id, 'g1'),
    /already assigned/
  );

  const [refreshed] = await listSeatingTables();
  assert.equal(refreshed.seats[1].guestId, null, 'the rejected seat is left untouched');
});

test('reassigning a guest to the seat they already hold is not a clash', async (t) => {
  resetStores();
  t.after(resetStores);

  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  const seatId = table.seats[0].id;

  await assignGuestToSeat(seatId, 'g1', { dietaryRequirements: 'vegetarian' });
  await assignGuestToSeat(seatId, 'g1', { dietaryRequirements: 'vegan' });

  const [refreshed] = await listSeatingTables();
  assert.equal(refreshed.seats[0].dietaryRequirements, 'vegan');
});

test('unassigning frees the guest to be seated elsewhere', async (t) => {
  resetStores();
  t.after(resetStores);

  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  await assignGuestToSeat(table.seats[0].id, 'g1');
  await unassignGuestFromSeat(table.seats[0].id);

  const [afterUnassign] = await listSeatingTables();
  assert.equal(afterUnassign.seats[0].guestId, null);
  assert.equal(afterUnassign.seats[0].guestName, null);

  await assignGuestToSeat(table.seats[1].id, 'g1');
  const [afterReseat] = await listSeatingTables();
  assert.equal(afterReseat.seats[1].guestId, 'g1');
});

test('only accepted, undeleted, unseated guests are offered for assignment', async (t) => {
  resetStores();
  t.after(resetStores);

  const available = await listUnassignedGuests();
  assert.deepEqual(
    available.map((guest) => guest.id),
    ['g1', 'g2'],
    'declined (g3), pending (g4) and deleted (g5) guests are excluded, sorted by name'
  );

  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  await assignGuestToSeat(table.seats[0].id, 'g1');

  const afterSeating = await listUnassignedGuests();
  assert.deepEqual(afterSeating.map((guest) => guest.id), ['g2'], 'a seated guest drops off the list');
});

test('deleting a table releases everyone sitting at it', async (t) => {
  resetStores();
  t.after(resetStores);

  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  await assignGuestToSeat(table.seats[0].id, 'g1');

  await deleteSeatingTable(table.id);

  assert.deepEqual(await listSeatingTables(), []);
  const available = await listUnassignedGuests();
  assert.ok(available.some((guest) => guest.id === 'g1'), 'the guest is assignable again');
});

test('a guest reports where they are seated', async (t) => {
  resetStores();
  t.after(resetStores);

  const table = await createSeatingTable({ tableNumber: 7, tableName: 'Cousins', capacity: 3 });
  await assignGuestToSeat(table.seats[2].id, 'g2');

  const seated = await getGuestWithTableAssignment('g2');
  assert.equal(seated.table_number, 7);
  assert.equal(seated.seat_number, 3);

  const unseated = await getGuestWithTableAssignment('g1');
  assert.equal(unseated.table_number, null);
  assert.equal(unseated.seat_number, null);
});

// --- ProbableAttendee buffer (P1-16) -----------------------------------------

test('both buckets are always reported, even at zero', async (t) => {
  resetStores();
  t.after(resetStores);

  const summary = await getProbableAttendanceSummary();
  assert.deepEqual(summary, [
    { bucket: 'declined', bufferCount: 0, seatedCount: 0, unseatedCount: 0 },
    { bucket: 'pending', bufferCount: 0, seatedCount: 0, unseatedCount: 0 },
  ]);
});

test('raising a bucket estimate creates that many unseated placeholders', async (t) => {
  resetStores();
  t.after(resetStores);

  await setProbableAttendeeBuffer('declined', 3);

  const unassigned = await listUnassignedProbableAttendees();
  assert.deepEqual(
    unassigned.map((p) => p.label),
    ['Probable (Declined) #1', 'Probable (Declined) #2', 'Probable (Declined) #3']
  );

  const [declined, pending] = await getProbableAttendanceSummary();
  assert.deepEqual(declined, { bucket: 'declined', bufferCount: 3, seatedCount: 0, unseatedCount: 3 });
  assert.equal(pending.bufferCount, 0);
});

test('lowering a bucket estimate removes only unseated placeholders', async (t) => {
  resetStores();
  t.after(resetStores);

  await setProbableAttendeeBuffer('pending', 3);
  const [slot1, , slot3] = await listUnassignedProbableAttendees();
  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  await assignProbableAttendeeToSeat(table.seats[0].id, slot1.id);

  await setProbableAttendeeBuffer('pending', 1);

  const remaining = await listUnassignedProbableAttendees();
  assert.deepEqual(remaining, [], 'the two unseated slots were removed, leaving none unseated');
  const [, pending] = await getProbableAttendanceSummary();
  assert.equal(pending.bufferCount, 1, 'the seated slot survives the reduction');
  assert.equal(pending.seatedCount, 1);
  assert.ok(slot3, 'sanity: three slots existed before the reduction');
});

test('a bucket estimate cannot drop below the number already seated', async (t) => {
  resetStores();
  t.after(resetStores);

  await setProbableAttendeeBuffer('declined', 2);
  const [slot1] = await listUnassignedProbableAttendees();
  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  await assignProbableAttendeeToSeat(table.seats[0].id, slot1.id);

  await assert.rejects(
    () => setProbableAttendeeBuffer('declined', 0),
    /already seated/
  );

  const [declined] = await getProbableAttendanceSummary();
  assert.equal(declined.bufferCount, 2, 'the rejected resize left the buffer untouched');
});

test('rejects an unknown bucket or a negative/non-integer count', async (t) => {
  resetStores();
  t.after(resetStores);

  await assert.rejects(() => setProbableAttendeeBuffer('maybe', 1), /Unknown RSVP bucket/);
  await assert.rejects(() => setProbableAttendeeBuffer('declined', -1), /non-negative/);
  await assert.rejects(() => setProbableAttendeeBuffer('declined', 1.5), /non-negative/);
});

test('a ProbableAttendee can be assigned to a seat and shows its label, never a real name', async (t) => {
  resetStores();
  t.after(resetStores);

  await setProbableAttendeeBuffer('declined', 1);
  const [slot] = await listUnassignedProbableAttendees();
  const table = await createSeatingTable({ tableNumber: 1, capacity: 1 });
  await assignProbableAttendeeToSeat(table.seats[0].id, slot.id, { dietaryRequirements: 'none' });

  const [refreshed] = await listSeatingTables();
  assert.equal(refreshed.seats[0].probableAttendeeId, slot.id);
  assert.equal(refreshed.seats[0].probableAttendeeLabel, 'Probable (Declined) #1');
  assert.equal(refreshed.seats[0].guestId, null);
  assert.equal(refreshed.seats[0].guestName, null);
});

test('one ProbableAttendee cannot occupy two seats', async (t) => {
  resetStores();
  t.after(resetStores);

  await setProbableAttendeeBuffer('pending', 1);
  const [slot] = await listUnassignedProbableAttendees();
  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  await assignProbableAttendeeToSeat(table.seats[0].id, slot.id);

  await assert.rejects(
    () => assignProbableAttendeeToSeat(table.seats[1].id, slot.id),
    /already assigned/
  );
});

test('assigning a real guest to a seat evicts any ProbableAttendee already there, and vice versa', async (t) => {
  resetStores();
  t.after(resetStores);

  await setProbableAttendeeBuffer('declined', 1);
  const [slot] = await listUnassignedProbableAttendees();
  const table = await createSeatingTable({ tableNumber: 1, capacity: 1 });

  await assignProbableAttendeeToSeat(table.seats[0].id, slot.id);
  await assignGuestToSeat(table.seats[0].id, 'g1');

  const [afterGuest] = await listSeatingTables();
  assert.equal(afterGuest.seats[0].guestId, 'g1');
  assert.equal(afterGuest.seats[0].probableAttendeeId, null, 'the seat can only hold one occupant');

  await assignProbableAttendeeToSeat(table.seats[0].id, slot.id);
  const [afterProbable] = await listSeatingTables();
  assert.equal(afterProbable.seats[0].guestId, null);
  assert.equal(afterProbable.seats[0].probableAttendeeId, slot.id);
});

test('unassigning a ProbableAttendee frees it to be seated elsewhere', async (t) => {
  resetStores();
  t.after(resetStores);

  await setProbableAttendeeBuffer('pending', 1);
  const [slot] = await listUnassignedProbableAttendees();
  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });

  await assignProbableAttendeeToSeat(table.seats[0].id, slot.id);
  await unassignProbableAttendeeFromSeat(table.seats[0].id);

  assert.deepEqual((await listUnassignedProbableAttendees()).map((p) => p.id), [slot.id]);

  await assignProbableAttendeeToSeat(table.seats[1].id, slot.id);
  const [refreshed] = await listSeatingTables();
  assert.equal(refreshed.seats[1].probableAttendeeId, slot.id);
});

test('"Table Arranged" candidates (accepted, seated guests) exclude declined/pending guests even if seated', async (t) => {
  resetStores();
  t.after(resetStores);

  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  await assignGuestToSeat(table.seats[0].id, 'g1'); // accepted
  await assignGuestToSeat(table.seats[1].id, 'g3'); // declined, seated anyway (edge case)

  const assigned = await listAssignedGuests();
  const acceptedSeated = assigned.filter((guest) => guest.rsvpStatus === 'accepted');
  assert.deepEqual(acceptedSeated.map((g) => g.id), ['g1']);
  assert.equal(assigned.length, 2, 'both seats show up in the raw list — the accepted-only filter happens in the page, not the repo');
});
