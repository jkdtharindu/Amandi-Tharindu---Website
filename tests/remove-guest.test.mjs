import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { removeGuest } from '../src/admin/removeGuest.js';
import { removeInviteeFromParty } from '../src/invitees/removeInvitee.js';
import {
  createSeatingTable,
  assignGuestToSeat,
  assignInviteeToSeat,
  listSeatingTables,
  listUnassignedGuests,
  listUnassignedInvitees,
} from '../src/table-arrangement/tableArrangementRepo.js';
import { buildDashboardStats } from '../src/table-arrangement/dashboardStats.js';
import { createInviteesForGuest, listInviteesForGuest, updateInviteeRsvpStatuses } from '../src/invitees/inviteesRepo.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';

// The Remove button on the guest list only marked the guest deleted. Their table
// seats were never freed, and the table window reads seats with no is_deleted
// filter, so a removed guest and their people kept showing on their seats. The
// owner hit this on the live site (Next Action 56).
//
// There is no Postgres in the test environment, so the first group hands
// removeGuest a fake `transaction` that logs every statement and the BEGIN /
// COMMIT / ROLLBACK around them, the way src/db.js's withTransaction() does. That
// proves the shape of the work (one transaction, right order, rollback on any
// failure), not the SQL against a real database. The second group runs the same
// scenarios against the in-memory stores, which is where the end state is proved.

const GUEST_ID = '11111111-1111-4111-8111-111111111111';

function label(sql) {
  if (/FROM guests WHERE id = \$1 FOR UPDATE/.test(sql)) return 'LOCK guest';
  if (/^UPDATE guests SET is_deleted/.test(sql)) return 'SOFT DELETE guest';
  if (/^UPDATE table_seats/.test(sql)) return 'FREE seats';
  return sql;
}

function fakeTransaction({ failWhen, guestExists = true } = {}) {
  const events = [];
  const statements = [];

  const respond = (name) => {
    switch (name) {
      case 'LOCK guest':
        return [{ id: GUEST_ID }];
      case 'SOFT DELETE guest':
        return guestExists
          ? [{ id: GUEST_ID, code: 'A-001', name: 'Nimal Silva', slot_count: 2, is_deleted: true }]
          : [];
      case 'FREE seats':
        return [{ id: 'seat-1' }, { id: 'seat-2' }];
      default:
        return [];
    }
  };

  const transaction = async (work) => {
    events.push('BEGIN');
    const exec = async (text, params) => {
      const sql = text.replace(/\s+/g, ' ').trim();
      const name = label(sql);
      events.push(name);
      statements.push({ label: name, sql, params });
      if (failWhen && failWhen.test(name)) throw new Error('simulated database failure');
      return { rows: respond(name) };
    };
    try {
      const result = await work(exec);
      events.push('COMMIT');
      return result;
    } catch (error) {
      events.push('ROLLBACK');
      throw error;
    }
  };

  return { transaction, events, statements };
}

// --- one transaction, in order ---------------------------------------------------

test('removal locks the guest, marks them deleted, frees their seats, and commits', async () => {
  const { transaction, events } = fakeTransaction();

  const guest = await removeGuest(GUEST_ID, { transaction });

  assert.equal(guest.id, GUEST_ID);
  assert.deepEqual(events, ['BEGIN', 'LOCK guest', 'SOFT DELETE guest', 'FREE seats', 'COMMIT']);
});

test('the seat-freeing statement covers the guest\'s own seat and every seat held by one of their people, and wipes notes', async () => {
  const { transaction, statements } = fakeTransaction();

  await removeGuest(GUEST_ID, { transaction });

  const free = statements.find((entry) => entry.label === 'FREE seats');
  assert.deepEqual(free.params, [GUEST_ID]);
  assert.match(free.sql, /WHERE guest_id = \$1/);
  assert.match(free.sql, /invitee_id IN \(SELECT id FROM invitees WHERE guest_id = \$1\)/);
  assert.match(free.sql, /guest_id = NULL/);
  assert.match(free.sql, /invitee_id = NULL/);
  assert.match(free.sql, /dietary_requirements = NULL/);
  assert.match(free.sql, /special_notes = NULL/);
});

