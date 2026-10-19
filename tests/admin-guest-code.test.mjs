import test from 'node:test';
import assert from 'node:assert/strict';

import { generateGuestCode } from '../src/admin/generateGuestCode.js';

// Action 84 / PRD §23: 5 characters = group letter + name letter + 3 digits.

test('builds a 5-character code: group letter, name letter, 3 digits', () => {
  const code = generateGuestCode('Nimal Silva', 'Friends', []);
  assert.match(code, /^FN\d{3}$/);
  assert.equal(code.length, 5);
});

test('takes the first letter of the group and of the name', () => {
  assert.match(generateGuestCode('Alexander Smith', 'Colleagues', []), /^CA\d{3}$/);
  assert.match(generateGuestCode('Ruwan Perera', 'Neighbours', []), /^NR\d{3}$/);
  assert.match(generateGuestCode('Kamala', 'Relations', []), /^RK\d{3}$/);
});

test('works for a custom group', () => {
  assert.match(generateGuestCode('Silva Family', 'School mates', []), /^SS\d{3}$/);
});

test('works for a couple or family name', () => {
  assert.match(generateGuestCode('Nimal & Kamala', 'Friends', []), /^FN\d{3}$/);
});

test('avoids existing codes case-insensitively', () => {
  // Leave exactly one free number so the result is forced.
  const existing = [];
  for (let n = 0; n < 1000; n += 1) {
    if (n !== 417) existing.push(`fn${String(n).padStart(3, '0')}`);
  }
  assert.equal(generateGuestCode('Nimal Silva', 'Friends', existing), 'FN417');
});

test('throws when every number for that letter pair is taken', () => {
  const existing = [];
  for (let n = 0; n < 1000; n += 1) existing.push(`FN${String(n).padStart(3, '0')}`);
  assert.throws(() => generateGuestCode('Nimal', 'Friends', existing), /code_space_exhausted/);
});

test('skips leading symbols and digits to find the first letter', () => {
  assert.match(generateGuestCode("  1 'nimal", '  friends ', []), /^FN\d{3}$/);
});

test('ignores whitespace and casing in input', () => {
  assert.match(generateGuestCode('  NIMAL   SILVA  ', '  RELATIONS  ', []), /^RN\d{3}$/);
});

test('rejects a name with no usable letters', () => {
  assert.throws(() => generateGuestCode('   ', 'Relations', []), /invalid_name/);
  assert.throws(() => generateGuestCode('123 456', 'Relations', []), /invalid_name/);
});

test('rejects a group with no usable letters', () => {
  assert.throws(() => generateGuestCode('Nimal Silva', '   ', []), /invalid_relationship/);
  assert.throws(() => generateGuestCode('Nimal Silva', '123 456', []), /invalid_relationship/);
});
