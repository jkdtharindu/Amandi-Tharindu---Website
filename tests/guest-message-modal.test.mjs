import test from 'node:test';
import assert from 'node:assert/strict';

import { renderTemplate, greetingForParty, TABLE_UPDATE_TEMPLATE } from '../src/admin/messageTemplates.js';

// [Greeting] and the table-number-update template, added for Action 73's
// per-guest Messages drop-down. [TableNumber] itself — the table's name, never
// its number — is Action 68's tableLabelsByGuest() (tests/table-sides.test.mjs);
// this file only covers what the drop-down adds on top of that.

test('greetingForParty names the side, since no per-admin display name exists', () => {
  assert.equal(greetingForParty('bride'), "The Bride's Family");
  assert.equal(greetingForParty('groom'), "The Groom's Family");
});

test('greetingForParty defaults to the bride for an unrecognised or missing party', () => {
  assert.equal(greetingForParty(undefined), "The Bride's Family");
  assert.equal(greetingForParty('nonsense'), "The Bride's Family");
});

test('the table-update template renders [Name], [TableNumber] and [Greeting] together', () => {
  const rendered = renderTemplate(TABLE_UPDATE_TEMPLATE, {
    name: 'Kamala',
    tablenumber: 'Rose Table',
    greeting: greetingForParty('groom'),
  });

  assert.match(rendered, /Kamala/);
  assert.match(rendered, /Rose Table/);
  assert.match(rendered, /The Groom's Family/);
});

test('[Greeting] and [TableNumber] render blank when no data is supplied, matching [Date]/[Venue]', () => {
  const rendered = renderTemplate('Hi [Name], see you at [TableNumber] — [Greeting]', { name: 'Kamala' });
  assert.equal(rendered, 'Hi Kamala, see you at  — ');
});

test('a genuinely unknown placeholder is still left untouched, not swallowed', () => {
  const rendered = renderTemplate('Hi [Name], [Typo]', { name: 'Kamala' });
  assert.equal(rendered, 'Hi Kamala, [Typo]');
});
