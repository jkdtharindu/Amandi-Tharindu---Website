import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createGuest, incrementGuestSlotCount, syncGuestSlotCountToInvitees } from '../src/admin/adminRepo.js';
import { guestStore } from '../src/data/guestStore.js';
import { invitees } from '../src/data/inviteesStore.js';
import { listInviteesForGuest, deleteInvitee } from '../src/invitees/inviteesRepo.js';

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

test('syncGuestSlotCountToInvitees recomputes slotCount from remaining approved invitees, used after one is removed', async () => {
  const guest = await createGuest({
    name: 'Silva Family',
    relationship: 'Relations',
    slotCount: 3,
    inviteeNames: ['John Silva', 'Maria Silva', 'Sarah Silva'],
  });
  assert.equal(guest.slotCount, 3);

  const [john] = await listInviteesForGuest(guest.id);
  await deleteInvitee(john.id);

  const updated = await syncGuestSlotCountToInvitees(guest.id);
  assert.equal(updated.slotCount, 2, 'recomputed from the 2 invitees left, not decremented blindly');
});

test('syncGuestSlotCountToInvitees also self-heals a slotCount that had drifted from direct edits', async () => {
  const guest = await createGuest({
    name: 'Perera Family',
    relationship: 'Relations',
    slotCount: 2,
    inviteeNames: ['Anu Perera', 'Kumar Perera'],
  });

  // Simulates the edit form's own slotCount field being typed directly,
  // desyncing it from the actual invitee count (a pre-existing gap this
  // sync deliberately corrects rather than trusts).
  const stored = guestStore.find((entry) => entry.id === guest.id);
  stored.slotCount = 10;

  const updated = await syncGuestSlotCountToInvitees(guest.id);
  assert.equal(updated.slotCount, 2);
});
