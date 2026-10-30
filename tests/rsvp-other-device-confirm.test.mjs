import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { saveInviteeRsvp } from '../src/rsvp/saveRsvp.js';
import { answeredByLabel, clientIpFrom } from '../src/rsvp/answeredBy.js';
import { createInviteesForGuest, listInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { invitees } from '../src/data/inviteesStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';
import { guestStore } from '../src/data/guestStore.js';

// A saved answer given from one device is not silently changed from another:
// the change is held back until the person on the other device confirms it.

const statusOf = async (id) => (await listInviteesForGuest('guest-1')).find((entry) => entry.id === id).rsvpStatus;

const PHONE = 'label-phone';
const LAPTOP = 'label-laptop';

let ana, ben;

beforeEach(async () => {
  invitees.length = 0;
  rsvpResponses.length = 0;
  guestStore.find((entry) => entry.id === 'guest-1').rsvpStatus = 'pending';
  [ana, ben] = await createInviteesForGuest('guest-1', ['Ana', 'Ben']);
});

test('the same device can change its own answer without being asked', async () => {
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }], { answeredBy: PHONE });
  const again = await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: false }], { answeredBy: PHONE });
  assert.deepEqual(again.needsConfirm, []);
  assert.equal(await statusOf(ana.id), 'declined');
});

test('another device changing a saved answer is held back and the answer stays', async () => {
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }], { answeredBy: PHONE });
  const held = await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: false }], { answeredBy: LAPTOP });
  assert.deepEqual(held.needsConfirm, [ana.id]);
  assert.equal(await statusOf(ana.id), 'accepted');
});

test('once confirmed, the other device changes it and becomes the one on record', async () => {
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }], { answeredBy: PHONE });
  const done = await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: false, confirmed: true }], { answeredBy: LAPTOP });
  assert.deepEqual(done.needsConfirm, []);
  assert.equal(await statusOf(ana.id), 'declined');

  // The laptop now owns the answer, so the laptop is no longer asked.
  const next = await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }], { answeredBy: LAPTOP });
  assert.deepEqual(next.needsConfirm, []);
});

test('answering a person still pending is never held back, whoever answers', async () => {
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }], { answeredBy: PHONE });
  const result = await saveInviteeRsvp('guest-1', [{ id: ben.id, attending: true }], { answeredBy: LAPTOP });
  assert.deepEqual(result.needsConfirm, []);
  assert.equal(await statusOf(ben.id), 'accepted');
});

test('saving the same answer again from another device is not a change', async () => {
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }], { answeredBy: PHONE });
  const result = await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }], { answeredBy: LAPTOP });
  assert.deepEqual(result.needsConfirm, []);
});

test('one held-back person does not block the others in the same save', async () => {
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }], { answeredBy: PHONE });
  const result = await saveInviteeRsvp(
    'guest-1',
    [
      { id: ana.id, attending: false },
      { id: ben.id, attending: true },
    ],
    { answeredBy: LAPTOP }
  );
  assert.deepEqual(result.needsConfirm, [ana.id]);
  assert.equal(await statusOf(ana.id), 'accepted');
  assert.equal(await statusOf(ben.id), 'accepted');
});

test('no check when either side is unknown: old answers, or no usable address', async () => {
  // An answer saved with no device label (e.g. before this existed).
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }]);
  const fromLaptop = await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: false }], { answeredBy: LAPTOP });
  assert.deepEqual(fromLaptop.needsConfirm, []);

  // The saver's address cannot be read this time.
  const noAddress = await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }], { answeredBy: null });
  assert.deepEqual(noAddress.needsConfirm, []);
});

test('the device label is a one-way hash, stable per address, and absent without one', () => {
  const label = answeredByLabel('203.0.113.7');
  assert.match(label, /^[0-9a-f]{32}$/);
  assert.equal(label, answeredByLabel('203.0.113.7'));
  assert.notEqual(label, answeredByLabel('203.0.113.8'));
  assert.ok(!label.includes('203'));
  assert.equal(answeredByLabel(null), null);
  assert.equal(answeredByLabel('local'), null);
});

test('the client address is the first one in x-forwarded-for', () => {
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' });
  assert.equal(clientIpFrom(headers), '203.0.113.7');
  assert.equal(clientIpFrom(new Headers()), null);
});
