import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { extractSurname, generateInvitationCode } from '../src/guest-auth/generateInvitationCode.js';
import { validateGuestInput, VALID_RELATIONSHIP_TYPES } from '../src/guest-auth/validateGuestInput.js';
import { guestStore } from '../src/data/guestStore.js';
import {
  listGuestsForAdmin,
  createGuest,
  updateGuest,
  softDeleteGuest,
} from '../src/guest-auth/guestRepo.js';

const ORIGINAL_GUESTS = structuredClone(guestStore);

beforeEach(() => {
  guestStore.length = 0;
  guestStore.push(...structuredClone(ORIGINAL_GUESTS));
});

test('extractSurname takes the first name token by default', () => {
  // Default flipped to 'first' 2026-08-29: Sinhalese names commonly place the
  // ancestral/ge name first. Both positions are covered in
  // tests/invitation-code-format.test.mjs.
  assert.equal(extractSurname('Nimal Silva'), 'NIMAL');
  assert.equal(extractSurname('  Kumara Perera  '), 'KUMARA');
  assert.equal(extractSurname('Nimal Silva', 'last'), 'SILVA');
});

test('generateInvitationCode assigns the next three-digit suffix for a surname', () => {
  // Explicit surnamePosition so this test covers the numbering rule only, and
  // does not silently change meaning if the default is ever flipped again.
  const last = { surnamePosition: 'last' };
  assert.equal(generateInvitationCode('Nimal Silva', ['SILVA-001'], last), 'SILVA-002');
  assert.equal(generateInvitationCode('New Silva', [], last), 'SILVA-001');
  assert.equal(generateInvitationCode('Ana Perera', ['SILVA-001', 'PERERA-003'], last), 'PERERA-004');
});

test('validateGuestInput requires name, relationship, and slotCount', () => {
  const missing = validateGuestInput({});
  assert.equal(missing.success, false);
  assert.ok(missing.errors.some((e) => e.field === 'name'));

  const invalidRelationship = validateGuestInput({ name: 'Test Guest', relationship: 'Family', slotCount: 2 });
  assert.equal(invalidRelationship.success, false);

  const valid = validateGuestInput({ name: 'Test Guest', relationship: 'Relations', slotCount: 2 });
  assert.equal(valid.success, true);
  assert.equal(valid.guest.name, 'Test Guest');
  assert.equal(valid.guest.relationship, 'Relations');
  assert.equal(valid.guest.slotCount, 2);
});

test('VALID_RELATIONSHIP_TYPES matches ubiquitous language', () => {
  assert.deepEqual(VALID_RELATIONSHIP_TYPES, ['Relations', 'Colleagues', 'Neighbours', 'Friends']);
});

test('createGuest auto-generates a unique invitation code', async () => {
  const result = await createGuest({ name: 'Sunil Silva', relationship: 'Friends', slotCount: 3 });
  assert.equal(result.success, true);
  assert.match(result.guest.code, /^SUNIL-\d{3}$/, 'first name token by default');
  assert.equal(result.guest.rsvpStatus, 'pending');
  assert.equal(result.guest.isDeleted, false);
});

test('updateGuest changes editable fields', async () => {
  const created = await createGuest({ name: 'A B Perera', relationship: 'Colleagues', slotCount: 1 });
  const updated = await updateGuest(created.guest.id, {
    name: 'Amal Perera',
    relationship: 'Neighbours',
    slotCount: 4,
  });
  assert.equal(updated.success, true);
  assert.equal(updated.guest.name, 'Amal Perera');
  assert.equal(updated.guest.relationship, 'Neighbours');
  assert.equal(updated.guest.slotCount, 4);
});

test('softDeleteGuest hides guest from guest-facing lookups but keeps the record', async () => {
  const created = await createGuest({ name: 'Delete Me', relationship: 'Friends', slotCount: 1 });
  const deleted = await softDeleteGuest(created.guest.id);
  assert.equal(deleted.success, true);
  assert.equal(deleted.guest.isDeleted, true);

  const listed = await listGuestsForAdmin({});
  assert.ok(listed.some((g) => g.id === created.guest.id && g.isDeleted));
});

test('listGuestsForAdmin filters by RSVP status, relationship, and search', async () => {
  await createGuest({ name: 'Filter Silva', relationship: 'Relations', slotCount: 2 });
  await createGuest({ name: 'Other Perera', relationship: 'Friends', slotCount: 1 });

  const byRelationship = await listGuestsForAdmin({ relationship: 'Friends' });
  assert.ok(byRelationship.every((g) => g.relationship === 'Friends'));

  const bySearch = await listGuestsForAdmin({ search: 'silva' });
  assert.ok(bySearch.some((g) => g.name.toLowerCase().includes('silva')));

  const byStatus = await listGuestsForAdmin({ rsvpStatus: 'pending' });
  assert.ok(byStatus.every((g) => g.rsvpStatus === 'pending'));
});
