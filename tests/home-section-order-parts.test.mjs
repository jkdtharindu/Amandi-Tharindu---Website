import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_SECTIONS,
  HOME_SECTION_KEYS,
  HOME_PART_KEYS,
  homePartKey,
  getHomeSectionVisibility,
  getHomePartVisibility,
  setHomePartVisibility,
  setHomeSectionVisibility,
  getHomeSectionOrder,
  setHomeSectionOrder,
  orderSections,
} from '../src/home-sections/homeSectionsRepo.js';

beforeEach(async () => {
  for (const key of HOME_PART_KEYS) await setHomePartVisibility(key, true);
  for (const key of HOME_SECTION_KEYS) await setHomeSectionVisibility(key, true);
  await setHomeSectionOrder([...HOME_SECTION_KEYS]);
});

test('Our Story offers a label, heading, paragraph and milestones as separate parts', () => {
  const story = HOME_SECTIONS.find((section) => section.key === 'our-story');
  assert.deepEqual(
    story.parts.map((part) => part.key),
    ['flag', 'heading', 'intro', 'milestones']
  );
});

test('every part starts visible, with one entry per part', async () => {
  const parts = await getHomePartVisibility();
  assert.deepEqual(Object.keys(parts), HOME_PART_KEYS);
  assert.ok(Object.values(parts).every((shown) => shown === true));
});

test('hiding the milestones leaves the heading and paragraph showing', async () => {
  const key = homePartKey('our-story', 'milestones');
  assert.deepEqual(await setHomePartVisibility(key, false), { success: true });

  const parts = await getHomePartVisibility();
  assert.equal(parts[key], false);
  assert.equal(parts[homePartKey('our-story', 'heading')], true);
  assert.equal(parts[homePartKey('our-story', 'intro')], true);

  await setHomePartVisibility(key, true);
  assert.equal((await getHomePartVisibility())[key], true);
});

test('hiding a part never hides its section, and part keys never appear as sections', async () => {
  await setHomePartVisibility(homePartKey('gallery', 'intro'), false);
  const sections = await getHomeSectionVisibility();
  assert.deepEqual(Object.keys(sections), HOME_SECTION_KEYS);
  assert.equal(sections.gallery, true);
});

test('an unknown part or a non-boolean value is refused', async () => {
  assert.equal((await setHomePartVisibility('our-story:nope', false)).success, false);
  assert.equal((await setHomePartVisibility('gallery', false)).success, false);
  assert.equal((await setHomePartVisibility(homePartKey('faq', 'intro'), 'no')).success, false);
});

test('the default order is the built-in page order', async () => {
  assert.deepEqual(await getHomeSectionOrder(), HOME_SECTION_KEYS);
});

test('moving Our Story under the couple details is saved and read back', async () => {
  const moved = ['family-details', 'our-story', 'event-details', 'gallery', 'faq', 'wishes'];
  assert.deepEqual(await setHomeSectionOrder(moved), { success: true });
  assert.deepEqual(await getHomeSectionOrder(), moved);
});

test('an order that misses, repeats or invents a section is refused and changes nothing', async () => {
  const missing = HOME_SECTION_KEYS.slice(1);
  const repeated = [HOME_SECTION_KEYS[0], ...HOME_SECTION_KEYS.slice(0, -1)];
  const invented = [...HOME_SECTION_KEYS.slice(1), 'not-a-section'];
  for (const bad of [missing, repeated, invented, 'gallery', null, undefined]) {
    assert.equal((await setHomeSectionOrder(bad)).success, false);
  }
  assert.deepEqual(await getHomeSectionOrder(), HOME_SECTION_KEYS);
});

test('reordering does not change what is hidden', async () => {
  await setHomeSectionVisibility('faq', false);
  await setHomeSectionOrder([...HOME_SECTION_KEYS].reverse());
  assert.equal((await getHomeSectionVisibility()).faq, false);
});

test('orderSections uses saved positions, puts unpositioned sections last, and ignores junk', () => {
  assert.deepEqual(orderSections([]), HOME_SECTION_KEYS);
  assert.deepEqual(orderSections(undefined), HOME_SECTION_KEYS);

  const result = orderSections([
    { key: 'wishes', order: 1 },
    { key: 'our-story', order: 2 },
    { key: 'bogus', order: 0 },
    { key: 'gallery', order: null },
  ]);
  assert.deepEqual(result.slice(0, 2), ['wishes', 'our-story']);
  assert.equal(result.length, HOME_SECTION_KEYS.length);
  assert.equal(new Set(result).size, HOME_SECTION_KEYS.length);
  assert.ok(!result.includes('bogus'));
});