// --- all or nothing --------------------------------------------------------------

test('a failure while freeing the seats rolls the removal back, so the guest is never left deleted but still seated', async () => {
  const { transaction, events } = fakeTransaction({ failWhen: /^FREE seats$/ });

  await assert.rejects(removeGuest(GUEST_ID, { transaction }), /simulated database failure/);

  assert.ok(events.includes('SOFT DELETE guest'), 'the delete was attempted inside the transaction');
  assert.equal(events.at(-1), 'ROLLBACK');
  assert.ok(!events.includes('COMMIT'), 'a half-finished removal must never be committed');
});

test('a failure while marking the guest deleted stops before any seat is touched', async () => {
  const { transaction, events } = fakeTransaction({ failWhen: /^SOFT DELETE guest$/ });

  await assert.rejects(removeGuest(GUEST_ID, { transaction }), /simulated database failure/);

  assert.ok(!events.includes('FREE seats'));
  assert.equal(events.at(-1), 'ROLLBACK');
});

test('a guest who does not exist (or is already removed) returns null and no seat is touched', async () => {
  const { transaction, events } = fakeTransaction({ guestExists: false });

  const guest = await removeGuest(GUEST_ID, { transaction });

  assert.equal(guest, null);
  assert.ok(!events.includes('FREE seats'));
});

// --- end state, in-memory (no DATABASE_URL) --------------------------------------

const SEEDED_GUESTS = [
  { id: 'g1', code: 'A-001', name: 'Anula Gunasekara', relationship: 'Family', slotCount: 1, rsvpStatus: 'accepted', isDeleted: false },
  { id: 'g2', code: 'A-002', name: 'Elvis Pressley', relationship: 'Family', slotCount: 2, rsvpStatus: 'accepted', isDeleted: false },
];

beforeEach(() => {
  seatingTables.length = 0;
  guestStore.length = 0;
  guestStore.push(...SEEDED_GUESTS.map((guest) => ({ ...guest })));
  invitees.length = 0;
});

const seatOf = (tables, tableIndex, seatIndex) => tables[tableIndex].seats[seatIndex];

test('removing a party frees the seats its people held, across different tables, and leaves other guests\' seats alone', async () => {
  const [napoleon, sirosena] = await createInviteesForGuest('g2', ['Napoleon', 'Sirosena']);
  napoleon.rsvpStatus = 'accepted';
  sirosena.rsvpStatus = 'accepted';

  const table3 = await createSeatingTable({ tableNumber: 3, capacity: 2 });
  const table4 = await createSeatingTable({ tableNumber: 4, capacity: 2 });
  await assignInviteeToSeat(table3.seats[0].id, napoleon.id, { dietaryRequirements: 'Vegetarian', specialNotes: 'Near the door' });
  await assignInviteeToSeat(table4.seats[0].id, sirosena.id);
  await assignGuestToSeat(table3.seats[1].id, 'g1', {});

  const removed = await removeGuest('g2');

  assert.equal(removed.id, 'g2');
  assert.equal(guestStore.find((guest) => guest.id === 'g2').isDeleted, true);

  const tables = await listSeatingTables();
  assert.equal(seatOf(tables, 0, 0).inviteeId, null, "Napoleon's seat on Table 3 is open again");
  assert.equal(seatOf(tables, 0, 0).inviteeName, null);
  assert.equal(seatOf(tables, 0, 0).dietaryRequirements, null, 'his dietary requirements do not stay on the empty seat');
  assert.equal(seatOf(tables, 0, 0).specialNotes, null);
  assert.equal(seatOf(tables, 1, 0).inviteeId, null, "Sirosena's seat on Table 4 is open again");
  assert.equal(seatOf(tables, 0, 1).guestId, 'g1', "another guest's seat is untouched");
});

test('removing a party keeps its people\'s records, so RSVP history is preserved', async () => {
  await createInviteesForGuest('g2', ['Napoleon', 'Sirosena']);

  await removeGuest('g2');

  assert.equal((await listInviteesForGuest('g2')).length, 2);
});

