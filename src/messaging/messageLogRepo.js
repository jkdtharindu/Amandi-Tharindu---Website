import crypto from 'node:crypto';
import { query } from '../db.js';
import { messageLogs } from '../data/messageLogStore.js';
import { guestStore } from '../data/guestStore.js';
import { templateLabel } from './messageTemplatesRepo.js';

/**
 * MessageLog persistence (PRD P1-07).
 *
 * What a row means: the admin opened WhatsApp for that guest with that
 * template. Nothing is sent programmatically (wa.me deep link — see
 * src/admin/messageTemplates.js), so delivery is NOT tracked and cannot be:
 * the admin still presses Send inside WhatsApp. The log answers "who have I
 * already worked through?", not "who received it?".
 */

const isDbEnabled = () => Boolean(process.env.DATABASE_URL);

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    guestId: row.guest_id,
    templateId: row.template_id,
    channel: row.channel,
    status: row.status,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

/**
 * @param {object} entry
 * @param {string} entry.guestId
 * @param {string|null} [entry.templateId]
 * @param {string} [entry.channel]
 * @param {string} [entry.status]
 */
export async function logMessage({
  guestId,
  templateId = null,
  channel = 'whatsapp',
  status = 'sent',
}) {
  if (!isDbEnabled()) {
    const now = new Date().toISOString();
    const entry = {
      id: crypto.randomUUID(),
      guestId,
      templateId,
      channel,
      status,
      sentAt: now,
      createdAt: now,
    };
    messageLogs.push(entry);
    return entry;
  }

  const { rows } = await query(
    `INSERT INTO message_logs (guest_id, template_id, channel, sent_at, status)
     VALUES ($1, $2, $3, now(), $4)
     RETURNING *`,
    [guestId, templateId, channel, status]
  );
  return mapRow(rows[0]);
}

/**
 * Newest first (in-memory by insertion order, the DB by created_at), only for guests on
 * one side. Carries each guest's name and code so a removed guest's old entries still read correctly.
 */
export async function listRecentLogsByParty(party, limit = 20) {
  if (!isDbEnabled()) {
    const guestById = new Map(guestStore.map((guest) => [guest.id, guest]));
    return [...messageLogs]
      .reverse()
      .flatMap((log) => {
        const guest = guestById.get(log.guestId);
        if (!guest || (guest.assignedToParty ?? 'bride') !== party) return [];
        return [{ ...log, guestName: guest.name, guestCode: guest.code }];
      })
      .slice(0, limit);
  }

  const { rows } = await query(
    `SELECT ml.*, g.name AS guest_name, g.code AS guest_code
     FROM message_logs ml
     JOIN guests g ON g.id = ml.guest_id
     WHERE g.assigned_to_party = $1
     ORDER BY ml.created_at DESC
     LIMIT $2`,
    [party, limit]
  );
  return rows.map((row) => ({ ...mapRow(row), guestName: row.guest_name, guestCode: row.guest_code }));
}

/** Guests already worked through for `templateId`, so a re-run can skip them. */
export async function listSentGuestIds(templateId) {
  if (!templateId) return [];

  if (!isDbEnabled()) {
    const ids = messageLogs
      .filter((log) => log.templateId === templateId && log.status === 'sent')
      .map((log) => log.guestId);
    return [...new Set(ids)];
  }

  const { rows } = await query(
    "SELECT DISTINCT guest_id FROM message_logs WHERE template_id = $1 AND status = 'sent'",
    [templateId]
  );
  return rows.map((row) => row.guest_id);
}

/**
 * Joins guest and template detail onto log rows for display. Kept pure and
 * separate from the queries above so the log list stays readable after a
 * guest or template row is gone.
 */
export function decorateLogs(logs = [], guests = [], templates = []) {
  const guestById = new Map(guests.map((guest) => [guest.id, guest]));
  const templateById = new Map(templates.map((template) => [template.id, template]));

  return logs.map((log) => {
    const guest = guestById.get(log.guestId);
    const template = templateById.get(log.templateId);
    return {
      ...log,
      guestName: guest?.name ?? log.guestName ?? 'Unknown guest',
      guestCode: guest?.code ?? log.guestCode ?? '',
      templateLabel: template ? templateLabel(template.name) : 'Unknown template',
    };
  });
}
