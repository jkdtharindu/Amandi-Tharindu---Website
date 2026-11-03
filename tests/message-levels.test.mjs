import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MESSAGE_LEVELS,
  levelProgress,
  stepLabel,
  templateBodyFor,
  templateVariants,
  variantForGroup,
  variantTemplateName,
} from '../src/messaging/messageLevels.js';
import { TABLE_UPDATE_TEMPLATE } from '../src/admin/messageTemplates.js';
import {
  saveTemplate,
  saveTemplateGroups,
  deleteTemplate,
  listTemplates,
} from '../src/messaging/messageTemplatesRepo.js';

const level = (key) => MESSAGE_LEVELS.find((entry) => entry.key === key);

test('there are four levels, in the order a guest receives them', () => {
  assert.deepEqual(
    MESSAGE_LEVELS.map((entry) => entry.eventName),
    ['Main Invitation', 'Guest Code', 'RSVP Reminder', 'Table Details'],
  );
  assert.deepEqual(MESSAGE_LEVELS.map((entry) => entry.number), [1, 2, 3, 4]);
});

test('every level is numbered "Step N of 4"', () => {
  assert.deepEqual(
    MESSAGE_LEVELS.map(stepLabel),
    ['Step 1 of 4', 'Step 2 of 4', 'Step 3 of 4', 'Step 4 of 4'],
  );
});

test('a guest with no ticks is at 0%', () => {
  const progress = levelProgress([]);
  assert.equal(progress.doneCount, 0);
  assert.equal(progress.percent, 0);
});

test('only completed ticks count, and old event names are ignored', () => {
  const progress = levelProgress([
    { eventName: 'Main Invitation', isCompleted: true },
    { eventName: 'RSVP Reminder', isCompleted: false },
    { eventName: 'Thank You', isCompleted: true },
  ]);

  assert.equal(progress.doneCount, 1);
  assert.equal(progress.percent, 25);
  assert.deepEqual(progress.levels.map((entry) => entry.done), [true, false, false, false]);
});

test('all four ticked is 100%', () => {
  const progress = levelProgress(MESSAGE_LEVELS.map((entry) => ({ eventName: entry.eventName, isCompleted: true })));
  assert.equal(progress.percent, 100);
});

test('the main invitation does not carry the guest code, the code message does', () => {
  assert.doesNotMatch(level('main_invitation').defaultBody, /\[Code\]/i);
  assert.match(level('guest_code').defaultBody, /\[Code\]/);
});

test('the table message carries the invitation link', () => {
  assert.match(TABLE_UPDATE_TEMPLATE, /\[Link\]/);
  assert.match(level('table_update').defaultBody, /\[Link\]/);
});

test('only the main invitation keeps several templates', () => {
  assert.equal(level('main_invitation').maxTemplates, 4);
  for (const other of MESSAGE_LEVELS.filter((entry) => entry.key !== 'main_invitation')) {
    assert.equal(other.maxTemplates, 1);
  }
  assert.equal(variantTemplateName(level('main_invitation'), 1), 'initial_invite');
  assert.equal(variantTemplateName(level('main_invitation'), 3), 'initial_invite_3');
});

test('a guest gets the template linked to their group, else template 1', () => {
  const invitation = level('main_invitation');
  const templates = [
    { name: 'initial_invite', body: 'First', groups: [] },
    { name: 'initial_invite_2', body: 'Second', groups: ['Friends', 'Colleagues'] },
  ];

  assert.equal(templateVariants(invitation, templates).length, 2);
  assert.equal(templateBodyFor(invitation, templates, 'friends'), 'Second');
  assert.equal(templateBodyFor(invitation, templates, 'Colleagues'), 'Second');
  assert.equal(templateBodyFor(invitation, templates, 'Relations'), 'First');
  assert.equal(templateBodyFor(invitation, templates), 'First');
  assert.equal(variantForGroup(invitation, templates, 'Friends').variant, 2);
});

test('with nothing saved there is one template and it is the default', () => {
  const invitation = level('main_invitation');
  assert.deepEqual(templateVariants(invitation, []).map((entry) => entry.variant), [1]);
  assert.equal(templateBodyFor(invitation, [], 'Friends'), invitation.defaultBody);
});

test('linking a group to one template takes it off the others', async () => {
  const names = ['initial_invite', 'initial_invite_2'];
  await saveTemplate('initial_invite_2', 'Second');
  await saveTemplateGroups('initial_invite', ['Friends', 'Relations'], 'x', ['initial_invite_2']);
  await saveTemplateGroups('initial_invite_2', ['friends'], 'x', ['initial_invite']);

  const rows = await listTemplates();
  const groupsOf = (name) => rows.find((entry) => entry.name === name).groups;
  assert.deepEqual(groupsOf('initial_invite'), ['Relations']);
  assert.deepEqual(groupsOf('initial_invite_2'), ['friends']);

  await deleteTemplate('initial_invite_2');
  await saveTemplateGroups('initial_invite', [], 'x');
  assert.equal((await listTemplates()).some((entry) => entry.name === 'initial_invite_2'), false);
  assert.ok(names.length);
});
