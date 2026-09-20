import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSeatingTable,
  assignGuestToSeat,
  assignInviteeToSeat,
  assignProbableAttendeeToSeat,
  unassignGuestFromSeat,
  unassignInviteeFromSeat,
  unassignProbableAttendeeFromSeat,
  listSeatingTables,
  listUnassignedGuests,
  listUnassignedProbableAttendees,
  setProbableAttendeeBuffer,
  isUserFacingError,
} from '../src/table-arrangement/tableArrangementRepo.js';
import { createInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';
import { probableAttendees } from '../src/data/probableAttendeesStore.js';

// Assigning a person to a seat that already held someone else used to succeed and
// silently unseat the first person. The screen only offers empty seats, but it has
// no live refresh, so a stale page or a second tab could do it (Next Action 59).
// It is now refused. Re-assigning the seat's own occupant still works, because that
// is how the Save button stores their dietary notes, and clearing a seat is never
// refused.
//
// The first group runs against the in-memory stores. The second hands the assign
// functions a fake query function, because there is no Postgres in the test
// environment: it proves the SQL carries the rule and how each outcome is
// reported, not that Postgres accepts the SQL.

const SEEDED_GUESTS = [
  { id: 'g1', code: 'A-001', name: 'Anula Gunasekara', relationship: 'Family', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false },
  { id: 'g2', code: 'A-002', name: 'Nimal Silva', relationship: 'Family', slotCount: 2, rsvpStatus: 'accepted', isDeleted: false },
  { id: 'g3', code: 'A-003', name: 'Kumara Perera', relationship: 'Friend', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false },
];

beforeEach(() => {
  seatingTables.length = 0;
  guestStore.length = 0;
  guestStore.push(...SEEDED_GUESTS.map((guest) => ({ ...guest })));
  probableAttendees.length = 0;
  invitees.length = 0;
});

async function oneSeat() {
  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  return table.seats;
}

async function seatAt(index = 0) {
  const [table] = await listSeatingTables();
  return table.seats[index];
}

async function acceptedInvitee(guestId, name) {
  const [person] = await createInviteesForGuest(guestId, [name]);
  person.rsvpStatus = 'accepted';
  return person;
}

async function probableSlot() {
  await setProbableAttendeeBuffer('declined', 1);
  const [slot] = await listUnassignedProbableAttendees();
  return slot;
}

// --- a different person is refused -------------------------------------------------

test('a second guest cannot be put on a seat that already holds a guest, and the first keeps the seat and their notes', async () => {
  const [seat] = await oneSeat();
  await assignGuestToSeat(seat.id, 'g1', { dietaryRequirements: 'Nut allergy', specialNotes: 'Near the door' });

  await assert.rejects(() => assignGuestToSeat(seat.id, 'g3', { dietaryRequirements: 'Vegan' }), /already has someone/);

  const after = await seatAt(0);
  assert.equal(after.guestId, 'g1');
  assert.equal(after.dietaryRequirements, 'Nut allergy');
  assert.equal(after.specialNotes, 'Near the door');
  assert.ok(!(await listUnassignedGuests()).some((guest) => guest.id === 'g1'), 'the first guest was not bumped back to the unassigned list');
  assert.ok((await listUnassignedGuests()).some((guest) => guest.id === 'g3'), 'the refused guest is still waiting for a seat');
});

test('an invitee cannot be put on a seat that holds a guest, or a probable placeholder', async () => {
  const [seat, other] = await oneSeat();
  const john = await acceptedInvitee('g2', 'John');
  const slot = await probableSlot();

  await assignGuestToSeat(seat.id, 'g1');
  await assert.rejects(() => assignInviteeToSeat(seat.id, john.id), /already has someone/);
  assert.equal((await seatAt(0)).guestId, 'g1');
  assert.equal((await seatAt(0)).inviteeId, null);

  await assignProbableAttendeeToSeat(other.id, slot.id);
  await assert.rejects(() => assignInviteeToSeat(other.id, john.id), /already has someone/);
  assert.equal((await seatAt(1)).probableAttendeeId, slot.id);
  assert.equal((await seatAt(1)).inviteeId, null);
});

test('a guest and a probable placeholder cannot be put on a seat that holds an invitee', async () => {
  const [seat] = await oneSeat();
  const john = await acceptedInvitee('g2', 'John');
  const slot = await probableSlot();
  await assignInviteeToSeat(seat.id, john.id);

  await assert.rejects(() => assignGuestToSeat(seat.id, 'g1'), /already has someone/);
  await assert.rejects(() => assignProbableAttendeeToSeat(seat.id, slot.id), /already has someone/);

  const after = await seatAt(0);
  assert.equal(after.inviteeId, john.id);
  assert.equal(after.guestId, null);
  assert.equal(after.probableAttendeeId, null);
});

test('the refusal is worded for the admin, so the route passes it through instead of hiding it', async () => {
  const [seat] = await oneSeat();
  await assignGuestToSeat(seat.id, 'g1');

  await assert.rejects(
    () => assignGuestToSeat(seat.id, 'g3'),
    (error) => isUserFacingError(error) && /already has someone/.test(error.message)
  );
});

// --- the seat's own occupant, and emptying a seat, still work -------------------------

test('re-assigning the seat\'s current occupant updates their notes (what the Save button does), for every kind of occupant', async () => {
  const [guestSeat, inviteeSeat] = await oneSeat();
  const john = await acceptedInvitee('g2', 'John');
  await assignGuestToSeat(guestSeat.id, 'g1', { dietaryRequirements: 'Vegan' });
  await assignInviteeToSeat(inviteeSeat.id, john.id, { dietaryRequirements: 'Nut allergy' });

  await assignGuestToSeat(guestSeat.id, 'g1', { dietaryRequirements: 'Vegan, no soy', specialNotes: 'High chair' });
  await assignInviteeToSeat(inviteeSeat.id, john.id, { dietaryRequirements: 'Nut allergy, no shellfish' });

  assert.equal((await seatAt(0)).dietaryRequirements, 'Vegan, no soy');
  assert.equal((await seatAt(0)).specialNotes, 'High chair');
  assert.equal((await seatAt(1)).dietaryRequirements, 'Nut allergy, no shellfish');

  const slot = await probableSlot();
  const table = await createSeatingTable({ tableNumber: 2, capacity: 1 });
  await assignProbableAttendeeToSeat(table.seats[0].id, slot.id, { specialNotes: 'first' });
  await assignProbableAttendeeToSeat(table.seats[0].id, slot.id, { specialNotes: 'second' });
  const [, second] = await listSeatingTables();
  assert.equal(second.seats[0].specialNotes, 'second');
});

test('emptying a seat is never refused, whatever held it, and wipes its notes', async () => {
  const [guestSeat, inviteeSeat] = await oneSeat();
  const john = await acceptedInvitee('g2', 'John');
  const slot = await probableSlot();
  const table = await createSeatingTable({ tableNumber: 2, capacity: 1 });
  await assignGuestToSeat(guestSeat.id, 'g1', { dietaryRequirements: 'Vegan' });
  await assignInviteeToSeat(inviteeSeat.id, john.id, { dietaryRequirements: 'Nut allergy' });
  await assignProbableAttendeeToSeat(table.seats[0].id, slot.id, { specialNotes: 'Placeholder' });

  await unassignGuestFromSeat(guestSeat.id);
  await unassignInviteeFromSeat(inviteeSeat.id);
  await unassignProbableAttendeeFromSeat(table.seats[0].id);

  const [first, second] = await listSeatingTables();
  for (const seat of [...first.seats, ...second.seats]) {
    assert.equal(seat.guestId, null);
    assert.equal(seat.inviteeId, null);
    assert.equal(seat.probableAttendeeId, null);
    assert.equal(seat.dietaryRequirements, null);
    assert.equal(seat.specialNotes, null);
  }
});

test('the supported way to replace someone works: Remove them, then seat the other person', async () => {
  const [seat] = await oneSeat();
  await assignGuestToSeat(seat.id, 'g1', { dietaryRequirements: 'Nut allergy' });

  await unassignGuestFromSeat(seat.id);
  await assignGuestToSeat(seat.id, 'g3');

  const after = await seatAt(0);
  assert.equal(after.guestId, 'g3');
  assert.equal(after.dietaryRequirements, null, 'the previous occupant\'s note did not carry over on the server');
});

test('a seat that does not exist is still reported as null, not as "taken"', async () => {
  assert.equal(await assignGuestToSeat('no-such-seat', 'g1'), null);
  assert.equal(await assignInviteeToSeat('no-such-seat', 'x'), null);
  assert.equal(await assignProbableAttendeeToSeat('no-such-seat', 'x'), null);
});

// --- the SQL carries the same rule (fake query function) ------------------------------

function fakeExec({ updateRows = [{ id: 'seat-1', seat_number: 1 }], seatExists = true, updateError } = {}) {
  const statements = [];
  const exec = async (text, params) => {
    const sql = text.replace(/\s+/g, ' ').trim();
    statements.push({ sql, params });
    if (/^UPDATE table_seats/.test(sql)) {
      if (updateError) throw updateError;
      return { rows: updateRows };
    }
    if (/^SELECT id FROM table_seats/.test(sql)) return { rows: seatExists ? [{ id: 'seat-1' }] : [] };
    return { rows: [] };
  };
  return { exec, statements };
}

const SEAT_EMPTY = 'guest_id IS NULL AND probable_attendee_id IS NULL AND invitee_id IS NULL';

for (const [name, assign, column] of [
  ['guest', (exec) => assignGuestToSeat('seat-1', 'occupant-1', {}, exec), 'guest_id'],
  ['invitee', (exec) => assignInviteeToSeat('seat-1', 'occupant-1', {}, exec), 'invitee_id'],
  ['probable attendee', (exec) => assignProbableAttendeeToSeat('seat-1', 'occupant-1', {}, exec), 'probable_attendee_id'],
]) {
  test(`assigning a ${name} only updates a seat that is empty or already theirs`, async () => {
    const { exec, statements } = fakeExec();

    await assign(exec);

    const update = statements.find((entry) => /^UPDATE table_seats/.test(entry.sql));
    assert.ok(
      update.sql.includes(`AND ((${SEAT_EMPTY}) OR ${column} = $2)`),
      `the UPDATE must carry the empty-or-same-occupant rule on ${column}: ${update.sql}`
    );
    assert.equal(update.params[0], 'seat-1');
    assert.equal(update.params[1], 'occupant-1');
  });

  test(`a ${name} assignment that changes no row on an existing seat is reported as "already has someone"`, async () => {
    const { exec, statements } = fakeExec({ updateRows: [], seatExists: true });

    await assert.rejects(() => assign(exec), /already has someone/);

    assert.ok(statements.some((entry) => /^SELECT id FROM table_seats/.test(entry.sql)), 'it checked whether the seat exists');
  });

  test(`a ${name} assignment that changes no row on a seat that does not exist returns null`, async () => {
    const { exec } = fakeExec({ updateRows: [], seatExists: false });

    assert.equal(await assign(exec), null);
  });

  test(`a successful ${name} assignment does not run the follow-up seat lookup`, async () => {
    const { exec, statements } = fakeExec();

    await assign(exec);

    assert.equal(statements.filter((entry) => /^SELECT/.test(entry.sql)).length, 0);
  });
}

test('clearing a seat sends the unguarded UPDATE, so an occupied seat can always be emptied', async () => {
  const { exec, statements } = fakeExec();

  await assignGuestToSeat('seat-1', null, {}, exec);

  const update = statements.find((entry) => /^UPDATE table_seats/.test(entry.sql));
  assert.ok(!update.sql.includes('OR guest_id = $2'), update.sql);
  assert.ok(!update.sql.includes(SEAT_EMPTY), update.sql);
  assert.equal(update.params[1], null);
});

test('a person who is already on another seat still gets the existing "already assigned" message from the unique index', async () => {
  const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
  const { exec } = fakeExec({ updateError: uniqueViolation });

  await assert.rejects(() => assignGuestToSeat('seat-1', 'occupant-1', {}, exec), /already assigned to another seat/);
});
