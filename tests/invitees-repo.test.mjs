import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createInviteesForGuest,
  listInviteesForGuest,
  listApprovedInvitees,
  listPendingApprovalInvitees,
  approveInvitee,
  rejectInvitee,
  updateInviteeRsvpStatuses,
  requestNewInvitee,
  deriveGuestRsvpStatus,
  deleteInvitee,
  getInviteeById,
} from '../src/invitees/inviteesRepo.js';
import { validateInviteeNames, validateRequestedInviteeName } from '../src/invitees/validateInvitees.js';
import { invitees } from '../src/data/inviteesStore.js';

beforeEach(() => {
  invitees.length = 0;
});

test('validateInviteeNames rejects a non-array', () => {
  const result = validateInviteeNames('John');
  assert.equal(result.valid, false);
});

test('validateInviteeNames rejects an empty-string name', () => {
  const result = validateInviteeNames(['John', '  ']);
  assert.equal(result.valid, false);
});

test('validateInviteeNames trims and accepts a valid list', () => {
  const result = validateInviteeNames([' John ', 'Maria']);
  assert.equal(result.valid, true);
  assert.deepEqual(result.names, ['John', 'Maria']);
});

test('validateRequestedInviteeName rejects blank input', () => {
  assert.equal(validateRequestedInviteeName('   ').valid, false);
});

test('validateRequestedInviteeName trims and accepts a name', () => {
  const result = validateRequestedInviteeName(' Sarah ');
  assert.equal(result.valid, true);
  assert.equal(result.name, 'Sarah');
});

test('createInviteesForGuest creates one row per name, admin-added and pre-approved', async () => {
  const created = await createInviteesForGuest('guest-1', ['John', 'Maria', 'Sarah']);
  assert.equal(created.length, 3);
  assert.equal(created[0].addedBy, 'admin');
  assert.equal(created[0].approvalStatus, 'approved');
  assert.equal(created[0].rsvpStatus, 'pending');
  assert.deepEqual(created.map((i) => i.displayOrder), [0, 1, 2]);
});

test('listInviteesForGuest returns invitees in display order', async () => {
  await createInviteesForGuest('guest-1', ['John', 'Maria']);
  const list = await listInviteesForGuest('guest-1');
  assert.deepEqual(list.map((i) => i.name), ['John', 'Maria']);
});

test('listApprovedInvitees excludes pending-approval requests', async () => {
  await createInviteesForGuest('guest-1', ['John']);
  await requestNewInvitee('guest-1', 'Extra Person');

  const approved = await listApprovedInvitees('guest-1');
  assert.equal(approved.length, 1);
  assert.equal(approved[0].name, 'John');
});

test('requestNewInvitee creates a guest-added, pending_approval row', async () => {
  await createInviteesForGuest('guest-1', ['John']);
  const requested = await requestNewInvitee('guest-1', 'Extra Person');

  assert.equal(requested.addedBy, 'guest');
  assert.equal(requested.approvalStatus, 'pending_approval');
  assert.equal(requested.displayOrder, 1); // appended after the existing invitee
});

test('listPendingApprovalInvitees only returns guest-requested, unapproved rows across guests', async () => {
  await createInviteesForGuest('guest-1', ['John']);
  await requestNewInvitee('guest-1', 'Extra 1');
  await requestNewInvitee('guest-2', 'Extra 2');

  const pending = await listPendingApprovalInvitees();
  assert.equal(pending.length, 2);
  assert.deepEqual(pending.map((i) => i.name).sort(), ['Extra 1', 'Extra 2']);
});

test('approveInvitee moves a request to approved', async () => {
  const requested = await requestNewInvitee('guest-1', 'Extra Person');
  const result = await approveInvitee(requested.id);

  assert.equal(result.success, true);
  assert.equal(result.invitee.approvalStatus, 'approved');

  const approved = await listApprovedInvitees('guest-1');
  assert.equal(approved.length, 1);
});

