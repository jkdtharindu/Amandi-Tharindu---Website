import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { renderTemplate } from '../src/admin/messageTemplates.js';
import { listTemplates, templateLabel } from '../src/messaging/messageTemplatesRepo.js';
import { selectRecipients } from '../src/messaging/selectRecipients.js';
import {
  logMessage,
  listRecentLogs,
  listSentGuestIds,
  decorateLogs,
} from '../src/messaging/messageLogRepo.js';
import { messageLogs } from '../src/data/messageLogStore.js';

beforeEach(() => {
  messageLogs.length = 0;
});

const guests = [
  {
    id: 'g1',
    code: 'NEI-RU-628',
    name: 'Ruwan Perera',
    relationship: 'Neighbours',
    rsvpStatus: 'pending',
    whatsappNumber: '+94712345678',
    isDeleted: false,
  },
  {
    id: 'g2',
    code: 'REL-AM-114',
    name: 'Amara Silva',
    relationship: 'Relations',
    rsvpStatus: 'pending',
    whatsappNumber: '+94770000000',
    isDeleted: false,
  },
  {
    id: 'g3',
    code: 'REL-NI-501',
    name: 'Nimal Fernando',
    relationship: 'Relations',
    rsvpStatus: 'pending',
    whatsappNumber: null,
    isDeleted: false,
  },
  {
    id: 'g4',
    code: 'COL-KA-777',
    name: 'Kamala Jayasuriya',
    relationship: 'Colleagues',
    rsvpStatus: 'accepted',
    whatsappNumber: '+94711111111',
    isDeleted: false,
  },
  {
    id: 'g5',
    code: 'REL-SU-222',
    name: 'Sunil Bandara',
    relationship: 'Relations',
    rsvpStatus: 'pending',
    whatsappNumber: '+94722222222',
    isDeleted: true,
  },
];

// --- Template rendering (PRD-style [Name] placeholders) ---

test('renderTemplate substitutes the PRD square-bracket placeholders', () => {
  const result = renderTemplate('Dear [Name], your code is [Code]. RSVP at [Link].', {
    name: 'Ruwan',
    code: 'NEI-RU-628',
    link: 'https://example.com/invitation/NEI-RU-628',
  });
  assert.equal(
    result,
    'Dear Ruwan, your code is NEI-RU-628. RSVP at https://example.com/invitation/NEI-RU-628.'
  );
});

test('renderTemplate substitutes [Date] and [Venue]', () => {
  const result = renderTemplate('See you on [Date] at [Venue].', {
    date: '14 December 2026',
    venue: 'Sunrise Garden Hall',
  });
  assert.equal(result, 'See you on 14 December 2026 at Sunrise Garden Hall.');
});

test('renderTemplate matches square-bracket placeholders case-insensitively', () => {
  assert.equal(renderTemplate('Hi [NAME] / [name]', { name: 'Ruwan' }), 'Hi Ruwan / Ruwan');
});

test('renderTemplate leaves an unknown square-bracket placeholder untouched', () => {
  const result = renderTemplate('Hi [Name], [Nickname]!', { name: 'Ruwan' });
  assert.equal(result, 'Hi Ruwan, [Nickname]!');
});

test('renderTemplate treats a missing square-bracket value as an empty string', () => {
  assert.equal(renderTemplate('Hi [Name]!', {}), 'Hi !');
});

test('renderTemplate still supports the curly-brace syntax alongside square brackets', () => {
  const result = renderTemplate('Hi {name}, RSVP at [Link]', {
    name: 'Ruwan',
    link: 'https://example.com/x',
  });
  assert.equal(result, 'Hi Ruwan, RSVP at https://example.com/x');
});

// --- Template catalogue ---

test('templateLabel maps the seeded template names to friendly labels', () => {
  assert.equal(templateLabel('initial_invite'), 'Initial invite');
  assert.equal(templateLabel('reminder_1'), 'First reminder');
  assert.equal(templateLabel('reminder_2'), 'Final reminder');
  assert.equal(templateLabel('thank_you'), 'Thank you');
});

test('templateLabel falls back to the raw name for an unknown template', () => {
  assert.equal(templateLabel('custom_blast'), 'custom_blast');
});

test('listTemplates returns the four seeded templates in PRD order', async () => {
  const templates = await listTemplates();
  assert.deepEqual(
    templates.map((t) => t.name),
    ['initial_invite', 'reminder_1', 'reminder_2', 'thank_you']
  );
});

test('listTemplates decorates each template with a label and a WhatsApp channel', async () => {
  const templates = await listTemplates();
  assert.equal(templates[0].label, 'Initial invite');
  for (const template of templates) {
    assert.equal(template.channel, 'whatsapp');
    assert.match(template.body, /\[Name\]/);
  }
});

test('the seeded templates use the canonical couple-name order (migration 008)', async () => {
  const templates = await listTemplates();
  for (const template of templates) {
    assert.equal(
      template.body.includes('Amandi & Tharindu'),
      false,
      `${template.name} still has the pre-migration-008 name order`
    );
  }
  assert.ok(templates.some((t) => t.body.includes('Tharindu & Amandi')));
});

