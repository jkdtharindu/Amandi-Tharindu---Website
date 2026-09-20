import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { removeInviteeFromParty } from '../src/invitees/removeInvitee.js';
import { createInviteesForGuest, listInviteesForGuest, updateInviteeRsvpStatuses } from '../src/invitees/inviteesRepo.js';
import { createSeatingTable, assignInviteeToSeat, listSeatingTables } from '../src/table-arrangement/tableArrangementRepo.js';
import { invitees } from '../src/data/inviteesStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';
import { guestStore } from '../src/data/guestStore.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';

// Removing one person from a party is several writes: free their seat, delete
// them, save the party's RSVP response and status from whoever is left, and fix
// the headcount. The RSVP pair used to sit in a try/catch that only logged, so
// a failure there told the admin "removed" while the party's status stayed stale
// (Next Action 50).
//
// There is no Postgres in the test environment, so these tests hand the function
// a fake `transaction` that logs every statement and the BEGIN / COMMIT /
// ROLLBACK around them, the way src/db.js's withTransaction() does. What they
// prove is the shape of the work: every statement runs through the one
// transaction handle, in a sensible order, and a failure anywhere propagates so
// the transaction rolls back. They cannot prove the SQL against a real database.

const GUEST_ID = '11111111-1111-4111-8111-111111111111';

function label(sql) {
  if (/FROM guests WHERE id = \$1 FOR UPDATE/.test(sql)) return 'LOCK guest';
  if (/^SELECT \* FROM invitees/.test(sql)) return 'READ invitees';
  if (/^UPDATE table_seats/.test(sql)) return 'CLEAR seat';
  if (/^DELETE FROM invitees/.test(sql)) return 'DELETE invitee';
  if (/^SELECT id FROM rsvp_responses/.test(sql)) return 'FIND response';
  if (/^INSERT INTO rsvp_responses/.test(sql)) return 'INSERT response';
  if (/^UPDATE rsvp_responses/.test(sql)) return 'UPDATE response';
  if (/^SELECT \* FROM rsvp_responses/.test(sql)) return 'READ response';
  if (/^UPDATE guests SET rsvp_status/.test(sql)) return 'SET guest status';
  if (/^UPDATE guests SET slot_count/.test(sql)) return 'SET headcount';
  return sql;
}