test('approveInvitee returns not-found for an unknown id', async () => {
  const result = await approveInvitee('does-not-exist');
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invitee_not_found');
});

test('rejectInvitee excludes the row from approved lists permanently', async () => {
  const requested = await requestNewInvitee('guest-1', 'Extra Person');
  await rejectInvitee(requested.id);

  const pending = await listPendingApprovalInvitees();
  assert.equal(pending.length, 0);
  const approved = await listApprovedInvitees('guest-1');
  assert.equal(approved.length, 0);
});

test('updateInviteeRsvpStatuses updates only approved invitees belonging to that guest', async () => {
  const [john, maria] = await createInviteesForGuest('guest-1', ['John', 'Maria']);
  const pendingRequest = await requestNewInvitee('guest-1', 'Extra');

  const result = await updateInviteeRsvpStatuses('guest-1', [
    { id: john.id, attending: true },
    { id: maria.id, attending: false },
    { id: pendingRequest.id, attending: true }, // not approved yet -- ignored
    { id: 'someone-elses-id', attending: true }, // wrong guest -- ignored
  ]);

  const byId = Object.fromEntries(result.map((i) => [i.id, i]));
  assert.equal(byId[john.id].rsvpStatus, 'accepted');
  assert.equal(byId[maria.id].rsvpStatus, 'declined');
});

test('updateInviteeRsvpStatuses ignores an id belonging to a different guest', async () => {
  const [ownInvitee] = await createInviteesForGuest('guest-1', ['John']);
  const [otherInvitee] = await createInviteesForGuest('guest-2', ['Someone Else']);

  await updateInviteeRsvpStatuses('guest-1', [
    { id: ownInvitee.id, attending: true },
    { id: otherInvitee.id, attending: true },
  ]);

  const otherAfter = (await listApprovedInvitees('guest-2'))[0];
  assert.equal(otherAfter.rsvpStatus, 'pending');
});

test('deriveGuestRsvpStatus is accepted as soon as any approved invitee accepts', () => {
  const status = deriveGuestRsvpStatus([
    { approvalStatus: 'approved', rsvpStatus: 'accepted' },
    { approvalStatus: 'approved', rsvpStatus: 'pending' },
    { approvalStatus: 'approved', rsvpStatus: 'declined' },
  ]);
  assert.equal(status, 'accepted');
});

test('deriveGuestRsvpStatus is declined only once every approved invitee has declined', () => {
  const allDeclined = deriveGuestRsvpStatus([
    { approvalStatus: 'approved', rsvpStatus: 'declined' },
    { approvalStatus: 'approved', rsvpStatus: 'declined' },
  ]);
  assert.equal(allDeclined, 'declined');

  const mixedNoAccept = deriveGuestRsvpStatus([
    { approvalStatus: 'approved', rsvpStatus: 'declined' },
    { approvalStatus: 'approved', rsvpStatus: 'pending' },
  ]);
  assert.equal(mixedNoAccept, 'pending');
});

test('deriveGuestRsvpStatus ignores pending-approval invitees entirely', () => {
  const status = deriveGuestRsvpStatus([
    { approvalStatus: 'pending_approval', rsvpStatus: 'accepted' },
  ]);
  assert.equal(status, 'pending');
});

test('deriveGuestRsvpStatus is pending with no approved invitees at all', () => {
  assert.equal(deriveGuestRsvpStatus([]), 'pending');
});

test('deleteInvitee permanently removes the row', async () => {
  const [john, maria] = await createInviteesForGuest('guest-1', ['John', 'Maria']);

  const result = await deleteInvitee(john.id);
  assert.equal(result.success, true);
  assert.equal(result.invitee.name, 'John');

  assert.equal(await getInviteeById(john.id), null);
  const remaining = await listInviteesForGuest('guest-1');
  assert.deepEqual(remaining.map((i) => i.id), [maria.id]);
});

test('deleteInvitee returns not-found for an unknown id', async () => {
  const result = await deleteInvitee('does-not-exist');
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invitee_not_found');
});