// --- Recipient selection ---

test('selectRecipients returns only pending guests who have a WhatsApp number', () => {
  const { recipients } = selectRecipients(guests, { status: 'pending' });
  assert.deepEqual(
    recipients.map((g) => g.id),
    ['g2', 'g1']
  );
});

test('selectRecipients sorts recipients by name for a stable worklist order', () => {
  const { recipients } = selectRecipients(guests, { status: 'all' });
  assert.deepEqual(
    recipients.map((g) => g.name),
    ['Amara Silva', 'Kamala Jayasuriya', 'Ruwan Perera']
  );
});

test('selectRecipients excludes soft-deleted guests', () => {
  const { recipients } = selectRecipients(guests, { status: 'all' });
  assert.equal(
    recipients.some((g) => g.id === 'g5'),
    false
  );
});

test('selectRecipients filters by relationship group', () => {
  const { recipients } = selectRecipients(guests, { status: 'all', relationship: 'Relations' });
  assert.deepEqual(
    recipients.map((g) => g.id),
    ['g2']
  );
});

test('selectRecipients counts guests skipped for having no WhatsApp number', () => {
  const { noNumberCount } = selectRecipients(guests, { status: 'pending' });
  assert.equal(noNumberCount, 1);
});

test('selectRecipients excludes and counts guests already sent this template', () => {
  const { recipients, alreadySentCount } = selectRecipients(guests, {
    status: 'pending',
    skipGuestIds: ['g1'],
  });
  assert.deepEqual(
    recipients.map((g) => g.id),
    ['g2']
  );
  assert.equal(alreadySentCount, 1);
});

test('selectRecipients ignores skipGuestIds for guests who would not qualify anyway', () => {
  const { alreadySentCount } = selectRecipients(guests, {
    status: 'pending',
    skipGuestIds: ['g4'], // accepted, so not in the pending audience
  });
  assert.equal(alreadySentCount, 0);
});

// --- Message log ---

test('logMessage records a whatsapp send and returns the stored entry', async () => {
  const entry = await logMessage({ guestId: 'g1', templateId: 't1' });

  assert.ok(entry.id);
  assert.equal(entry.guestId, 'g1');
  assert.equal(entry.templateId, 't1');
  assert.equal(entry.channel, 'whatsapp');
  assert.equal(entry.status, 'sent');
  assert.ok(entry.sentAt);
  assert.equal(messageLogs.length, 1);
});

test('listRecentLogs returns the newest entries first', async () => {
  await logMessage({ guestId: 'g1', templateId: 't1' });
  await logMessage({ guestId: 'g2', templateId: 't1' });

  const logs = await listRecentLogs();
  assert.deepEqual(
    logs.map((l) => l.guestId),
    ['g2', 'g1']
  );
});

test('listRecentLogs respects the limit', async () => {
  await logMessage({ guestId: 'g1', templateId: 't1' });
  await logMessage({ guestId: 'g2', templateId: 't1' });
  await logMessage({ guestId: 'g4', templateId: 't1' });

  const logs = await listRecentLogs(2);
  assert.equal(logs.length, 2);
  assert.deepEqual(
    logs.map((l) => l.guestId),
    ['g4', 'g2']
  );
});

test('listSentGuestIds returns only the guests already sent that template', async () => {
  await logMessage({ guestId: 'g1', templateId: 't1' });
  await logMessage({ guestId: 'g2', templateId: 't2' });

  const ids = await listSentGuestIds('t1');
  assert.deepEqual(ids, ['g1']);
});

test('listSentGuestIds does not repeat a guest messaged twice with the same template', async () => {
  await logMessage({ guestId: 'g1', templateId: 't1' });
  await logMessage({ guestId: 'g1', templateId: 't1' });

  const ids = await listSentGuestIds('t1');
  assert.deepEqual(ids, ['g1']);
});

test('listSentGuestIds returns nothing when no template is given', async () => {
  await logMessage({ guestId: 'g1', templateId: 't1' });
  assert.deepEqual(await listSentGuestIds(null), []);
});

test('decorateLogs joins guest and template details onto each entry', async () => {
  await logMessage({ guestId: 'g1', templateId: 't1' });
  const logs = await listRecentLogs();

  const decorated = decorateLogs(logs, guests, [{ id: 't1', name: 'reminder_1' }]);

  assert.equal(decorated[0].guestName, 'Ruwan Perera');
  assert.equal(decorated[0].guestCode, 'NEI-RU-628');
  assert.equal(decorated[0].templateLabel, 'First reminder');
});

test('decorateLogs degrades gracefully when the guest or template is gone', async () => {
  await logMessage({ guestId: 'deleted-guest', templateId: 'deleted-template' });
  const logs = await listRecentLogs();

  const decorated = decorateLogs(logs, guests, []);

  assert.equal(decorated[0].guestName, 'Unknown guest');
  assert.equal(decorated[0].guestCode, '');
  assert.equal(decorated[0].templateLabel, 'Unknown template');
});
