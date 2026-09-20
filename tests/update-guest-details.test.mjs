import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { updateGuestDetails } from '../src/admin/updateGuestDetails.js';
import { createInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';

// Commit 9632cc7 made PATCH /api/admin/guests/[id] sync the headcount and return
// success *before* it saved anything else, so for a party with named people an
// edit to the name, relationship or WhatsApp number was silently dropped while
// the admin was told it saved (Next Action 62a). These run against the
// in-memory stores, which is where the end state is proved; there is no
// Postgres in the test environment.

const SEEDED_GUESTS = [
  {
    id: 'g1',
    code: 'A-001',
    name: 'Nimal Silva',
    relationship: 'Family',
    slotCount: 3,
    whatsappNumber: '+94123456789',
    email: 'nimal@example.com',
    rsvpStatus: 'pending',
    isDeleted: false,
    hasVisited: false,
  },
  {
    id: 'g2',
    code: 'A-002',
    name: 'Kumara Perera',
    relationship: 'Friend',
    slotCount: 4,
    whatsappNumber: null,
    email: 'kumara@example.com',
    rsvpStatus: 'pending',
    isDeleted: false,
    hasVisited: false,
  },
];

beforeEach(() => {
  guestStore.length = 0;
  guestStore.push(...SEEDED_GUESTS.map((guest) => ({ ...guest })));
  invitees.length = 0;
});

const edit = (overrides = {}) => ({
  name: 'Nimal Silva',
  relationship: 'Family',
  slotCount: 3,
  whatsappNumber: '+94123456789',
  ...overrides,
});

test('an edit to a party with named people saves the other fields, not just the headcount', async () => {
  await createInviteesForGuest('g1', ['Nimal', 'Kamala']);

  const saved = await updateGuestDetails(
    'g1',
    edit({ name: 'Nimal Silva Jr', relationship: 'Friend', whatsappNumber: '+94777777777' })
  );

  assert.equal(saved.name, 'Nimal Silva Jr');
  assert.equal(saved.relationship, 'Friend');
  assert.equal(saved.whatsappNumber, '+94777777777');

  const stored = guestStore.find((guest) => guest.id === 'g1');
  assert.equal(stored.name, 'Nimal Silva Jr');
  assert.equal(stored.relationship, 'Friend');
  assert.equal(stored.whatsappNumber, '+94777777777');
});

test('the headcount still comes from the named people, not the submitted number', async () => {
  await createInviteesForGuest('g1', ['Nimal', 'Kamala']);

  const saved = await updateGuestDetails('g1', edit({ name: 'Renamed', slotCount: 99 }));

  assert.equal(saved.slotCount, 2);
  assert.equal(saved.name, 'Renamed');
});

test('people still awaiting approval do not count toward the headcount', async () => {
  await createInviteesForGuest('g1', ['Nimal', 'Kamala']);
  await createInviteesForGuest('g1', ['Uninvited Cousin'], {
    addedBy: 'guest',
    approvalStatus: 'pending_approval',
  });

  const saved = await updateGuestDetails('g1', edit({ slotCount: 3 }));

  assert.equal(saved.slotCount, 2);
});

test('a party with no named people keeps the submitted headcount', async () => {
  const saved = await updateGuestDetails(
    'g2',
    edit({ name: 'Kumara Perera', relationship: 'Friend', slotCount: 5, whatsappNumber: null })
  );

  assert.equal(saved.slotCount, 5);
  assert.equal(saved.name, 'Kumara Perera');
});

test('a party whose people were all removed falls back to the submitted headcount rather than zeroing', async () => {
  const [only] = await createInviteesForGuest('g1', ['Nimal']);
  invitees.splice(invitees.indexOf(only), 1);

  const saved = await updateGuestDetails('g1', edit({ slotCount: 1 }));

  assert.equal(saved.slotCount, 1);
});

test('editing a guest that does not exist reports nothing saved', async () => {
  assert.equal(await updateGuestDetails('no-such-guest', edit()), null);
});
