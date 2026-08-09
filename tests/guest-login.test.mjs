import test from 'node:test';
import assert from 'node:assert/strict';

import { loginGuestByCode } from '../src/guest-auth/loginGuestByCode.js';

test('returns a guest session for a valid invitation code', async () => {
  const guestStore = [
    {
      id: 'guest-1',
      code: 'SILVA-001',
      isDeleted: false,
    },
  ];

  const result = await loginGuestByCode('SILVA-001', guestStore);

  assert.equal(result.success, true);
  assert.equal(result.guestId, 'guest-1');
  assert.equal(result.sessionId, 'guest-1');
});

test('rejects soft-deleted guests when logging in by code', async () => {
  const guestStore = [
    {
      id: 'guest-2',
      code: 'SILVA-002',
      isDeleted: true,
    },
  ];

  const result = await loginGuestByCode('SILVA-002', guestStore);

  assert.equal(result.success, false);
  assert.equal(result.reason, 'guest_not_found');
});
