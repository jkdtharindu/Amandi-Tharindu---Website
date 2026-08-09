import test from 'node:test';
import assert from 'node:assert/strict';

import { loginGuestByName } from '../src/guest-auth/loginGuestByName.js';

const guestStore = [
  { id: 'guest-1', code: 'SILVA-001', name: 'Malinda Silva', isDeleted: false },
  { id: 'guest-2', code: 'SILVA-002', name: 'Silva Family', isDeleted: false },
  { id: 'guest-3', code: 'SILVA-003', name: 'Kumara Perera', isDeleted: true }
];

test('returns a guest session for an exact name match', async () => {
  const result = await loginGuestByName('Malinda Silva', guestStore);

  assert.equal(result.success, true);
  assert.equal(result.type, 'exact');
  assert.equal(result.guestId, 'guest-1');
  assert.equal(result.sessionId, 'guest-1');
});

test('returns a candidate list when name match is ambiguous', async () => {
  const result = await loginGuestByName('Silva', guestStore);

  assert.equal(result.success, false);
  assert.equal(result.type, 'candidates');
  assert.ok(Array.isArray(result.candidates));
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.candidates[0], { id: 'guest-1', name: 'Malinda Silva', code: 'SILVA-001' });
});

test('rejects soft-deleted guests when searching by name', async () => {
  const result = await loginGuestByName('Kumara Perera', guestStore);

  assert.equal(result.success, false);
  assert.equal(result.reason, 'guest_not_found');
});

test('returns not found for unknown names', async () => {
  const result = await loginGuestByName('Unknown Guest', guestStore);

  assert.equal(result.success, false);
  assert.equal(result.reason, 'guest_not_found');
});

test('rejects missing name input', async () => {
  const result = await loginGuestByName('', guestStore);

  assert.equal(result.success, false);
  assert.equal(result.reason, 'missing_name');
});
