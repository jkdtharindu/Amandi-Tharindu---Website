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
const TEMPLATE_ORDER = ['initial_invite', 'reminder_1', 'reminder_2', 'thank_you'];

const TEMPLATE_LABELS = {
  initial_invite: 'Initial invite',
  reminder_1: 'First reminder',
  reminder_2: 'Final reminder',
  thank_you: 'Thank you',
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
