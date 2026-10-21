import test from 'node:test';
import assert from 'node:assert/strict';

import { MESSAGE_LEVELS, levelProgress } from '../src/messaging/messageLevels.js';

test('there are three levels, in the order a guest receives them', () => {
  assert.deepEqual(
    MESSAGE_LEVELS.map((level) => level.eventName),
    ['Main Invitation', 'RSVP Reminder', 'Table Details'],
  );
});

test('a guest with no ticks is at 0%', () => {
  const progress = levelProgress([]);
  assert.equal(progress.doneCount, 0);
  assert.equal(progress.percent, 0);
});

test('only completed ticks count, and old event names are ignored', () => {
  const progress = levelProgress([
    { eventName: 'Main Invitation', isCompleted: true },
    { eventName: 'RSVP Reminder', isCompleted: false },
    { eventName: 'Thank You', isCompleted: true },
  ]);

  assert.equal(progress.doneCount, 1);
  assert.equal(progress.percent, 33);
  assert.deepEqual(progress.levels.map((level) => level.done), [true, false, false]);
});

test('all three ticked is 100%', () => {
  const progress = levelProgress(MESSAGE_LEVELS.map((level) => ({ eventName: level.eventName, isCompleted: true })));
  assert.equal(progress.percent, 100);
});
