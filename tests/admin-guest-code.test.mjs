import test from 'node:test';
import assert from 'node:assert/strict';

import { generateGuestCode } from '../src/admin/generateGuestCode.js';

test('generates code with category-firstname-random format', () => {
  const code = generateGuestCode('Nimal Silva', 'Relations', []);
  assert.match(code, /^REL-NI-\d{3}$/);
});

test('extracts first 2 letters from first name', () => {
  const code = generateGuestCode('Alexander Smith', 'Colleagues', []);
  assert.match(code, /^COL-AL-\d{3}$/);
});

test('extracts first 3 letters from relationship/category', () => {
  const code = generateGuestCode('Ruwan Perera', 'Neighbours', []);
  assert.match(code, /^NEI-RU-\d{3}$/);
});

test('handles single-word names', () => {
  const code = generateGuestCode('Nimal', 'Friends', []);
  assert.match(code, /^FRI-NI-\d{3}$/);
});

test('avoids existing codes case-insensitively', () => {
  const existing = ['REL-NI-042', 'REL-NI-123', 'REL-NI-500'];
  const code = generateGuestCode('Nimal Silva', 'Relations', existing);
  assert.match(code, /^REL-NI-\d{3}$/);
  assert(!existing.map((c) => c.toUpperCase()).includes(code.toUpperCase()));
});

test('avoids collisions with mixed case existing codes', () => {
  const existing = ['rel-ni-500'];
  const code = generateGuestCode('Nimal Silva', 'Relations', existing);
  assert.match(code, /^REL-NI-\d{3}$/);
  assert(!existing.map((c) => c.toUpperCase()).includes(code.toUpperCase()));
});

test('strips non-alphabetic characters from name', () => {
  const code = generateGuestCode("N1m4l D'S1lv4-F3rnnd0", 'Relations', []);
  assert.match(code, /^REL-NM-\d{3}$/);
});

test('strips non-alphabetic characters from relationship', () => {
  const code = generateGuestCode('Nimal Silva', 'R3l@t10ns!', []);
  assert.match(code, /^RLT-NI-\d{3}$/);
});

test('ignores whitespace and casing in input', () => {
  const code = generateGuestCode('  NIMAL   SILVA  ', '  RELATIONS  ', []);
  assert.match(code, /^REL-NI-\d{3}$/);
});

test('rejects a name with no usable letters', () => {
  assert.throws(() => generateGuestCode('   ', 'Relations', []), /invalid_name/);
  assert.throws(() => generateGuestCode('123 456', 'Relations', []), /invalid_name/);
});

test('rejects a relationship with no usable letters', () => {
  assert.throws(() => generateGuestCode('Nimal Silva', '   ', []), /invalid_relationship/);
  assert.throws(() => generateGuestCode('Nimal Silva', '123 456', []), /invalid_relationship/);
});
