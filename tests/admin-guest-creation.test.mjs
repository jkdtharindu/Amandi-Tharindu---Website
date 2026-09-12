import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createGuest, incrementGuestSlotCount } from '../src/admin/adminRepo.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';
import { listInviteesForGuest } from '../src/invitees/inviteesRepo.js';

const ORIGINAL_GUESTS = structuredClone(guestStore);

beforeEach(() => {
  guestStore.length = 0;
  guestStore.push(...structuredClone(ORIGINAL_GUESTS));
  invitees.length = 0;
});

test('createGuest without inviteeNames behaves exactly as before (legacy, headcount-only)', async () => {
  const guest = await createGuest({ name: 'Sunil Bandara', relationship: 'Friends', slotCount: 4 });
  assert.equal(guest.slotCount, 4);

  const list = await listInviteesForGuest(guest.id);
  assert.equal(list.length, 0, 'no invitee rows for a legacy headcount-only invitation');
});

test('createGuest with inviteeNames creates one approved invitee per name', async () => {
  const guest = await createGuest({
    name: 'Silva Family',
    relationship: 'Relations',
    slotCount: 1, // ignored -- inviteeNames wins upstream in validateGuestInput
    inviteeNames: ['John Silva', 'Maria Silva', 'Sarah Silva'],
  });

  const list = await listInviteesForGuest(guest.id);
  assert.equal(list.length, 3);
  assert.ok(list.every((invitee) => invitee.approvalStatus === 'approved' && invitee.addedBy === 'admin'));
  assert.deepEqual(list.map((i) => i.name), ['John Silva', 'Maria Silva', 'Sarah Silva']);
});

test('incrementGuestSlotCount bumps slotCount by one, used when a guest-requested addition is approved', async () => {
  const guest = await createGuest({ name: 'Perera Family', relationship: 'Relations', slotCount: 2 });
  const updated = await incrementGuestSlotCount(guest.id);
  assert.equal(updated.slotCount, 3);
});
