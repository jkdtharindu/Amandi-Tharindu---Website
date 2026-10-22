import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { renameInviteeInParty } from '../src/invitees/renameInvitee.js';
import { createInviteesForGuest, listInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';

// Fixing a plus-one's name after the invitation went out. In-memory path.

let first;
let second;

beforeEach(async () => {
  guestStore.length = 0;
  guestStore.push({ id: 'g1', code: 'FAM-001', name: 'Perera Family', relationship: 'Relations', slotCount: 2, rsvpStatus: 'accepted', isDeleted: false });
  invitees.length = 0;
  [first, second] = await createInviteesForGuest('g1', ['Kamala', 'Guest of Kamala']);
  second.rsvpStatus = 'accepted';
  rsvpResponses.length = 0;
  rsvpResponses.push({ guestId: 'g1', attending: true, participantNames: ['Kamala', 'Guest of Kamala'] });
});

test('renaming a person changes only that person', async () => {
  const result = await renameInviteeInParty('g1', second.id, '  Nimal   Silva ');

  assert.equal(result.success, true);
  const names = (await listInviteesForGuest('g1')).map((person) => person.name);
  assert.deepEqual(names, ['Kamala', 'Nimal Silva'], 'extra spaces are tidied, the other person is untouched');
  assert.equal(guestStore[0].name, 'Perera Family', 'the party name is not changed');
});

test("the mirrored RSVP names change too, so the export shows the new name", async () => {
  await renameInviteeInParty('g1', second.id, 'Nimal Silva');
  assert.deepEqual(rsvpResponses[0].participantNames, ['Kamala', 'Nimal Silva']);
  assert.equal(rsvpResponses[0].attending, true);
});

test('the person keeps their id, RSVP answer and place in the party', async () => {
  await renameInviteeInParty('g1', second.id, 'Nimal Silva');
  const after = (await listInviteesForGuest('g1'))[1];

  assert.equal(after.id, second.id);
  assert.equal(after.rsvpStatus, 'accepted');
  assert.equal(after.displayOrder, 1);
});

test('a blank or over-long name, or a person from another party, is refused', async () => {
  assert.deepEqual(await renameInviteeInParty('g1', first.id, '   '), { success: false, reason: 'invalid_name' });
  assert.deepEqual(await renameInviteeInParty('g1', first.id, 'x'.repeat(101)), { success: false, reason: 'invalid_name' });
  assert.deepEqual(await renameInviteeInParty('other', first.id, 'Someone'), { success: false, reason: 'invitee_not_found' });
  assert.equal((await listInviteesForGuest('g1'))[0].name, 'Kamala');
});
