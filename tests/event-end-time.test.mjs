import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { validateCelebrationEventInput } from '../src/celebration-events/validateCelebrationEvent.js';
import { formatEventTimeRange } from '../src/celebration-events/formatEventTime.js';
import { createEvent, updateEvent, listEvents } from '../src/celebration-events/celebrationEventsRepo.js';
import { celebrationEvents } from '../src/data/celebrationEventsStore.js';

const ORIGINAL_EVENTS = structuredClone(celebrationEvents);

beforeEach(() => {
  celebrationEvents.length = 0;
  celebrationEvents.push(...structuredClone(ORIGINAL_EVENTS));
});

const base = {
  name: 'Poruwa',
  eventDate: '2026-12-14',
  eventTime: '3:00 PM',
  venueName: 'Hall',
};

test('an event with no end time is still valid and its end time is empty', () => {
  const result = validateCelebrationEventInput(base);
  assert.equal(result.success, true);
  assert.equal(result.event.endTime, '');
});

test('an end time is trimmed and kept', () => {
  const result = validateCelebrationEventInput({ ...base, endTime: ' 6:00 PM ' });
  assert.equal(result.success, true);
  assert.equal(result.event.endTime, '6:00 PM');
});

test('an end time that is not a time is refused', () => {
  const result = validateCelebrationEventInput({ ...base, endTime: 'late' });
  assert.equal(result.success, false);
  assert.deepEqual(result.errors, [{ field: 'endTime', reason: 'invalid_time' }]);
});

test('an end time earlier than the start is allowed (a reception can run past midnight)', () => {
  const result = validateCelebrationEventInput({ ...base, eventTime: '9:00 PM', endTime: '12:30 AM' });
  assert.equal(result.success, true);
});

test('guests read a range when there is an end time, and just the start when there is not', () => {
  assert.equal(formatEventTimeRange('3:00 PM', '6:00 PM'), '3:00 PM – 6:00 PM');
  assert.equal(formatEventTimeRange('3:00 PM', ''), '3:00 PM');
  assert.equal(formatEventTimeRange('3:00 PM', undefined), '3:00 PM');
});

test('the existing events have no end time until one is set', async () => {
  const events = await listEvents();
  assert.ok(events.every((event) => !event.endTime));
});

test('an end time is saved on create and on update, and can be cleared', async () => {
  const created = await createEvent({ ...base, endTime: '5:00 PM' });
  assert.equal(created.event.endTime, '5:00 PM');

  const changed = await updateEvent(created.event.id, { endTime: '5:30 PM' });
  assert.equal(changed.event.endTime, '5:30 PM');
  assert.equal(changed.event.eventTime, '3:00 PM');

  const cleared = await updateEvent(created.event.id, { endTime: '' });
  assert.equal(cleared.event.endTime, '');
});

test('updating something else leaves the end time alone', async () => {
  const created = await createEvent({ ...base, endTime: '5:00 PM' });
  const renamed = await updateEvent(created.event.id, { name: 'Poruwa ceremony' });
  assert.equal(renamed.event.endTime, '5:00 PM');
});
