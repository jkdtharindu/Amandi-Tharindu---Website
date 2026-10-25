import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { saveInviteeRsvp } from '../src/rsvp/saveRsvp.js';
import { createInviteesForGuest, listInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { findRsvpResponseByGuestId } from '../src/guest-auth/guestRepo.js';
import { invitees } from '../src/data/inviteesStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';
import { guestStore } from '../src/data/guestStore.js';
import {
  buildResponses,
  countAnswered,
  draftsFor,
  mergeFreshInvitees,
} from '../src/rsvp/partyDrafts.js';

// A party of four shares one link. Each person answers on their own, at a
// different time. These tests walk that story end to end against the in-memory
// stores (no DATABASE_URL): submit two, confirm the other two stay pending,
// then submit the other two and confirm the first two are untouched.

const guest = () => guestStore.find((entry) => entry.id === 'guest-1');
const statusOf = async (id) => (await listInviteesForGuest('guest-1')).find((entry) => entry.id === id).rsvpStatus;

let ana, ben, cara, dev;

beforeEach(async () => {
  invitees.length = 0;
  rsvpResponses.length = 0;
  guest().rsvpStatus = 'pending';
  [ana, ben, cara, dev] = await createInviteesForGuest('guest-1', ['Ana', 'Ben', 'Cara', 'Dev']);
});

test('everyone starts pending, with nothing pre-selected', async () => {
  const people = await listInviteesForGuest('guest-1');
  assert.deepEqual(people.map((p) => p.rsvpStatus), ['pending', 'pending', 'pending', 'pending']);
  assert.ok(Object.values(draftsFor(people)).every((draft) => draft.choice === null));
  assert.deepEqual(buildResponses(people, draftsFor(people)), []);
});

test('two guests submit; the other two stay pending, and a later submit does not overwrite the first two', async () => {
  const first = await saveInviteeRsvp('guest-1', [
    { id: ana.id, attending: true, expectedStatus: 'pending' },
    { id: ben.id, attending: false, expectedStatus: 'pending' },
  ]);
  assert.deepEqual(first.conflicts, []);
  assert.equal(await statusOf(ana.id), 'accepted');
  assert.equal(await statusOf(ben.id), 'declined');
  assert.equal(await statusOf(cara.id), 'pending');
  assert.equal(await statusOf(dev.id), 'pending');
  assert.equal(guest().rsvpStatus, 'accepted');

  // Reload: the other two phones only know Cara and Dev, and send only them.
  const second = await saveInviteeRsvp('guest-1', [
    { id: cara.id, attending: true, expectedStatus: 'pending' },
    { id: dev.id, attending: false, expectedStatus: 'pending' },
  ]);
  assert.deepEqual(second.conflicts, []);
  assert.equal(await statusOf(ana.id), 'accepted');
  assert.equal(await statusOf(ben.id), 'declined');
  assert.equal(await statusOf(cara.id), 'accepted');
  assert.equal(await statusOf(dev.id), 'declined');
  assert.deepEqual((await findRsvpResponseByGuestId('guest-1')).participantNames, ['Ana', 'Cara']);
});

test('one decline with the rest pending leaves the party pending, not declined', async () => {
  const result = await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: false, expectedStatus: 'pending' }]);

  assert.equal(result.status, 'pending');
  assert.equal(guest().rsvpStatus, 'pending');
  assert.equal(await findRsvpResponseByGuestId('guest-1'), null, 'no mirrored row, so the dashboard sees "pending"');
});

test('a party that went accepted then flips back to undecided loses its stale mirrored row', async () => {
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }]);
  assert.ok(await findRsvpResponseByGuestId('guest-1'));

  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: false, expectedStatus: 'accepted' }]);
  assert.equal(guest().rsvpStatus, 'pending');
  assert.equal(await findRsvpResponseByGuestId('guest-1'), null);
});

test('a guest can edit a confirmed answer', async () => {
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true, expectedStatus: 'pending' }]);
  const result = await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: false, expectedStatus: 'accepted' }]);

  assert.deepEqual(result.conflicts, []);
  assert.equal(await statusOf(ana.id), 'declined');
});

test('if someone else already saved a different answer, it is kept and reported, and the rest still saves', async () => {
  // Phone A saved Ana as attending. Phone B still thinks Ana is pending and
  // tries to decline her, while also answering Ben.
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true, expectedStatus: 'pending' }]);

  const result = await saveInviteeRsvp('guest-1', [
    { id: ana.id, attending: false, expectedStatus: 'pending' },
    { id: ben.id, attending: true, expectedStatus: 'pending' },
  ]);

  assert.deepEqual(result.conflicts, [ana.id]);
  assert.equal(await statusOf(ana.id), 'accepted', 'the earlier answer is not overwritten');
  assert.equal(await statusOf(ben.id), 'accepted', 'the non-conflicting answer still saved');
});

test('two phones saving the same answer is not a conflict', async () => {
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true, expectedStatus: 'pending' }]);
  const result = await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true, expectedStatus: 'pending' }]);

  assert.deepEqual(result.conflicts, []);
});

// --- the page's draft bookkeeping -------------------------------------------------

test('only guests whose answer changed are sent', async () => {
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }]);
  const people = await listInviteesForGuest('guest-1');
  const drafts = draftsFor(people);

  assert.deepEqual(buildResponses(people, drafts), [], 'opening the page changes nothing');

  drafts[ben.id].choice = 'declined';
  const entries = buildResponses(people, drafts);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], { id: ben.id, attending: false, expectedStatus: 'pending' });
  assert.equal(countAnswered(people, drafts), 2);
});

test('a refresh keeps what the user is typing and takes the server answer for everyone else', async () => {
  const before = await listInviteesForGuest('guest-1');
  const drafts = draftsFor(before);
  drafts[ben.id].choice = 'declined'; // user is mid-edit on Ben

  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }]); // someone else answers Ana
  const after = await listInviteesForGuest('guest-1');

  const merged = mergeFreshInvitees(before, drafts, after);
  assert.equal(merged.changed, true);
  assert.equal(merged.drafts[ana.id].choice, 'accepted');
  assert.equal(merged.drafts[ben.id].choice, 'declined');
});

test('a refused change is replaced by the answer that won', async () => {
  const before = await listInviteesForGuest('guest-1');
  const drafts = draftsFor(before);
  drafts[ana.id].choice = 'declined';

  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }]);
  const after = await listInviteesForGuest('guest-1');

  const merged = mergeFreshInvitees(before, drafts, after, { resetIds: [ana.id] });
  assert.equal(merged.drafts[ana.id].choice, 'accepted');
});
