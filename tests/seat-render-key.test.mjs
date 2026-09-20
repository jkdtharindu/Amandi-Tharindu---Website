import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { seatRenderKey } from '../src/table-arrangement/seatRenderKey.js';

// SeatCard keeps a seat's dietary and notes text in its own state, seeded once from
// props. With the seat id alone as the React key, that text outlived the person:
// remove someone, seat another person on the same seat, and the new person's box
// still showed the previous person's dietary note, with a Save button that would
// have stored it on them (Next Action 60).
//
// The fix is React's reset-state-with-a-key: put the occupant in the key so a new
// occupant gets a fresh card, and fresh state from the server. This repository has
// no DOM test environment (no jsdom or testing library), so these tests prove the
// key's contract and that the screen uses it. They do not render the screen; that
// check is a manual one, in MVP.md section 3b.

const seat = (overrides = {}) => ({
  id: 'seat-1',
  guestId: null,
  inviteeId: null,
  probableAttendeeId: null,
  ...overrides,
});

test('the key changes when the occupant changes, so the card and its typed text start fresh', () => {
  const keys = new Set([
    seatRenderKey(seat({ guestId: 'person-a' })),
    seatRenderKey(seat({ guestId: 'person-b' })),
    seatRenderKey(seat()),
    seatRenderKey(seat({ inviteeId: 'person-a' })),
    seatRenderKey(seat({ probableAttendeeId: 'person-a' })),
  ]);

  assert.equal(keys.size, 5, 'a different person, an empty seat, and a different kind of occupant each get their own key');
});

test('removing the occupant changes the key, and seating the next person changes it again', () => {
  const before = seatRenderKey(seat({ guestId: 'person-a' }));
  const removed = seatRenderKey(seat());
  const next = seatRenderKey(seat({ guestId: 'person-b' }));

  assert.notEqual(before, removed);
  assert.notEqual(removed, next);
  assert.notEqual(before, next);
});

test('the key does not change while the same person stays, so text being typed is kept', () => {
  const first = seatRenderKey(seat({ guestId: 'person-a', dietaryRequirements: null, specialNotes: null }));
  const later = seatRenderKey(seat({ guestId: 'person-a', dietaryRequirements: 'Vegan', specialNotes: 'High chair' }));

  assert.equal(first, later);
});

test('two different seats never share a key, even when both are empty', () => {
  assert.notEqual(seatRenderKey(seat({ id: 'seat-1' })), seatRenderKey(seat({ id: 'seat-2' })));
});

test('the Table Arrangement screen keys each SeatCard by occupant, not by seat id alone', () => {
  const source = readFileSync(new URL('../components/admin/TableArrangement.tsx', import.meta.url), 'utf8');

  assert.match(source, /<SeatCard\s+key=\{seatRenderKey\(seat\)\}/);
  assert.doesNotMatch(source, /<SeatCard\s+key=\{seat\.id\}/);
});
