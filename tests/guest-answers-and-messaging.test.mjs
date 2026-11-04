import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeAnswers, answerState } from '../src/admin/answerSummary.js';
import { computeMessagingStats } from '../src/messaging/messagingStats.js';
import {
  matchesSeating,
  matchesMessaging,
  MESSAGING_FILTERS,
} from '../src/admin/guestListFilters.js';
import { MESSAGE_LEVELS } from '../src/messaging/messageLevels.js';

const guest = (id, code, extra = {}) => ({
  id,
  code,
  name: `Guest ${code}`,
  relationship: 'Family',
  slotCount: 1,
  whatsappNumber: '+94770000000',
  rsvpStatus: 'pending',
  isDeleted: false,
  ...extra,
});
const person = (guestId, name, rsvpStatus) => ({ id: `${guestId}-${name}`, guestId, name, rsvpStatus, approvalStatus: 'approved' });

// One code per case: everyone accepted, mixed with one waiting, nobody answered, all declined.
const guests = [
  guest('g1', 'ALL-OK', { rsvpStatus: 'accepted' }),
  guest('g2', 'MIXED', { rsvpStatus: 'accepted' }),
  guest('g3', 'NOBODY', { whatsappNumber: null }),
  guest('g4', 'NO-ONE', { rsvpStatus: 'declined' }),
  guest('g5', 'PARTLY', { rsvpStatus: 'accepted' }),
];
const invitees = [
  person('g1', 'a', 'accepted'), person('g1', 'b', 'accepted'),
  person('g2', 'a', 'accepted'), person('g2', 'b', 'declined'), person('g2', 'c', 'pending'),
  person('g3', 'a', 'pending'), person('g3', 'b', 'pending'),
  person('g4', 'a', 'declined'),
  person('g5', 'a', 'accepted'), person('g5', 'b', 'pending'),
];

test('answerState tells apart complete, partly answered and nobody answered', () => {
  assert.deepEqual(answerState({ invited: 3, accepted: 3, declined: 0, pending: 0 }), { state: 'complete', mixed: false });
  assert.deepEqual(answerState({ invited: 3, accepted: 1, declined: 0, pending: 2 }), { state: 'partial', mixed: false });
  assert.deepEqual(answerState({ invited: 3, accepted: 0, declined: 0, pending: 3 }), { state: 'none', mixed: false });
  assert.deepEqual(answerState({ invited: 3, accepted: 1, declined: 1, pending: 1 }), { state: 'partial', mixed: true });
  assert.deepEqual(answerState({ invited: 2, accepted: 1, declined: 1, pending: 0 }), { state: 'complete', mixed: true });
});

test('each code gets its own person-by-person answers', () => {
  const { byGuestId } = summarizeAnswers(guests, [], invitees);
  assert.deepEqual(byGuestId.g2, { invited: 3, accepted: 1, declined: 1, pending: 1, state: 'partial', mixed: true });
  assert.equal(byGuestId.g1.state, 'complete');
  assert.equal(byGuestId.g3.state, 'none');
  assert.equal(byGuestId.g4.state, 'complete');
});

test('the totals and the waiting list count only codes with people still to reply', () => {
  const { totals, waiting } = summarizeAnswers(guests, [], invitees);
  assert.deepEqual(totals, { codes: 5, complete: 2, partial: 2, none: 1, mixed: 1 });
  assert.deepEqual(waiting.map((row) => row.code).sort(), ['MIXED', 'PARTLY']);
  assert.equal(waiting.find((row) => row.code === 'MIXED').pending, 1);
});

test('a removed guest is left out', () => {
  const { totals, byGuestId } = summarizeAnswers([...guests, guest('g9', 'GONE', { isDeleted: true })], [], invitees);
  assert.equal(totals.codes, 5);
  assert.equal(byGuestId.g9, undefined);
});

const ev = (...levelNumbers) =>
  levelNumbers.map((number) => ({ eventName: MESSAGE_LEVELS[number - 1].eventName, isCompleted: true }));

test('messaging stats: sent and to-send per step, no-number guests counted apart', () => {
  const { byGuestId } = summarizeAnswers(guests, [], invitees);
  const stats = computeMessagingStats(guests, byGuestId, {
    g1: ev(1, 2, 3, 4), // fully messaged
    g2: ev(1),
    g5: ev(1, 2),
  });
  const step = (n) => stats.levels[n - 1];

  // Step 1 is for everyone: g3 has no number, so 4 can be messaged and 3 have been.
  assert.deepEqual([step(1).sent, step(1).toSend, step(1).noNumber], [3, 1, 1]);
  assert.deepEqual([step(2).sent, step(2).toSend, step(2).noNumber], [2, 2, 1]);
  // Step 3 is for anyone still to answer: g2, g5 (partly) and g3 (nobody, no number). g1/g4 are done.
  assert.deepEqual([step(3).sent, step(3).toSend, step(3).noNumber], [0, 2, 1]);
  // Step 4 is for codes with an acceptance: g1, g2, g5.
  assert.deepEqual([step(4).sent, step(4).toSend, step(4).noNumber], [1, 2, 0]);

  assert.deepEqual(stats.totals, { codes: 5, withNumber: 4, noNumber: 1, fullyMessaged: 1 });
});

test('the list filter matches codes by seating', () => {
  assert.equal(matchesSeating('partial', { status: 'partial' }), true);
  assert.equal(matchesSeating('none', { status: 'complete' }), false);
  assert.equal(matchesSeating('skip', { status: 'skip' }), true);
  assert.equal(matchesSeating('all', undefined), true);
});

test('messaging filters: by progress, by step, and no-number guests only show under their own filter', () => {
  assert.equal(matchesMessaging('none', [], true), true);
  assert.equal(matchesMessaging('none', ev(1), true), false);
  assert.equal(matchesMessaging('partial', ev(1, 2), true), true);
  assert.equal(matchesMessaging('partial', ev(1, 2, 3, 4), true), false);
  assert.equal(matchesMessaging('done', ev(1, 2, 3, 4), true), true);

  assert.equal(matchesMessaging('rsvp_reminder:not', ev(1, 2), true), true);
  assert.equal(matchesMessaging('rsvp_reminder:sent', ev(3), true), true);
  assert.equal(matchesMessaging('main_invitation:sent', [], true), false);

  assert.equal(matchesMessaging('no-number', [], false), true);
  assert.equal(matchesMessaging('no-number', [], true), false);
  assert.equal(matchesMessaging('none', [], false), false, 'cannot message a guest with no number');
  assert.equal(matchesMessaging('all', [], false), true);
});

test('there is a sent and a not-sent filter for every message step', () => {
  for (const level of MESSAGE_LEVELS) {
    assert.ok(MESSAGING_FILTERS.some((option) => option.value === `${level.key}:sent`));
    assert.ok(MESSAGING_FILTERS.some((option) => option.value === `${level.key}:not`));
  }
});
