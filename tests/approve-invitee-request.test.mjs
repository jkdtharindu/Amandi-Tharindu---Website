import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { approveInviteeRequest } from '../src/invitees/approveInviteeRequest.js';
import { buildPendingRequests } from '../src/invitees/pendingRequests.js';
import {
  createInviteesForGuest,
  listInviteesForGuest,
  listPendingApprovalInvitees,
  rejectInvitee,
  updateInviteeRsvpStatuses,
} from '../src/invitees/inviteesRepo.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';

// Approving a guest's "add another person" request was three separate writes with
// nothing tying them together, so a failure in between left the person approved and
// the headcount one short (Next Action 55). Approving one twice also added one to
// the headcount each time. And a removed guest's request stayed on the approval
// list (Next Action 58).
//
// There is no Postgres in the test environment. The first group hands the function a
// fake `transaction` that logs every statement and the BEGIN / COMMIT / ROLLBACK
// around them, the way src/db.js's withTransaction() does: it proves the shape of the
// work, not the SQL against a real database. The second group runs the same scenarios
// against the in-memory stores, which is where the end state is proved.

const GUEST_ID = 'g1';

function label(sql) {
  if (/FROM guests WHERE id = \$1 FOR UPDATE/.test(sql)) return 'LOCK guest';
  if (/^SELECT \* FROM invitees/.test(sql)) return 'READ invitees';
  if (/^UPDATE invitees SET approval_status = 'approved'/.test(sql)) return 'APPROVE invitee';
  if (/^UPDATE guests SET slot_count = slot_count \+ 1/.test(sql)) return 'ADD ONE to headcount';
  if (/^UPDATE guests SET rsvp_status/.test(sql)) return 'SET guest status';
  return sql;
}

const row = (id, name, { rsvpStatus = 'pending', approvalStatus = 'approved' } = {}) => ({
  id,
  guest_id: GUEST_ID,
  name,
  rsvp_status: rsvpStatus,
  added_by: approvalStatus === 'approved' ? 'admin' : 'guest',
  approval_status: approvalStatus,
  display_order: 0,
});

