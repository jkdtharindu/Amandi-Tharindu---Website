import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSeatingCompletion } from '../src/table-arrangement/seatingCompletion.js';
import { MESSAGE_LEVELS, templateBodyFor } from '../src/messaging/messageLevels.js';
import { listTemplates, saveTemplate } from '../src/messaging/messageTemplatesRepo.js';
import { messageTemplates } from '../src/data/messageTemplatesStore.js';

// The Guest list's Seating column (green / yellow / red) and the saved
// per-level message templates. In-memory path (DATABASE_URL unset).

const person = (id, guestId, rsvpStatus = 'accepted') => ({
  id,
  guestId,
  rsvpStatus,
  approvalStatus: 'approved',
});
const seatOf = (props) => ({ guestId: null, inviteeId: null, ...props });
const table = (...seats) => ({ seats });

test('everyone accepted is seated: complete (green)', () => {
  const result = computeSeatingCompletion({
    guests: [{ id: 'g1', rsvpStatus: 'accepted' }],
    invitees: [person('a', 'g1'), person('b', 'g1')],
    tables: [table(seatOf({ inviteeId: 'a' }), seatOf({ inviteeId: 'b' }))],
  });
  assert.deepEqual(result.get('g1'), { status: 'complete', seated: 2, total: 2 });
});

test('some seated, some not: partial (yellow); a pending member is not counted', () => {
  const result = computeSeatingCompletion({
    guests: [{ id: 'g1', rsvpStatus: 'accepted' }],
    invitees: [person('a', 'g1'), person('b', 'g1'), person('c', 'g1', 'pending')],
    tables: [table(seatOf({ inviteeId: 'a' }))],
  });
  assert.deepEqual(result.get('g1'), { status: 'partial', seated: 1, total: 2 });
});

test('nobody seated, or nobody accepted yet: none (red)', () => {
  const result = computeSeatingCompletion({
    guests: [
      { id: 'g1', rsvpStatus: 'accepted' },
      { id: 'g2', rsvpStatus: 'pending' },
    ],
    invitees: [person('a', 'g1'), person('b', 'g2', 'pending')],
    tables: [],
  });
  assert.equal(result.get('g1').status, 'none');
  assert.equal(result.get('g2').status, 'none');
});

test('a whole-party seat covers every accepted member; headcount-only parties count as one', () => {
  const result = computeSeatingCompletion({
    guests: [
      { id: 'g1', rsvpStatus: 'accepted' },
      { id: 'g2', rsvpStatus: 'accepted' },
    ],
    invitees: [person('a', 'g1'), person('b', 'g1')],
    tables: [table(seatOf({ guestId: 'g1' }), seatOf({ guestId: 'g2' }))],
  });
  assert.equal(result.get('g1').status, 'complete');
  assert.equal(result.get('g2').status, 'complete');
});

test('declined parties and removed guests are skipped', () => {
  const result = computeSeatingCompletion({
    guests: [
      { id: 'g1', rsvpStatus: 'declined' },
      { id: 'g2', rsvpStatus: 'accepted', isDeleted: true },
    ],
    invitees: [person('a', 'g1', 'declined')],
    tables: [],
  });
  assert.equal(result.get('g1').status, 'skip');
  assert.equal(result.has('g2'), false);
});

test('each level falls back to its default wording until the admin saves one', async () => {
  const tableLevel = MESSAGE_LEVELS.find((level) => level.key === 'table_update');
  const before = messageTemplates.length;

  assert.equal(templateBodyFor(tableLevel, await listTemplates()), tableLevel.defaultBody);

  await saveTemplate('table_update', 'Hi [Name], your table: [TableNumber]');
  const saved = await listTemplates();
  assert.equal(templateBodyFor(tableLevel, saved), 'Hi [Name], your table: [TableNumber]');

  // Saving again changes the same row instead of adding another.
  await saveTemplate('table_update', 'Second version');
  assert.equal(messageTemplates.filter((entry) => entry.name === 'table_update').length, 1);
  assert.equal(messageTemplates.length, before + 1);

  messageTemplates.splice(messageTemplates.findIndex((entry) => entry.name === 'table_update'), 1);
});

test('saving a seeded level template changes its wording', async () => {
  const level = MESSAGE_LEVELS[0];
  const original = messageTemplates.find((entry) => entry.name === level.templateName).body;

  await saveTemplate(level.templateName, 'New invitation wording [Name]');
  assert.equal(templateBodyFor(level, await listTemplates()), 'New invitation wording [Name]');

  await saveTemplate(level.templateName, original);
});
