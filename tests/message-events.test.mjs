import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { setMessageEventCompletion, getMessageEventsForGuest } from '../src/messaging/messageEventsRepo.js';
import { messageEvents } from '../src/data/messageEventsStore.js';

// Action 73: the per-guest "tick as sent" state, rewritten because the
// original recordMessageEvent's ON CONFLICT DO NOTHING had no unique
// constraint to target (migration 021 never added one), so every call
// inserted a new row instead of updating the existing one, and the
// in-memory path stored nothing at all. Runs the in-memory path.

beforeEach(() => {
  messageEvents.length = 0;
});

test('ticking a message the first time creates one row, completed', async () => {
  const event = await setMessageEventCompletion('g1', 'RSVP Reminder', 'bride', true);

  assert.equal(event.guestId, 'g1');
  assert.equal(event.eventName, 'RSVP Reminder');
  assert.equal(event.isCompleted, true);
  assert.ok(event.sentAt);
  assert.equal(messageEvents.length, 1);
});

test('ticking the same guest and event again updates the one row, not a second one', async () => {
  await setMessageEventCompletion('g1', 'RSVP Reminder', 'bride', true);
  await setMessageEventCompletion('g1', 'RSVP Reminder', 'bride', true);
  await setMessageEventCompletion('g1', 'RSVP Reminder', 'bride', true);

  assert.equal(messageEvents.length, 1, 'three ticks of the same kind is one row, not three');
});

test('un-ticking sets isCompleted false without deleting the row', async () => {
  await setMessageEventCompletion('g1', 'Thank You', 'bride', true);
  const event = await setMessageEventCompletion('g1', 'Thank You', 'bride', false);

  assert.equal(event.isCompleted, false);
  assert.equal(messageEvents.length, 1);
});

test('un-ticking keeps the last time it was sent, rather than clearing it', async () => {
  const sent = await setMessageEventCompletion('g1', 'Thank You', 'bride', true);
  const unticked = await setMessageEventCompletion('g1', 'Thank You', 'bride', false);

  assert.equal(unticked.sentAt, sent.sentAt);
});

test('different event kinds for the same guest are separate rows', async () => {
  await setMessageEventCompletion('g1', 'RSVP Reminder', 'bride', true);
  await setMessageEventCompletion('g1', 'Thank You', 'bride', true);

  const events = await getMessageEventsForGuest('g1');
  assert.deepEqual(events.map((e) => e.eventName).sort(), ['RSVP Reminder', 'Thank You']);
});

test('the same event kind for different guests are separate rows', async () => {
  await setMessageEventCompletion('g1', 'RSVP Reminder', 'bride', true);
  await setMessageEventCompletion('g2', 'RSVP Reminder', 'groom', true);

  assert.equal((await getMessageEventsForGuest('g1')).length, 1);
  assert.equal((await getMessageEventsForGuest('g2')).length, 1);
});

test('getMessageEventsForGuest returns nothing for a guest with no ticks', async () => {
  await setMessageEventCompletion('g1', 'RSVP Reminder', 'bride', true);
  assert.deepEqual(await getMessageEventsForGuest('g2'), []);
});