function fakeTransaction({ failWhen, inviteeRows = [] } = {}) {
  const events = [];
  const statements = [];
  const rows = inviteeRows.map((row) => ({ ...row }));

  const respond = (name, params) => {
    switch (name) {
      case 'LOCK guest':
        return [{ id: GUEST_ID }];
      case 'READ invitees':
        return rows.map((row) => ({ ...row }));
      case 'DELETE invitee': {
        const index = rows.findIndex((row) => row.id === params[0]);
        return index === -1 ? [] : rows.splice(index, 1);
      }
      case 'FIND response':
        return [];
      case 'READ response':
        return [{ guest_id: GUEST_ID, attending: false, participant_names: [], submitted_at: null, updated_at: null }];
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
      return { rows: respond(name, params) };
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

const inviteeRow = (id, name, { rsvpStatus = 'pending', approvalStatus = 'approved' } = {}) => ({
  id,
  guest_id: GUEST_ID,
  name,
  rsvp_status: rsvpStatus,
  added_by: 'admin',
  approval_status: approvalStatus,
  display_order: 0,
});

const WRITE_STEPS = ['CLEAR seat', 'DELETE invitee', 'INSERT response', 'UPDATE response', 'SET guest status', 'SET headcount'];

beforeEach(() => {
  invitees.length = 0;
  rsvpResponses.length = 0;
  seatingTables.length = 0;
  const guest = guestStore.find((entry) => entry.id === 'guest-1');
  guest.rsvpStatus = 'pending';
  guest.slotCount = 2;
});

// --- one transaction, in order ---------------------------------------------------

test('removal locks the guest, clears the seat, deletes, then saves status and headcount, and commits', async () => {
  const { transaction, events } = fakeTransaction({
    inviteeRows: [inviteeRow('inv-a', 'Nimal'), inviteeRow('inv-b', 'Kamala')],
  });

  const result = await removeInviteeFromParty(GUEST_ID, 'inv-a', { transaction });

  assert.equal(result.success, true);
  assert.deepEqual(events, [
    'BEGIN',
    'LOCK guest',
    'READ invitees',
    'CLEAR seat',
    'DELETE invitee',
    'READ invitees',
    'FIND response',
    'INSERT response',
    'READ response',
    'SET guest status',
    'SET headcount',
    'COMMIT',
  ]);
});

test('the seat is cleared before the person is deleted, and clearing also wipes dietary requirements and notes', async () => {
  const { transaction, events, statements } = fakeTransaction({
    inviteeRows: [inviteeRow('inv-a', 'Nimal'), inviteeRow('inv-b', 'Kamala')],
  });

  await removeInviteeFromParty(GUEST_ID, 'inv-a', { transaction });

  assert.ok(events.indexOf('CLEAR seat') < events.indexOf('DELETE invitee'));
  const clear = statements.find((entry) => entry.label === 'CLEAR seat');
  assert.deepEqual(clear.params, ['inv-a']);
  // The database's own ON DELETE SET NULL would only clear invitee_id; the old
  // seat-clearing path also wiped these two, so this one must too.
  assert.match(clear.sql, /invitee_id = NULL/);
  assert.match(clear.sql, /dietary_requirements = NULL/);
  assert.match(clear.sql, /special_notes = NULL/);
});

test('the returned list is the people left, read inside the transaction after the delete', async () => {
  const { transaction } = fakeTransaction({
    inviteeRows: [inviteeRow('inv-a', 'Nimal'), inviteeRow('inv-b', 'Kamala')],
  });

  const result = await removeInviteeFromParty(GUEST_ID, 'inv-a', { transaction });

  assert.deepEqual(result.invitees.map((invitee) => invitee.id), ['inv-b']);
});

// --- the party status follows whoever is left --------------------------------------

test('removing the only accepted person leaves the party declined when everyone else declined', async () => {
  const { transaction, statements } = fakeTransaction({
    inviteeRows: [
      inviteeRow('inv-a', 'Nimal', { rsvpStatus: 'accepted' }),
      inviteeRow('inv-b', 'Kamala', { rsvpStatus: 'declined' }),
    ],
  });

  await removeInviteeFromParty(GUEST_ID, 'inv-a', { transaction });

  assert.deepEqual(statements.find((entry) => entry.label === 'SET guest status').params, ['declined', GUEST_ID]);
  assert.deepEqual(statements.find((entry) => entry.label === 'INSERT response').params, [GUEST_ID, false, []]);
});

test('removing someone who declined keeps the party accepted and mirrors the accepted names', async () => {
  const { transaction, statements } = fakeTransaction({
    inviteeRows: [
      inviteeRow('inv-a', 'Nimal', { rsvpStatus: 'declined' }),
      inviteeRow('inv-b', 'Kamala', { rsvpStatus: 'accepted' }),
      inviteeRow('inv-c', 'Sunil', { rsvpStatus: 'declined' }),
    ],
  });

  await removeInviteeFromParty(GUEST_ID, 'inv-a', { transaction });

  assert.deepEqual(statements.find((entry) => entry.label === 'SET guest status').params, ['accepted', GUEST_ID]);
  assert.deepEqual(statements.find((entry) => entry.label === 'INSERT response').params, [GUEST_ID, true, ['Kamala']]);
});

// --- all or nothing --------------------------------------------------------------

for (const failing of ['CLEAR seat', 'DELETE invitee', 'INSERT response', 'SET guest status', 'SET headcount']) {
  test(`a failure at "${failing}" rolls everything back, reports the failure, and never commits`, async () => {
    const { transaction, events } = fakeTransaction({
      failWhen: new RegExp(`^${failing}$`),
      inviteeRows: [inviteeRow('inv-a', 'Nimal'), inviteeRow('inv-b', 'Kamala')],
    });

    await assert.rejects(removeInviteeFromParty(GUEST_ID, 'inv-a', { transaction }), /simulated database failure/);

    assert.equal(events.at(-1), 'ROLLBACK');
    assert.ok(!events.includes('COMMIT'), 'a half-finished removal must never be committed');
  });
}

test('a failed status save is no longer swallowed: the admin gets the error, not a "removed" result', async () => {
  const { transaction } = fakeTransaction({
    failWhen: /^SET guest status$/,
    inviteeRows: [inviteeRow('inv-a', 'Nimal'), inviteeRow('inv-b', 'Kamala')],
  });

  await assert.rejects(removeInviteeFromParty(GUEST_ID, 'inv-a', { transaction }), /simulated database failure/);
});

// --- refusals: nothing may be written --------------------------------------------

test('removing the last approved person is refused and writes nothing', async () => {
  const { transaction, events } = fakeTransaction({ inviteeRows: [inviteeRow('inv-a', 'Nimal')] });

  const result = await removeInviteeFromParty(GUEST_ID, 'inv-a', { transaction });

  assert.deepEqual(result, { success: false, reason: 'last_invitee' });
  assert.deepEqual(events, ['BEGIN', 'LOCK guest', 'READ invitees', 'COMMIT']);
  assert.ok(WRITE_STEPS.every((step) => !events.includes(step)));
});

test('a pending-approval request does not count as a person: with one approved person left, removing the request is allowed', async () => {
  const { transaction, events } = fakeTransaction({
    inviteeRows: [inviteeRow('inv-a', 'Nimal'), inviteeRow('inv-p', 'Requested Guest', { approvalStatus: 'pending_approval' })],
  });

  const result = await removeInviteeFromParty(GUEST_ID, 'inv-p', { transaction });

  assert.equal(result.success, true);
  assert.deepEqual(result.invitees.map((invitee) => invitee.id), ['inv-a']);
  assert.ok(events.includes('DELETE invitee'));
});

test('an id that is not one of this guest\'s people is "not found" and writes nothing', async () => {
  const { transaction, events } = fakeTransaction({ inviteeRows: [inviteeRow('inv-a', 'Nimal'), inviteeRow('inv-b', 'Kamala')] });

  const result = await removeInviteeFromParty(GUEST_ID, 'someone-elses-invitee', { transaction });

  assert.deepEqual(result, { success: false, reason: 'invitee_not_found' });
  assert.ok(WRITE_STEPS.every((step) => !events.includes(step)));
});

// --- in-memory mode (no DATABASE_URL), the default when no transaction is injected

test('in-memory removal frees the seat, deletes the person, and re-derives status and headcount', async () => {
  const [nimal, kamala] = await createInviteesForGuest('guest-1', ['Nimal', 'Kamala']);
  await updateInviteeRsvpStatuses('guest-1', [
    { id: nimal.id, attending: true },
    { id: kamala.id, attending: false },
  ]);
  const table = await createSeatingTable({ tableNumber: 1, capacity: 2 });
  await assignInviteeToSeat(table.seats[0].id, nimal.id);

  const result = await removeInviteeFromParty('guest-1', nimal.id);

  assert.equal(result.success, true);
  assert.deepEqual((await listInviteesForGuest('guest-1')).map((invitee) => invitee.name), ['Kamala']);
  const guest = guestStore.find((entry) => entry.id === 'guest-1');
  assert.equal(guest.slotCount, 1);
  assert.equal(guest.rsvpStatus, 'declined', 'only Kamala is left, and she declined');
  assert.equal(rsvpResponses.find((entry) => entry.guestId === 'guest-1').attending, false);
  const [after] = await listSeatingTables();
  assert.equal(after.seats[0].inviteeId, null, 'the seat is open again');
});

test('in-memory removal refuses the last approved person and leaves everything as it was', async () => {
  const [nimal] = await createInviteesForGuest('guest-1', ['Nimal']);
  const guest = guestStore.find((entry) => entry.id === 'guest-1');
  guest.slotCount = 1;

  const result = await removeInviteeFromParty('guest-1', nimal.id);

  assert.deepEqual(result, { success: false, reason: 'last_invitee' });
  assert.equal((await listInviteesForGuest('guest-1')).length, 1);
  assert.equal(guest.slotCount, 1, 'the headcount is never driven to 0');
});