test('removing a guest who holds a whole-guest seat frees it and wipes its notes', async () => {
  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  await assignGuestToSeat(table.seats[0].id, 'g1', { dietaryRequirements: 'Vegan', specialNotes: 'Wheelchair' });

  await removeGuest('g1');

  const [after] = await listSeatingTables();
  assert.equal(after.seats[0].guestId, null);
  assert.equal(after.seats[0].guestName, null);
  assert.equal(after.seats[0].dietaryRequirements, null);
  assert.equal(after.seats[0].specialNotes, null);
});

test('removing a guest who holds no seat still works', async () => {
  const removed = await removeGuest('g1');

  assert.equal(removed.id, 'g1');
  assert.equal(guestStore.find((guest) => guest.id === 'g1').isDeleted, true);
});

test('removing an unknown guest returns null and changes no seat', async () => {
  const table = await createSeatingTable({ tableNumber: 1, capacity: 1 });
  await assignGuestToSeat(table.seats[0].id, 'g1', {});

  assert.equal(await removeGuest('does-not-exist'), null);

  const [after] = await listSeatingTables();
  assert.equal(after.seats[0].guestId, 'g1');
});

// --- the seating pool and the Balance to Arrange count ---------------------------
//
// The table window's "Accepted invitees" picker and its Balance to Arrange card
// both come from listUnassignedInvitees. It used to skip nothing: a removed
// guest's people, accepted but no longer seated, stayed on it and in the count
// (Next Action 57). Freeing their seats on removal made that visible.

async function acceptAll(guestId, people) {
  await updateInviteeRsvpStatuses(
    guestId,
    people.map((person) => ({ id: person.id, attending: true }))
  );
}

async function balanceToArrange() {
  return buildDashboardStats({
    tables: await listSeatingTables(),
    assignedGuests: [],
    unassignedGuests: await listUnassignedGuests(),
    unassignedInvitees: await listUnassignedInvitees(),
    rsvpStats: { accepted: 0, declined: 0, pending: 0 },
  }).balanceToArrange;
}

const unassignedNames = async () => (await listUnassignedInvitees()).map((invitee) => invitee.name);

test('removing a whole party takes all of its people out of the unassigned list and the count, seated or not', async () => {
  guestStore.find((guest) => guest.id === 'g1').rsvpStatus = 'pending';
  const people = await createInviteesForGuest('g2', ['Pall', 'Sinesy', 'Kamal', 'Nimal']);
  await acceptAll('g2', people);
  const table = await createSeatingTable({ tableNumber: 3, capacity: 4 });
  await assignInviteeToSeat(table.seats[0].id, people[0].id);
  await assignInviteeToSeat(table.seats[1].id, people[1].id);
  await assignInviteeToSeat(table.seats[2].id, people[2].id);
  assert.deepEqual(await unassignedNames(), ['Nimal'], 'before removal only the unseated person is waiting');

  await removeGuest('g2');

  assert.deepEqual(await unassignedNames(), []);
  assert.equal(await balanceToArrange(), 0);
});

test("a removed party's people leave the list, but another party's unseated people still count", async () => {
  const anula = await createInviteesForGuest('g1', ['Anula']);
  const elvis = await createInviteesForGuest('g2', ['Napoleon', 'Sirosena']);
  await acceptAll('g1', anula);
  await acceptAll('g2', elvis);
  assert.equal(await balanceToArrange(), 3);

  await removeGuest('g2');

  assert.deepEqual(await unassignedNames(), ['Anula']);
  assert.equal(await balanceToArrange(), 1);
});

test('removing people one at a time leaves them out of the list and the count', async () => {
  guestStore.find((guest) => guest.id === 'g1').rsvpStatus = 'pending';
  const people = await createInviteesForGuest('g2', ['Pall', 'Sinesy', 'Kamal']);
  await acceptAll('g2', people);
  const table = await createSeatingTable({ tableNumber: 3, capacity: 3 });
  await assignInviteeToSeat(table.seats[0].id, people[0].id);
  await assignInviteeToSeat(table.seats[1].id, people[1].id);

  await removeInviteeFromParty('g2', people[0].id);
  await removeInviteeFromParty('g2', people[1].id);

  assert.deepEqual(await unassignedNames(), ['Kamal']);
  assert.equal(await balanceToArrange(), 1);
});
