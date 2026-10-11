import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_SECTION_KEYS,
  getHomeSectionVisibility,
  setHomeSectionVisibility,
} from '../src/home-sections/homeSectionsRepo.js';
import { validateCelebrationEventInput } from '../src/celebration-events/validateCelebrationEvent.js';
import { createEvent, updateEvent } from '../src/celebration-events/celebrationEventsRepo.js';
import { celebrationEvents } from '../src/data/celebrationEventsStore.js';

const ORIGINAL_EVENTS = structuredClone(celebrationEvents);

beforeEach(async () => {
  for (const key of HOME_SECTION_KEYS) await setHomeSectionVisibility(key, true);
  celebrationEvents.length = 0;
  celebrationEvents.push(...structuredClone(ORIGINAL_EVENTS));
});

test('every built-in homepage section starts visible', async () => {
  const visibility = await getHomeSectionVisibility();
  assert.deepEqual(Object.keys(visibility), HOME_SECTION_KEYS);
  assert.ok(Object.values(visibility).every((shown) => shown === true));
});

test('hiding a section hides only that one, and showing it brings it back', async () => {
  assert.deepEqual(await setHomeSectionVisibility('gallery', false), { success: true });
  let visibility = await getHomeSectionVisibility();
  assert.equal(visibility.gallery, false);
  assert.equal(visibility['our-story'], true);

  await setHomeSectionVisibility('gallery', true);
  visibility = await getHomeSectionVisibility();
  assert.equal(visibility.gallery, true);
});

test('an unknown section key or a non-boolean value is refused', async () => {
  assert.equal((await setHomeSectionVisibility('not-a-section', false)).success, false);
  assert.equal((await setHomeSectionVisibility('gallery', 'no')).success, false);
  assert.equal((await getHomeSectionVisibility()).gallery, true);
});

test('event parking note and dress code are trimmed and default to empty', () => {
  const plain = validateCelebrationEventInput({
    name: 'Ceremony',
    eventDate: '2026-12-14',
    eventTime: '10:30 AM',
    venueName: 'Hall',
  });
  assert.equal(plain.event.parkingNote, '');
  assert.equal(plain.event.dressCode, '');

  const withNotes = validateCelebrationEventInput({
    name: 'Ceremony',
    eventDate: '2026-12-14',
    eventTime: '10:30 AM',
    venueName: 'Hall',
    parkingNote: ' Free parking behind the hotel ',
    dressCode: ' Traditional ',
  });
  assert.equal(withNotes.event.parkingNote, 'Free parking behind the hotel');
  assert.equal(withNotes.event.dressCode, 'Traditional');
});

test('parking note and dress code are saved on create and on update', async () => {
  const created = await createEvent({
    name: 'Afterparty',
    eventDate: '2026-12-14',
    eventTime: '9:00 PM',
    venueName: 'Rooftop',
    parkingNote: 'Street parking',
    dressCode: 'Smart casual',
  });
  assert.equal(created.event.parkingNote, 'Street parking');
  assert.equal(created.event.dressCode, 'Smart casual');

  const updated = await updateEvent(created.event.id, { dressCode: 'Black tie' });
  assert.equal(updated.event.dressCode, 'Black tie');
  assert.equal(updated.event.parkingNote, 'Street parking');
});
