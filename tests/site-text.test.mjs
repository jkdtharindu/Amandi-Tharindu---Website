import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  SITE_TEXT_FIELDS,
  SITE_TEXT_GROUPS,
  SITE_TEXT_KEYS,
  MAX_SITE_TEXT_LENGTH,
  createT,
  defaultSiteText,
  fillText,
} from '../src/site-text/siteTextRegistry.js';
import { getSiteTextOverrides, saveSiteText } from '../src/site-text/siteTextRepo.js';

beforeEach(async () => {
  // Back to the default wording before each test.
  await saveSiteText(Object.fromEntries(SITE_TEXT_KEYS.map((key) => [key, ''])));
});

test('every wording key is unique, belongs to a known group and has default text', () => {
  assert.equal(new Set(SITE_TEXT_KEYS).size, SITE_TEXT_KEYS.length);
  for (const field of SITE_TEXT_FIELDS) {
    assert.ok(SITE_TEXT_GROUPS.includes(field.group), `${field.key} has an unknown group`);
    assert.ok(field.defaultText.trim().length > 0, `${field.key} has no default text`);
    assert.ok(field.defaultText.length <= MAX_SITE_TEXT_LENGTH, `${field.key} default is too long`);
  }
});

test('each tag a field lists really appears in its default text', () => {
  for (const field of SITE_TEXT_FIELDS) {
    for (const tag of field.tags) {
      if (tag === '{coupleFirstName}' || tag === '{status}') continue;
      assert.ok(field.defaultText.includes(tag), `${field.key} lists ${tag} but its default does not use it`);
    }
  }
});

test('fillText fills known tags and leaves unknown ones as written', () => {
  assert.equal(fillText('Hi {guestName}, see {nothing}', { guestName: 'Nimal' }), 'Hi Nimal, see {nothing}');
  assert.equal(fillText('{a}{a}', { a: 1 }), '11');
});

test('createT gives the default wording, then the edited wording, and fills tags', () => {
  assert.equal(createT({})('menu.gallery'), 'Gallery');
  assert.equal(createT({ 'menu.gallery': 'Pre-shoot photos' })('menu.gallery'), 'Pre-shoot photos');
  assert.equal(
    createT({})('hero.flag', { weddingDate: 'Monday, 14 December 2026' }),
    'Save the date — Monday, 14 December 2026'
  );
  // An empty edit falls back to the default.
  assert.equal(createT({ 'menu.gallery': '' })('menu.gallery'), 'Gallery');
});

test('saving wording stores it, trims it, and shows only the edits', async () => {
  assert.deepEqual(await saveSiteText({ 'menu.gallery': '  Pre-shoot photos  ' }), { success: true });
  assert.deepEqual(await getSiteTextOverrides(), { 'menu.gallery': 'Pre-shoot photos' });
});

test('empty text, or text equal to the default, goes back to the default wording', async () => {
  await saveSiteText({ 'menu.gallery': 'Pre-shoot photos', 'menu.wishes': 'Blessings' });
  await saveSiteText({ 'menu.gallery': '', 'menu.wishes': defaultSiteText('menu.wishes') });
  assert.deepEqual(await getSiteTextOverrides(), {});
});

test('an unknown key, a non-text value or over-long text saves nothing at all', async () => {
  const unknown = await saveSiteText({ 'menu.gallery': 'Pre-shoot photos', 'not.a.key': 'x' });
  assert.equal(unknown.success, false);
  assert.equal((await saveSiteText({ 'menu.gallery': 5 })).success, false);
  assert.equal((await saveSiteText({ 'menu.gallery': 'x'.repeat(MAX_SITE_TEXT_LENGTH + 1) })).success, false);
  assert.deepEqual(await getSiteTextOverrides(), {});
});

test('the Our Story button link only accepts the dropdown links', async () => {
  const { saveSiteText } = await import('../src/site-text/siteTextRepo.js');
  assert.equal(defaultSiteText('hero.buttonStoryLink'), '#our-story');

  const bad = await saveSiteText({ 'hero.buttonStoryLink': 'javascript:alert(1)' });
  assert.equal(bad.success, false);
  assert.equal(bad.errors[0].reason, 'not_a_choice');

  const good = await saveSiteText({ 'hero.buttonStoryLink': '#gallery' });
  assert.equal(good.success, true);
  assert.equal(createT({ 'hero.buttonStoryLink': '#gallery' })('hero.buttonStoryLink'), '#gallery');
  // An unsafe value that somehow reached the database is ignored.
  assert.equal(createT({ 'hero.buttonStoryLink': 'https://evil.test' })('hero.buttonStoryLink'), '#our-story');
  await saveSiteText({ 'hero.buttonStoryLink': '' });
});
