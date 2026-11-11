import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveRsvpDetail, withRsvpDetail } from '../src/admin/rsvpDetail.js';
import { filterGuests } from '../src/admin/guestQueries.js';

const guest = { id: 'g1', rsvpStatus: 'pending' };
const person = (rsvpStatus, approvalStatus = 'approved') => ({ guestId: 'g1', rsvpStatus, approvalStatus });

test('nobody answered is pending', () => {
  assert.equal(deriveRsvpDetail(guest, [person('pending'), person('pending')]), 'pending');
});
test('everyone accepted is totally accepted', () => {
  assert.equal(deriveRsvpDetail(guest, [person('accepted'), person('accepted')]), 'accepted_all');
});
test('some accepted, rest pending or declined is accepted partially', () => {
  assert.equal(deriveRsvpDetail(guest, [person('accepted'), person('pending')]), 'accepted_partial');
  assert.equal(deriveRsvpDetail(guest, [person('accepted'), person('declined')]), 'accepted_partial');
});
test('some declined, none accepted, is declined partially', () => {
  assert.equal(deriveRsvpDetail(guest, [person('declined'), person('pending')]), 'declined_partial');
});
test('everyone declined is declined', () => {
  assert.equal(deriveRsvpDetail(guest, [person('declined'), person('declined')]), 'declined');
});
test('people waiting for approval are ignored', () => {
  assert.equal(deriveRsvpDetail(guest, [person('accepted'), person('pending', 'pending_approval')]), 'accepted_all');
});
test('a party with no people uses its stored status', () => {
  assert.equal(deriveRsvpDetail({ id: 'x', rsvpStatus: 'accepted' }, []), 'accepted_all');
  assert.equal(deriveRsvpDetail({ id: 'x', rsvpStatus: 'declined' }, []), 'declined');
  assert.equal(deriveRsvpDetail({ id: 'x', rsvpStatus: 'pending' }, []), 'pending');
});
test('the guest list status filter understands the new values', () => {
  const list = withRsvpDetail([guest], [person('accepted'), person('pending')]);
  assert.equal(filterGuests(list, { status: 'accepted_partial' }).length, 1);
  assert.equal(filterGuests(list, { status: 'accepted_all' }).length, 0);
  assert.equal(filterGuests(list, { status: 'pending' }).length, 0);
});
