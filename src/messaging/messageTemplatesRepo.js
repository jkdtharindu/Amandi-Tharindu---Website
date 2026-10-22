import { query } from '../db.js';
import { messageTemplates } from '../data/messageTemplatesStore.js';

/**
 * MessageTemplate catalogue (PRD P1-07).
 *
 * Read-only for now: the four templates are seeded by migration 005 and the
 * admin edits the text per send in the messaging center. Same DB-or-in-memory
 * dual mode as the other repos.
 */

const isDbEnabled = () => Boolean(process.env.DATABASE_URL);

/** PRD ordering — the templates are a sequence, not an alphabetical list. */
const TEMPLATE_ORDER = ['initial_invite', 'reminder_1', 'table_update', 'reminder_2', 'thank_you'];

const TEMPLATE_LABELS = {
  initial_invite: 'Initial invite',
  reminder_1: 'First reminder',
  reminder_2: 'Final reminder',
  thank_you: 'Thank you',
  table_update: 'Table number (final)',
};

/** Friendly name for the admin UI; unknown templates show their raw name. */
export function templateLabel(name) {
  return TEMPLATE_LABELS[name] ?? String(name ?? '');
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    label: templateLabel(row.name),
    body: row.body,
    channel: row.channel,
  };
}

function bySequence(a, b) {
  const orderA = TEMPLATE_ORDER.indexOf(a.name);
  const orderB = TEMPLATE_ORDER.indexOf(b.name);
  // Anything added later (not in the PRD sequence) sorts after the four seeds.
  return (
    (orderA === -1 ? TEMPLATE_ORDER.length : orderA) -
    (orderB === -1 ? TEMPLATE_ORDER.length : orderB)
  );
}

export async function listTemplates() {
  if (!isDbEnabled()) {
    return messageTemplates.map(mapRow).sort(bySequence);
  }

  const { rows } = await query('SELECT * FROM message_templates');
  return rows.map(mapRow).sort(bySequence);
}

/**
 * Saves the admin's wording for one template, creating the row if it does not
 * exist yet (the table-number template has no seeded row). An upsert on the
 * unique `name`, so it needs no migration.
 */
export async function saveTemplate(name, body) {
  if (!isDbEnabled()) {
    const existing = messageTemplates.find((entry) => entry.name === name);
    if (existing) {
      existing.body = body;
      return mapRow(existing);
    }
    const created = { id: `template-${name}`, name, body, channel: 'whatsapp' };
    messageTemplates.push(created);
    return mapRow(created);
  }

  const { rows } = await query(
    `INSERT INTO message_templates (name, body, channel)
     VALUES ($1, $2, 'whatsapp')
     ON CONFLICT (name) DO UPDATE SET body = EXCLUDED.body
     RETURNING *`,
    [name, body]
  );
  return mapRow(rows[0]);
}
