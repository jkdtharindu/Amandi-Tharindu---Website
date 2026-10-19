import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeGroups } from '../src/admin/categories.js';
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

test('accepts a custom group and trims it (Action 84)', () => {
  const result = validateGuestInput({
    name: 'Nimal Silva',
    relationship: '  School mates ',
    slotCount: 1,
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.relationship, 'School mates');
});

test('rejects a group that is blank, has no letter first, or is too long', () => {
  for (const relationship of ['', '   ', '123', '!!!', 'A'.repeat(31)]) {
    const result = validateGuestInput({ name: 'Nimal Silva', relationship, slotCount: 1 });
    assert.equal(result.valid, false, `"${relationship}" should be rejected`);
    assert.ok(result.errors.relationship);
  }
});

test('mergeGroups lists the defaults first, then custom groups without repeats', () => {
  const groups = mergeGroups(['Friends', 'Work team', 'work team', 'Relations', ' ']);
  assert.deepEqual(groups, ['Relations', 'Colleagues', 'Neighbours', 'Friends', 'Work team']);
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
  const result = validateGuestInput({ name: '', relationship: '123', slotCount: -1 });

  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), [
    'name',
    'relationship',
    'slotCount',
  ]);
});

test('inviteeNames, when given, derives slotCount from the list length', () => {
  const result = validateGuestInput({
    name: 'Nimal Silva',
    relationship: 'Relations',
    slotCount: '1', // deliberately wrong -- inviteeNames should win
    inviteeNames: ['John Silva', 'Maria Silva', 'Sarah Silva'],
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.slotCount, 3);
  assert.deepEqual(result.value.inviteeNames, ['John Silva', 'Maria Silva', 'Sarah Silva']);
});

test('inviteeNames rejects a blank name in the list', () => {
  const result = validateGuestInput({
    name: 'Nimal Silva',
    relationship: 'Relations',
    inviteeNames: ['John Silva', '  '],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.inviteeNames);
});

test('omitting inviteeNames keeps the legacy manual slotCount flow', () => {
  const result = validateGuestInput({
    name: 'Nimal Silva',
    relationship: 'Relations',
    slotCount: '4',
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.slotCount, 4);
  assert.equal(result.value.inviteeNames, undefined);
});
