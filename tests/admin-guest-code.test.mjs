import test from 'node:test';
import assert from 'node:assert/strict';

import { generateGuestCode } from '../src/admin/generateGuestCode.js';

test('generates a SURNAME-001 code from the last word of the name', () => {
  assert.equal(generateGuestCode('Nimal Silva', []), 'SILVA-001');
});

test('uses a single-word name as the surname', () => {
  assert.equal(generateGuestCode('Nimal', []), 'NIMAL-001');
});

test('increments the sequence when the surname is already taken', () => {
  const existing = ['SILVA-001', 'SILVA-002'];
  assert.equal(generateGuestCode('Kamala Silva', existing), 'SILVA-003');
});

test('sequences surnames independently of each other', () => {
  const existing = ['SILVA-001', 'SILVA-002', 'PERERA-001'];
  assert.equal(generateGuestCode('Ruwan Perera', existing), 'PERERA-002');
});

test('fills a gap left by a removed code rather than reusing a live one', () => {
  // SILVA-002 was soft-deleted and its code freed; the next code must not collide.
  const existing = ['SILVA-001', 'SILVA-003'];
  assert.equal(generateGuestCode('Amal Silva', existing), 'SILVA-002');
});

test('strips non-alphabetic characters from the surname', () => {
  assert.equal(generateGuestCode("Nimal D'Silva-Fernando", []), 'DSILVAFERNANDO-001');
});

test('ignores trailing whitespace and casing when deriving the surname', () => {
  assert.equal(generateGuestCode('  nimal   silva  ', []), 'SILVA-001');
});

test('is case-insensitive when checking existing codes', () => {
  assert.equal(generateGuestCode('Nimal Silva', ['silva-001']), 'SILVA-002');
});

test('rejects a name with no usable letters', () => {
  assert.throws(() => generateGuestCode('   ', []), /invalid_name/);
  assert.throws(() => generateGuestCode('123 456', []), /invalid_name/);
});

test('rejects a surname that has exhausted its 999 codes', () => {
  const existing = Array.from(
    { length: 999 },
    (_, i) => `SILVA-${String(i + 1).padStart(3, '0')}`
  );
  assert.throws(() => generateGuestCode('Nimal Silva', existing), /code_space_exhausted/);
});
