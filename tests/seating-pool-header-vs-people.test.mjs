import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { listUnassignedGuests, listUnassignedInvitees } from '../src/table-arrangement/tableArrangementRepo.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';

// Who Table Arrangement offers for a seat: a guest's own name (when the guest
// has no people), or the named people (when it has). In-memory path.

const guest = (id, name, slotCount, rsvpStatus = 'accepted') => ({
  id, code: id, name, relationship: 'Relations', slotCount, rsvpStatus, isDeleted: false,
});
const person = (id, guestId, name, approvalStatus = 'approved', rsvpStatus = 'accepted') => ({
  id, guestId, name, approvalStatus, rsvpStatus,
});

beforeEach(() => {
  guestStore.length = 0;
  invitees.length = 0;
});

async function pool() {
  const guests = (await listUnassignedGuests()).map((entry) => entry.name);
  const people = (await listUnassignedInvitees()).map((entry) => entry.name);
  return { guests, people };
}

test('a guest with no people list is offered once, under the guest name', async () => {
  guestStore.push(guest('g1', 'Kamal Perera', 1));
  assert.deepEqual(await pool(), { guests: ['Kamal Perera'], people: [] });
});

test('a guest with a people list is offered only through the people, never the header name', async () => {
  guestStore.push(guest('g1', 'Kamal Perera', 2));
  invitees.push(person('p1', 'g1', 'Nimali'), person('p2', 'g1', 'Sunil'));
  // Kamal is the header but is not in the list, so he gets no seat.
  assert.deepEqual(await pool(), { guests: [], people: ['Nimali', 'Sunil'] });
});

test('header name listed as a person is offered once, not twice', async () => {
  guestStore.push(guest('g1', 'Kamal Perera', 2));
  invitees.push(person('p1', 'g1', 'Kamal Perera'), person('p2', 'g1', 'Nimali'));
  assert.deepEqual(await pool(), { guests: [], people: ['Kamal Perera', 'Nimali'] });
});

test('an accepted guest whose only person is still awaiting approval is not lost', async () => {
  guestStore.push(guest('g1', 'Kamal Perera', 1));
  invitees.push(person('p1', 'g1', 'Nimali', 'pending'));
  const { guests, people } = await pool();
  assert.equal(guests.length + people.length > 0, true, 'someone must be seatable');
});

// Choosing Individual or Group before adding a guest.
import { validateGuestInput } from '../src/admin/guestValidation.js';

const create = (input) =>
  validateGuestInput({ name: 'Kamal Perera', relationship: 'Relations', ...input }, { requirePeople: true });

test('individual: the typed name is the one person and one seat', () => {
  const result = create({ partyType: 'individual', slotCount: 5, inviteeNames: ['Someone Else'] });
  assert.equal(result.valid, true);
  assert.deepEqual(result.value.inviteeNames, ['Kamal Perera']);
  assert.equal(result.value.slotCount, 1);
});

test('group: every person is listed, and the seat count is the number of names', () => {
  const result = create({ name: 'Perera Family', partyType: 'group', inviteeNames: ['Kamal', 'Nimali', 'Sunil'] });
  assert.equal(result.valid, true);
  assert.deepEqual(result.value.inviteeNames, ['Kamal', 'Nimali', 'Sunil']);
  assert.equal(result.value.slotCount, 3);
});

test('group: fewer than 2 names, or none, is refused', () => {
  assert.ok(create({ partyType: 'group', inviteeNames: ['Kamal'] }).errors.inviteeNames);
  assert.ok(create({ partyType: 'group', inviteeNames: [] }).errors.inviteeNames);
  assert.ok(create({ partyType: 'group' }).errors.inviteeNames);
});

test('an unknown party type is refused', () => {
  assert.ok(create({ partyType: 'couple', inviteeNames: ['A', 'B'] }).errors.partyType);
});

test('no party type keeps the old behaviour', () => {
  assert.equal(create({ slotCount: 1 }).valid, true);
  assert.ok(create({ slotCount: 3 }).errors.inviteeNames);
});