function fakeTransaction({ failWhen, inviteeRows }) {
  const events = [];
  const statements = [];
  const rows = inviteeRows.map((entry) => ({ ...entry }));

  const respond = (name, params) => {
    switch (name) {
      case 'LOCK guest':
        return [{ id: GUEST_ID }];
      case 'READ invitees':
        return rows.map((entry) => ({ ...entry }));
      case 'APPROVE invitee': {
        const target = rows.find((entry) => entry.id === params[0]);
        if (!target) return [];
        target.approval_status = 'approved';
        return [{ ...target }];
      }
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

beforeEach(() => {
  invitees.length = 0;
  guestStore.length = 0;
  guestStore.push(
    { id: 'g1', code: 'A-001', name: 'Silva Family', relationship: 'Family', slotCount: 2, whatsappNumber: null, email: null, rsvpStatus: 'pending', isDeleted: false, hasVisited: false },
    { id: 'g2', code: 'A-002', name: 'Gone Family', relationship: 'Friend', slotCount: 1, whatsappNumber: null, email: null, rsvpStatus: 'pending', isDeleted: true, hasVisited: false }
  );
});

// The fake transaction reads its rows from a fake database, but the two reads that
// happen before the transaction opens use the in-memory stores, so those are seeded too.
async function seedPendingRequest(guestId = GUEST_ID) {
  const [created] = await createInviteesForGuest(guestId, ['Cousin Kamal'], {
    addedBy: 'guest',
    approvalStatus: 'pending_approval',
  });
  return created;
}

// --- one transaction, in order ---------------------------------------------------

test('approving runs every write in one transaction, under the guest lock, and commits', async () => {
  const request = await seedPendingRequest();
  const { transaction, events } = fakeTransaction({
    inviteeRows: [row('i-old', 'Nimal'), { ...row(request.id, 'Cousin Kamal', { approvalStatus: 'pending_approval' }) }],
  });

  const result = await approveInviteeRequest(request.id, { transaction });

  assert.equal(result.success, true);
  assert.deepEqual(
    events.filter((name) => name !== 'READ invitees'),
    ['BEGIN', 'LOCK guest', 'APPROVE invitee', 'ADD ONE to headcount', 'SET guest status', 'COMMIT']
  );
});

test('a failure adding to the headcount rolls the approval back, so the person is never approved with the count one short', async () => {
  const request = await seedPendingRequest();
  const { transaction, events } = fakeTransaction({
    failWhen: /^ADD ONE to headcount$/,
    inviteeRows: [row('i-old', 'Nimal'), row(request.id, 'Cousin Kamal', { approvalStatus: 'pending_approval' })],
  });

  await assert.rejects(approveInviteeRequest(request.id, { transaction }), /simulated database failure/);

  assert.ok(events.includes('APPROVE invitee'), 'the approval was attempted inside the transaction');
  assert.equal(events.at(-1), 'ROLLBACK');
  assert.ok(!events.includes('COMMIT'), 'a half-finished approval must never be committed');
});

test('a failure saving the status rolls everything back too', async () => {
  const request = await seedPendingRequest();
  const { transaction, events } = fakeTransaction({
    failWhen: /^SET guest status$/,
    inviteeRows: [row('i-old', 'Nimal'), row(request.id, 'Cousin Kamal', { approvalStatus: 'pending_approval' })],
  });

  await assert.rejects(approveInviteeRequest(request.id, { transaction }), /simulated database failure/);

  assert.equal(events.at(-1), 'ROLLBACK');
  assert.ok(!events.includes('COMMIT'));
});

test('a request that is no longer waiting writes nothing inside the transaction', async () => {
  const request = await seedPendingRequest();
  const { transaction, events } = fakeTransaction({
    inviteeRows: [row(request.id, 'Cousin Kamal', { approvalStatus: 'approved' })],
  });

  const result = await approveInviteeRequest(request.id, { transaction });

  assert.deepEqual(result, { success: false, reason: 'not_pending' });
  assert.ok(!events.includes('APPROVE invitee'));
  assert.ok(!events.includes('ADD ONE to headcount'));
});

// --- end state, in memory --------------------------------------------------------

test('approving marks the person approved and adds exactly one to the headcount', async () => {
  await createInviteesForGuest('g1', ['Nimal', 'Kamala']);
  const request = await seedPendingRequest();

  const result = await approveInviteeRequest(request.id);

  assert.equal(result.success, true);
  assert.equal(result.invitee.approvalStatus, 'approved');
  assert.equal(guestStore.find((guest) => guest.id === 'g1').slotCount, 3);
});

test('approving the same request twice adds to the headcount only once', async () => {
  const request = await seedPendingRequest();

  const first = await approveInviteeRequest(request.id);
  const second = await approveInviteeRequest(request.id);

  assert.equal(first.success, true);
  assert.deepEqual(second, { success: false, reason: 'not_pending' });
  assert.equal(guestStore.find((guest) => guest.id === 'g1').slotCount, 3);
});

test('a rejected request cannot be approved afterwards', async () => {
  const request = await seedPendingRequest();
  await rejectInvitee(request.id);

  const result = await approveInviteeRequest(request.id);

  assert.deepEqual(result, { success: false, reason: 'not_pending' });
  assert.equal(guestStore.find((guest) => guest.id === 'g1').slotCount, 2);
});

test('approving an unknown request reports not found and changes nothing', async () => {
  const result = await approveInviteeRequest('no-such-request');

  assert.deepEqual(result, { success: false, reason: 'invitee_not_found' });
  assert.equal(guestStore.find((guest) => guest.id === 'g1').slotCount, 2);
});

test('a removed guest\'s request is refused and nothing changes', async () => {
  const request = await seedPendingRequest('g2');

  const result = await approveInviteeRequest(request.id);

  assert.deepEqual(result, { success: false, reason: 'guest_removed' });
  assert.equal(guestStore.find((guest) => guest.id === 'g2').slotCount, 1);
  const [stillPending] = await listInviteesForGuest('g2');
  assert.equal(stillPending.approvalStatus, 'pending_approval');
});

test('approving someone undecided moves a fully declined party back to pending', async () => {
  const [nimal] = await createInviteesForGuest('g1', ['Nimal']);
  await updateInviteeRsvpStatuses('g1', [{ id: nimal.id, attending: false }]);
  guestStore.find((guest) => guest.id === 'g1').rsvpStatus = 'declined';
  const request = await seedPendingRequest();

  await approveInviteeRequest(request.id);

  assert.equal(guestStore.find((guest) => guest.id === 'g1').rsvpStatus, 'pending');
});

test('approving someone undecided leaves an accepted party accepted', async () => {
  const [nimal] = await createInviteesForGuest('g1', ['Nimal']);
  await updateInviteeRsvpStatuses('g1', [{ id: nimal.id, attending: true }]);
  guestStore.find((guest) => guest.id === 'g1').rsvpStatus = 'accepted';
  const request = await seedPendingRequest();

  await approveInviteeRequest(request.id);

  assert.equal(guestStore.find((guest) => guest.id === 'g1').rsvpStatus, 'accepted');
});

// --- the approval list (Next Action 58) ------------------------------------------

test('the approval list leaves out requests from removed guests and keeps the rest', async () => {
  const keep = await seedPendingRequest('g1');
  await seedPendingRequest('g2');

  const list = buildPendingRequests(await listPendingApprovalInvitees(), guestStore);

  assert.deepEqual(list.map((entry) => entry.id), [keep.id]);
  assert.equal(list[0].guestName, 'Silva Family');
  assert.equal(list[0].guestCode, 'A-001');
});

test('the approval list leaves out a request whose guest no longer exists', async () => {
  await seedPendingRequest('g1');
  const orphan = { id: 'x', name: 'Ghost', createdAt: '2026-09-20', guestId: 'no-such-guest' };

  const list = buildPendingRequests([orphan], guestStore);

  assert.deepEqual(list, []);
});
