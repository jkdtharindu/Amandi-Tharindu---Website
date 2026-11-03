import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { saveInviteeRsvp, saveWholePartyRsvp } from '../src/rsvp/saveRsvp.js';
import { listRsvpActivity, recordRsvpActivity, rsvpActivity } from '../src/rsvp/rsvpActivityRepo.js';
import { createInviteesForGuest } from '../src/invitees/inviteesRepo.js';
import { invitees } from '../src/data/inviteesStore.js';
import { rsvpResponses } from '../src/data/rsvpStore.js';
import { guestStore } from '../src/data/guestStore.js';

// The dashboard's "Recent RSVP answers" history, against the in-memory stores.

const guest = () => guestStore.find((entry) => entry.id === 'guest-1');
let ana, ben;

beforeEach(async () => {
  invitees.length = 0;
  rsvpResponses.length = 0;
  rsvpActivity.length = 0;
  guest().rsvpStatus = 'pending';
  [ana, ben] = await createInviteesForGuest('guest-1', ['Ana', 'Ben']);
});

test('each saved answer adds one line naming the person', async () => {
  await saveInviteeRsvp('guest-1', [
    { id: ana.id, attending: true },
    { id: ben.id, attending: false },
  ]);

  const lines = await listRsvpActivity(guest().assignedToParty ?? 'bride');
  assert.deepEqual(
    lines.map((line) => [line.personName, line.status]).sort(),
    [['Ana', 'accepted'], ['Ben', 'declined']]
  );
  assert.equal(lines[0].guestName, guest().name);
});

test('saving the same answer again adds nothing; changing it adds a line', async () => {
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }]);
  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: true }]);
  assert.equal(rsvpActivity.length, 1);

  await saveInviteeRsvp('guest-1', [{ id: ana.id, attending: false }]);
  assert.equal(rsvpActivity.length, 2);
  assert.equal(rsvpActivity[1].status, 'declined');
});

test('a whole-party answer is recorded under the guest name', async () => {
  await saveWholePartyRsvp('guest-1', { attending: false });
  assert.equal(rsvpActivity.length, 1);
  assert.equal(rsvpActivity[0].personName, guest().name);
});

test('the list is newest first and only shows one side', async () => {
  const party = guest().assignedToParty ?? 'bride';
  rsvpActivity.push(
    { id: 'a', guestId: 'guest-1', personName: 'Old', guestName: 'X', party, status: 'accepted', createdAt: '2026-11-01T10:00:00.000Z' },
    { id: 'b', guestId: 'guest-1', personName: 'New', guestName: 'X', party, status: 'declined', createdAt: '2026-11-02T10:00:00.000Z' },
    { id: 'c', guestId: 'guest-2', personName: 'Other side', guestName: 'Y', party: party === 'bride' ? 'groom' : 'bride', status: 'accepted', createdAt: '2026-11-03T10:00:00.000Z' }
  );
  const lines = await listRsvpActivity(party);
  assert.deepEqual(lines.map((line) => line.personName), ['New', 'Old']);
});

test('recording an unknown status or guest never throws', async () => {
  await recordRsvpActivity('guest-1', [{ personName: 'Ana', status: 'pending' }]);
  await recordRsvpActivity('no-such-guest', [{ personName: 'Ana', status: 'accepted' }]);
  assert.equal(rsvpActivity.length, 0);
});
