import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { saveWholePartyRsvp, saveInviteeRsvp } from '../src/rsvp/saveRsvp.js';
import { createInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { invitees } from '../src/data/inviteesStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';
import { guestStore } from '../src/data/guestStore.js';

// A saved RSVP is two or three writes (the rsvp_responses row, guests.rsvp_status
// and, for a party with named invitees, each invitee's own answer). They used to
// be separate database calls, so a failure between them left the guest looking
// "pending" to the admin after the guest had been told "saved" (Next Action 19d).
//
// There is no Postgres in the test environment, so these tests hand the save
// functions a fake `transaction` that logs every statement and the BEGIN /
// COMMIT / ROLLBACK around them, the way src/db.js's withTransaction() does. What
// they prove is the shape of the work: every statement runs through the one
// transaction handle, the guest row is locked first, and a failure anywhere
// propagates so the transaction rolls back instead of being swallowed. They
// cannot prove the SQL itself against a real database.

const GUEST_ID = '11111111-1111-4111-8111-111111111111';

function label(sql) {
  if (/FROM guests WHERE id = \$1 FOR UPDATE/.test(sql)) return 'LOCK guest';
  if (/^SELECT id FROM rsvp_responses/.test(sql)) return 'FIND response';
  if (/^INSERT INTO rsvp_responses/.test(sql)) return 'INSERT response';
  if (/^UPDATE rsvp_responses/.test(sql)) return 'UPDATE response';
  if (/^SELECT \* FROM rsvp_responses/.test(sql)) return 'READ response';
  if (/^SELECT \* FROM invitees/.test(sql)) return 'READ invitees';
  if (/^UPDATE invitees/.test(sql)) return 'UPDATE invitee';
  if (/^UPDATE guests SET rsvp_status/.test(sql)) return 'SET guest status';
  return sql;
}

function fakeTransaction({ failWhen, existingResponse = false, inviteeRows = [] } = {}) {
  const events = [];
  const statements = [];
  const rows = inviteeRows.map((row) => ({ ...row }));

  const respond = (sql, params) => {
    switch (label(sql)) {
      case 'LOCK guest':
        return [{ id: GUEST_ID }];
      case 'FIND response':
        return existingResponse ? [{ id: 'response-1' }] : [];
      case 'READ response':
        return [{ guest_id: GUEST_ID, attending: true, participant_names: [], submitted_at: null, updated_at: null }];
      case 'READ invitees':
        return rows.map((row) => ({ ...row }));
      case 'UPDATE invitee': {
        const [status, id] = params;
        const row = rows.find((entry) => entry.id === id);
        if (row) row.rsvp_status = status;
        return [];
      }
      default:
        return [];
    }
  };

  const transaction = async (work) => {
    events.push('BEGIN');
    const exec = async (text, params) => {
      const sql = text.replace(/\s+/g, ' ').trim();
      events.push(label(sql));
      statements.push({ label: label(sql), params });
      if (failWhen && failWhen.test(label(sql))) throw new Error('simulated database failure');
      return { rows: respond(sql, params) };
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

const inviteeRow = (id, name, rsvpStatus = 'pending') => ({
  id,
  guest_id: GUEST_ID,
  name,
  rsvp_status: rsvpStatus,
  added_by: 'admin',
  approval_status: 'approved',
  display_order: 0,
});

beforeEach(() => {
  invitees.length = 0;
  rsvpResponses.length = 0;
  guestStore.find((guest) => guest.id === 'guest-1').rsvpStatus = 'pending';
});

// --- whole-party RSVP (one accept/decline, free-text names) ---------------------

test('whole-party save locks the guest, writes the response and the status, then commits', async () => {
  const { transaction, events } = fakeTransaction();

  await saveWholePartyRsvp(GUEST_ID, { attending: true, participantNames: ['Nimal'] }, { transaction });

  assert.deepEqual(events, [
    'BEGIN',
    'LOCK guest',
    'FIND response',
    'INSERT response',
    'READ response',
    'SET guest status',
    'COMMIT',
  ]);
});

test('whole-party save updates the existing response row instead of inserting a second one', async () => {
  const { transaction, events } = fakeTransaction({ existingResponse: true });

  await saveWholePartyRsvp(GUEST_ID, { attending: true, participantNames: [] }, { transaction });

  assert.ok(events.includes('UPDATE response'));
  assert.ok(!events.includes('INSERT response'));
});

test('whole-party save rolls back, and reports the failure, when the guest status write fails', async () => {
  const { transaction, events } = fakeTransaction({ failWhen: /SET guest status/ });

  await assert.rejects(
    saveWholePartyRsvp(GUEST_ID, { attending: true, participantNames: [] }, { transaction }),
    /simulated database failure/
  );

  assert.equal(events.at(-1), 'ROLLBACK');
  assert.ok(!events.includes('COMMIT'), 'a half-finished RSVP must never be committed');
});

test('whole-party save stops at a failed response write and never touches the guest status', async () => {
  const { transaction, events } = fakeTransaction({ failWhen: /INSERT response/ });

  await assert.rejects(
    saveWholePartyRsvp(GUEST_ID, { attending: true, participantNames: [] }, { transaction }),
    /simulated database failure/
  );

  assert.ok(!events.includes('SET guest status'));
  assert.equal(events.at(-1), 'ROLLBACK');
});

test('whole-party save stores accepted/declined on the guest and drops names on a decline', async () => {
  const accepted = fakeTransaction();
  await saveWholePartyRsvp(GUEST_ID, { attending: true, participantNames: ['Nimal'] }, { transaction: accepted.transaction });
  const acceptedInsert = accepted.statements.find((entry) => entry.label === 'INSERT response');
  assert.deepEqual(acceptedInsert.params, [GUEST_ID, true, ['Nimal']]);
  assert.deepEqual(accepted.statements.find((entry) => entry.label === 'SET guest status').params, ['accepted', GUEST_ID]);

  const declined = fakeTransaction();
  await saveWholePartyRsvp(GUEST_ID, { attending: false, participantNames: ['Nimal'] }, { transaction: declined.transaction });
  const declinedInsert = declined.statements.find((entry) => entry.label === 'INSERT response');
  assert.deepEqual(declinedInsert.params, [GUEST_ID, false, []]);
  assert.deepEqual(declined.statements.find((entry) => entry.label === 'SET guest status').params, ['declined', GUEST_ID]);
});

// --- per-invitee RSVP (multi-person invitation) ---------------------------------

test('invitee save writes every invitee, the response and the status in one transaction', async () => {
  const { transaction, events, statements } = fakeTransaction({
    inviteeRows: [inviteeRow('inv-a', 'Nimal'), inviteeRow('inv-b', 'Kamala')],
  });

  await saveInviteeRsvp(
    GUEST_ID,
    [
      { id: 'inv-a', attending: true },
      { id: 'inv-b', attending: false },
    ],
    { transaction }
  );

  assert.equal(events[0], 'BEGIN');
  assert.equal(events[1], 'LOCK guest');
  assert.equal(events.at(-1), 'COMMIT');
  assert.equal(events.filter((entry) => entry === 'UPDATE invitee').length, 2);
  assert.ok(events.indexOf('SET guest status') > events.lastIndexOf('UPDATE invitee'));

  // One accepted, one declined: the party is accepted, and only the accepted
  // person's name is mirrored into rsvp_responses.
  assert.deepEqual(statements.find((entry) => entry.label === 'SET guest status').params, ['accepted', GUEST_ID]);
  assert.deepEqual(statements.find((entry) => entry.label === 'INSERT response').params, [GUEST_ID, true, ['Nimal']]);
});

test('invitee save re-reads invitees inside the transaction, so it sees its own uncommitted updates', async () => {
  const { transaction, statements } = fakeTransaction({
    inviteeRows: [inviteeRow('inv-a', 'Nimal'), inviteeRow('inv-b', 'Kamala')],
  });

  await saveInviteeRsvp(
    GUEST_ID,
    [
      { id: 'inv-a', attending: false },
      { id: 'inv-b', attending: false },
    ],
    { transaction }
  );

  // Both declined, which is only derivable from the rows as updated above.
  assert.deepEqual(statements.find((entry) => entry.label === 'SET guest status').params, ['declined', GUEST_ID]);
});

test('invitee save rolls back, and reports the failure, when the guest status write fails', async () => {
  const { transaction, events } = fakeTransaction({
    failWhen: /SET guest status/,
    inviteeRows: [inviteeRow('inv-a', 'Nimal')],
  });

  await assert.rejects(
    saveInviteeRsvp(GUEST_ID, [{ id: 'inv-a', attending: true }], { transaction }),
    /simulated database failure/
  );

  assert.equal(events.at(-1), 'ROLLBACK');
  assert.ok(!events.includes('COMMIT'));
});

test('invitee save rolls back the invitee updates when the response write fails', async () => {
  const { transaction, events } = fakeTransaction({
    failWhen: /INSERT response/,
    inviteeRows: [inviteeRow('inv-a', 'Nimal')],
  });

  await assert.rejects(
    saveInviteeRsvp(GUEST_ID, [{ id: 'inv-a', attending: true }], { transaction }),
    /simulated database failure/
  );

  assert.ok(events.includes('UPDATE invitee'), 'the invitee update was attempted inside the transaction');
  assert.equal(events.at(-1), 'ROLLBACK');
  assert.ok(!events.includes('COMMIT'));
});

test('invitee save ignores an id that is not one of the guest\'s approved invitees', async () => {
  const { transaction, events } = fakeTransaction({ inviteeRows: [inviteeRow('inv-a', 'Nimal')] });

  await saveInviteeRsvp(GUEST_ID, [{ id: 'someone-elses-invitee', attending: true }], { transaction });

  assert.ok(!events.includes('UPDATE invitee'));
});

// --- in-memory mode (no DATABASE_URL), the default when no transaction is injected

test('in-memory whole-party save records the response and the guest status', async () => {
  const result = await saveWholePartyRsvp('guest-1', { attending: true, participantNames: ['Nimal'] });

  assert.equal(result.attending, true);
  assert.deepEqual(rsvpResponses.find((entry) => entry.guestId === 'guest-1').participantNames, ['Nimal']);
  assert.equal(guestStore.find((guest) => guest.id === 'guest-1').rsvpStatus, 'accepted');
});

test('in-memory whole-party save overwrites a previous answer rather than duplicating it', async () => {
  await saveWholePartyRsvp('guest-1', { attending: true, participantNames: ['Nimal'] });
  await saveWholePartyRsvp('guest-1', { attending: false, participantNames: [] });

  assert.equal(rsvpResponses.filter((entry) => entry.guestId === 'guest-1').length, 1);
  assert.equal(rsvpResponses[0].attending, false);
  assert.equal(guestStore.find((guest) => guest.id === 'guest-1').rsvpStatus, 'declined');
});

test('in-memory invitee save derives the party status from the individual answers', async () => {
  const [first, second] = await createInviteesForGuest('guest-1', ['Nimal', 'Kamala']);

  await saveInviteeRsvp('guest-1', [
    { id: first.id, attending: true },
    { id: second.id, attending: false },
  ]);

  assert.equal(guestStore.find((guest) => guest.id === 'guest-1').rsvpStatus, 'accepted');
  assert.deepEqual(rsvpResponses.find((entry) => entry.guestId === 'guest-1').participantNames, ['Nimal']);
});
