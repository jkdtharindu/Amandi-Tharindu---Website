import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getRelationships,
  validateGuestInput,
} from '../src/admin/guestValidation.js';

test('exposes the default relationship groups', () => {
  const relationships = getRelationships();
  assert.deepEqual([...relationships], [
    'Relations',
    'Colleagues',
    'Neighbours',
    'Friends',
  ]);
});

test('accepts a valid guest and returns normalised values', () => {
  const result = validateGuestInput({
    name: '  Nimal Silva  ',
    relationship: 'Relations',
    slotCount: '2',
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.name, 'Nimal Silva', 'name is trimmed');
  assert.equal(result.value.slotCount, 2, 'slot count is coerced to a number');
});

test('requires a name', () => {
  for (const name of ['', '   ', null, undefined]) {
    const result = validateGuestInput({ name, relationship: 'Friends', slotCount: 1 });
    assert.equal(result.valid, false);
    assert.equal(result.errors.name, 'Name is required.');
  }
});

test('rejects a relationship outside the allowed groups', () => {
  const result = validateGuestInput({
    name: 'Nimal Silva',
    relationship: 'Enemies',
    slotCount: 1,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.relationship);
});

test('rejects a slot count below 1', () => {
  const result = validateGuestInput({
    name: 'Nimal Silva',
    relationship: 'Friends',
    slotCount: 0,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.slotCount);
});

test('rejects a non-integer or non-numeric slot count', () => {
  for (const slotCount of [1.5, 'two', NaN, null]) {
    const result = validateGuestInput({
      name: 'Nimal Silva',
      relationship: 'Friends',
      slotCount,
    });
    assert.equal(result.valid, false, `should reject ${slotCount}`);
  }
});

test('caps the slot count at a sane upper bound', () => {
  const result = validateGuestInput({
    name: 'Nimal Silva',
    relationship: 'Friends',
    slotCount: 1000,
  });
  assert.equal(result.valid, false);
});

test('accepts an optional WhatsApp number and trims it', () => {
  const result = validateGuestInput({
    name: 'Nimal Silva',
    relationship: 'Friends',
    slotCount: 1,
    whatsappNumber: '  +94123456789 ',
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.whatsappNumber, '+94123456789');
});

test('normalises an omitted WhatsApp number to null', () => {
  const result = validateGuestInput({
    name: 'Nimal Silva',
    relationship: 'Friends',
    slotCount: 1,
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.whatsappNumber, null);
});

test('reports every invalid field at once', () => {
  const result = validateGuestInput({ name: '', relationship: 'Nope', slotCount: -1 });

  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), [
    'name',
    'relationship',
    'slotCount',
  ]);
});
