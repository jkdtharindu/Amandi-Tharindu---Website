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
const TEMPLATE_ORDER = [
  'initial_invite', 'initial_invite_2', 'initial_invite_3', 'initial_invite_4',
  'guest_code', 'reminder_1', 'table_update', 'reminder_2', 'thank_you',
];

const TEMPLATE_LABELS = {
  initial_invite: 'Initial invite',
  initial_invite_2: 'Initial invite (template 2)',
  initial_invite_3: 'Initial invite (template 3)',
  initial_invite_4: 'Initial invite (template 4)',
  guest_code: 'Guest code',
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
    imageUrl: row.image_url ?? row.imageUrl ?? null,
    // Guest groups this wording is sent to (migration 035); [] before it runs.
    groups: row.linked_groups ?? row.groups ?? [],
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

const sameGroup = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/**
 * Links a template to guest groups, creating the row from `fallbackBody` if it does
 * not exist yet. A group belongs to one wording only, so it is removed from every
 * other row of the same level (`siblingNames`). Needs migration 035's column.
 */
export async function saveTemplateGroups(name, groups, fallbackBody, siblingNames = []) {
  const unique = [...new Map(groups.map((group) => [String(group).trim().toLowerCase(), String(group).trim()])).values()].filter(Boolean);

  if (!isDbEnabled()) {
    for (const siblingName of siblingNames) {
      const sibling = messageTemplates.find((entry) => entry.name === siblingName);
      if (sibling) sibling.groups = (sibling.groups ?? []).filter((group) => !unique.some((taken) => sameGroup(taken, group)));
    }
    const existing = messageTemplates.find((entry) => entry.name === name);
    if (existing) {
      existing.groups = unique;
      return mapRow(existing);
    }
    const created = { id: `template-${name}`, name, body: fallbackBody, channel: 'whatsapp', groups: unique };
    messageTemplates.push(created);
    return mapRow(created);
  }

  if (siblingNames.length && unique.length) {
    await query(
      `UPDATE message_templates
          SET linked_groups = ARRAY(
            SELECT g FROM unnest(linked_groups) AS g WHERE lower(trim(g)) <> ALL ($2::text[])
          )
        WHERE name = ANY ($1::text[])`,
      [siblingNames, unique.map((group) => group.toLowerCase())]
    );
  }
  const { rows } = await query(
    `INSERT INTO message_templates (name, body, channel, linked_groups)
     VALUES ($1, $2, 'whatsapp', $3)
     ON CONFLICT (name) DO UPDATE SET linked_groups = EXCLUDED.linked_groups
     RETURNING *`,
    [name, fallbackBody, unique]
  );
  return mapRow(rows[0]);
}

/** Removes an extra wording (variant 2+). Its groups fall back to the first wording. */
export async function deleteTemplate(name) {
  if (!isDbEnabled()) {
    const index = messageTemplates.findIndex((entry) => entry.name === name);
    if (index !== -1) messageTemplates.splice(index, 1);
    return;
  }
  await query('DELETE FROM message_templates WHERE name = $1', [name]);
}

/**
 * Removes the wording at position `index` of `names` (a level's saved row names in
 * order, e.g. ['initial_invite', 'initial_invite_2']) and closes the gap: every later
 * wording (text, groups, photo) moves up one place and the last row is deleted. Removing
 * the only wording just deletes its row, so the level falls back to its default text.
 * Log rows that pointed at a deleted row keep their line but lose the link.
 */
export async function removeTemplateAt(names, index) {
  const last = names.length - 1;
  if (index < 0 || index > last) return;

  if (!isDbEnabled()) {
    for (let i = index; i < last; i += 1) {
      const from = messageTemplates.find((entry) => entry.name === names[i + 1]);
      const to = messageTemplates.find((entry) => entry.name === names[i]);
      if (!from) continue;
      if (to) {
        to.body = from.body;
        to.groups = [...(from.groups ?? [])];
        to.imageUrl = from.imageUrl ?? null;
      } else {
        messageTemplates.push({ ...from, id: `template-${names[i]}`, name: names[i], groups: [...(from.groups ?? [])] });
      }
    }
    const at = messageTemplates.findIndex((entry) => entry.name === names[last]);
    if (at !== -1) messageTemplates.splice(at, 1);
    return;
  }

  for (let i = index; i < last; i += 1) {
    await query(
      `INSERT INTO message_templates (name, body, channel, linked_groups, image_url)
       SELECT $1, body, channel, linked_groups, image_url FROM message_templates WHERE name = $2
       ON CONFLICT (name) DO UPDATE
         SET body = EXCLUDED.body, linked_groups = EXCLUDED.linked_groups, image_url = EXCLUDED.image_url`,
      [names[i], names[i + 1]]
    );
  }
  await query(
    'UPDATE message_logs SET template_id = NULL WHERE template_id IN (SELECT id FROM message_templates WHERE name = $1)',
    [names[last]]
  );
  await query('DELETE FROM message_templates WHERE name = $1', [names[last]]);
}

/**
 * Sets (or clears, with null) the preview photo for one template, creating the
 * row from `fallbackBody` if it does not exist yet (the table-number level has no
 * seeded row). Needs migration 033's image_url column.
 */
export async function saveTemplateImage(name, imageUrl, fallbackBody) {
  if (!isDbEnabled()) {
    const existing = messageTemplates.find((entry) => entry.name === name);
    if (existing) {
      existing.imageUrl = imageUrl;
      return mapRow(existing);
    }
    const created = { id: `template-${name}`, name, body: fallbackBody, channel: 'whatsapp', imageUrl };
    messageTemplates.push(created);
    return mapRow(created);
  }

  const { rows } = await query(
    `INSERT INTO message_templates (name, body, channel, image_url)
     VALUES ($1, $2, 'whatsapp', $3)
     ON CONFLICT (name) DO UPDATE SET image_url = EXCLUDED.image_url
     RETURNING *`,
    [name, fallbackBody, imageUrl]
  );
  return mapRow(rows[0]);
}
