import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { validateCelebrationEventInput } from '../src/celebration-events/validateCelebrationEvent.js';
import { listEvents, createEvent, updateEvent, deleteEvent } from '../src/celebration-events/celebrationEventsRepo.js';
import { celebrationEvents } from '../src/data/celebrationEventsStore.js';

const ORIGINAL_EVENTS = structuredClone(celebrationEvents);

beforeEach(() => {
  celebrationEvents.length = 0;
  celebrationEvents.push(...structuredClone(ORIGINAL_EVENTS));
});

test('validateCelebrationEventInput rejects a missing name', () => {
  const result = validateCelebrationEventInput({ eventDate: '2026-12-14', eventTime: '3:00 PM', venueName: 'Hall' });
  assert.equal(result.success, false);
  assert.equal(result.errors[0].field, 'name');
});

test('validateCelebrationEventInput rejects a malformed date', () => {
  const result = validateCelebrationEventInput({ name: 'Ceremony', eventDate: 'not-a-date', eventTime: '3:00 PM', venueName: 'Hall' });
  assert.equal(result.success, false);
  assert.equal(result.errors[0].field, 'eventDate');
});

test('validateCelebrationEventInput rejects a missing venue name', () => {
  const result = validateCelebrationEventInput({ name: 'Ceremony', eventDate: '2026-12-14', eventTime: '3:00 PM' });
  assert.equal(result.success, false);
  assert.equal(result.errors[0].field, 'venueName');
});

test('validateCelebrationEventInput accepts valid input, trims strings, and defaults displayOrder', () => {
  const result = validateCelebrationEventInput({
    name: ' Ceremony ',
    eventDate: '2026-12-14',
    eventTime: ' 3:00 PM ',
    venueName: ' Sunrise Garden Hall ',
  });
  assert.equal(result.success, true);
  assert.equal(result.event.name, 'Ceremony');
  assert.equal(result.event.eventTime, '3:00 PM');
  assert.equal(result.event.venueName, 'Sunrise Garden Hall');
  assert.equal(result.event.venueAddress, '');
  assert.equal(result.event.displayOrder, 0);
});

test('listEvents returns events ordered by displayOrder', async () => {
  const events = await listEvents();
  assert.equal(events.length, 2);
  assert.equal(events[0].name, 'Ceremony');
  assert.equal(events[1].name, 'Reception');
});

test('createEvent then listEvents returns the created event in order', async () => {
  const created = await createEvent({
    name: 'Afterparty',
    eventDate: '2026-12-14',
    eventTime: '9:00 PM',
    venueName: 'Rooftop Lounge',
    displayOrder: 2,
  });
  assert.equal(created.success, true);

  const events = await listEvents();
  assert.equal(events.length, 3);
  assert.equal(events[2].name, 'Afterparty');
});

test('createEvent rejects invalid input without touching the store', async () => {
  const result = await createEvent({ name: '', eventDate: '2026-12-14', eventTime: '3:00 PM', venueName: 'Hall' });
  assert.equal(result.success, false);

  const events = await listEvents();
  assert.equal(events.length, 2);
});

test('updateEvent changes the venue and time', async () => {
  const events = await listEvents();
  const ceremony = events.find((e) => e.name === 'Ceremony');

  const updated = await updateEvent(ceremony.id, { venueName: 'New Hall', eventTime: '4:00 PM' });

  assert.equal(updated.success, true);
  assert.equal(updated.event.venueName, 'New Hall');
  assert.equal(updated.event.eventTime, '4:00 PM');
});

test('updateEvent returns event_not_found for an unknown id', async () => {
  const result = await updateEvent('missing-id', { name: 'x' });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'event_not_found');
});

test('createEvent stores and returns an imageUrl', async () => {
  const created = await createEvent({
    name: 'Afterparty',
    eventDate: '2026-12-14',
    eventTime: '9:00 PM',
    venueName: 'Rooftop Lounge',
    imageUrl: 'https://example.public.blob.vercel-storage.com/venue.jpg',
  });
  assert.equal(created.success, true);
  assert.equal(created.event.imageUrl, 'https://example.public.blob.vercel-storage.com/venue.jpg');
});

test('updateEvent can set and clear an imageUrl', async () => {
  const events = await listEvents();
  const ceremony = events.find((e) => e.name === 'Ceremony');
  assert.equal(ceremony.imageUrl, '');

  const withImage = await updateEvent(ceremony.id, { imageUrl: 'https://example.com/venue.png' });
  assert.equal(withImage.success, true);
  assert.equal(withImage.event.imageUrl, 'https://example.com/venue.png');

  const cleared = await updateEvent(ceremony.id, { imageUrl: '' });
  assert.equal(cleared.success, true);
  assert.equal(cleared.event.imageUrl, '');
});

test('deleteEvent removes the event', async () => {
  const events = await listEvents();
  const reception = events.find((e) => e.name === 'Reception');

  const deleted = await deleteEvent(reception.id);
  assert.equal(deleted.success, true);

  const remaining = await listEvents();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].name, 'Ceremony');
});
