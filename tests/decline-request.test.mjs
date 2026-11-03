import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { saveInviteeRsvp, applyDeclineAfterUnseat } from '../src/rsvp/saveRsvp.js';
import { createInviteesForGuest, setDeclineRequested, getInviteeById } from '../src/invitees/inviteesRepo.js';
import { invitees } from '../src/data/inviteesStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';
import { guestStore } from '../src/data/guestStore.js';
import { seatingTables } from '../src/data/tableArrangementStore.js';
import { isInviteeSeated, unassignGuestFromSeat } from '../src/table-arrangement/tableArrangementRepo.js';

// A confirmed person who already has a seat cannot be declined by their guest. The guest
// asks the couple; when the admin frees the seat, the answer becomes "declined" by itself.

const GUEST_ID = 'guest-1';

async function partyWithSeatedPerson() {
  const [seated, other] = await createInviteesForGuest(GUEST_ID, ['Nimal', 'Kamala']);
  await saveInviteeRsvp(GUEST_ID, [
    { id: seated.id, attending: true },
    { id: other.id, attending: true },
  ]);
  seatingTables.push({
    id: 'table-1',
    table_number: 1,
    table_name: 'Rose',
    capacity: 4,
    assignedToParty: 'bride',
    seats: [
      { id: 'seat-1', seatNumber: 1, guestId: null, inviteeId: seated.id, probableAttendeeId: null },
      { id: 'seat-2', seatNumber: 2, guestId: null, inviteeId: null, probableAttendeeId: null },
    ],
  });
  return { seated, other };
}

beforeEach(() => {
  invitees.length = 0;
  rsvpResponses.length = 0;
  seatingTables.length = 0;
  guestStore.find((guest) => guest.id === GUEST_ID).rsvpStatus = 'pending';
});

test('a seated, accepted person cannot be declined from the RSVP page', async () => {
  const { seated } = await partyWithSeatedPerson();

  const result = await saveInviteeRsvp(GUEST_ID, [{ id: seated.id, attending: false }]);

  assert.deepEqual(result.seatLocked, [seated.id]);
  assert.equal((await getInviteeById(seated.id)).rsvpStatus, 'accepted');
});

test('an accepted person with no seat can still be declined', async () => {
  const { other } = await partyWithSeatedPerson();

  const result = await saveInviteeRsvp(GUEST_ID, [{ id: other.id, attending: false }]);

  assert.deepEqual(result.seatLocked, []);
  assert.equal((await getInviteeById(other.id)).rsvpStatus, 'declined');
});

test('freeing the seat of a person who asked to decline declines them', async () => {
  const { seated, other } = await partyWithSeatedPerson();
  await setDeclineRequested(seated.id, true);

  await unassignGuestFromSeat('seat-1');
  const outcome = await applyDeclineAfterUnseat(seated.id);

  assert.equal(outcome.declined, true);
  const after = await getInviteeById(seated.id);
  assert.equal(after.rsvpStatus, 'declined');
  assert.equal(after.declineRequested, false);
  assert.equal((await getInviteeById(other.id)).rsvpStatus, 'accepted', 'the rest of the party is untouched');
  assert.equal(guestStore.find((guest) => guest.id === GUEST_ID).rsvpStatus, 'accepted', 'the party still has an accepted person');
});

test('declining the last accepted person declines the whole party', async () => {
  const { seated, other } = await partyWithSeatedPerson();
  await saveInviteeRsvp(GUEST_ID, [{ id: other.id, attending: false }]);
  await setDeclineRequested(seated.id, true);

  await unassignGuestFromSeat('seat-1');
  await applyDeclineAfterUnseat(seated.id);

  assert.equal(guestStore.find((guest) => guest.id === GUEST_ID).rsvpStatus, 'declined');
});

test('freeing the seat of someone who did not ask changes nothing', async () => {
  const { seated } = await partyWithSeatedPerson();

  await unassignGuestFromSeat('seat-1');
  const outcome = await applyDeclineAfterUnseat(seated.id);

  assert.equal(outcome.declined, false);
  assert.equal((await getInviteeById(seated.id)).rsvpStatus, 'accepted');
});

test('isInviteeSeated tells a seated person from an unseated one', async () => {
  const { seated, other } = await partyWithSeatedPerson();

  assert.equal(await isInviteeSeated(seated.id), true);
  assert.equal(await isInviteeSeated(other.id), false);
});
