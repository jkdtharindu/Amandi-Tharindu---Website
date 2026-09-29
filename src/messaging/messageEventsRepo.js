import crypto from 'node:crypto';
import { query } from '../db.js';
import { messageEvents } from '../data/messageEventsStore.js';

/**
 * Per-guest "tick as sent" tracking for the Messages drop-down (P1-14G).
 *
 * Moved out of adminRepo.js and rewritten (Action 73, migration 024): the
 * original recordMessageEvent's `ON CONFLICT DO NOTHING` had no unique
 * constraint to target, so every call inserted a new row instead of updating
 * the existing one, and the in-memory path never stored anything at all.
 */

const isDbEnabled = () => Boolean(process.env.DATABASE_URL);

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    guestId: row.guest_id,
    eventName: row.event_name,
    isCompleted: row.is_completed,
    sentAt: row.sent_at,
    sentByParty: row.sent_by_party,
  };
}

/**
 * Sets whether `eventName` (e.g. "RSVP Reminder", "Table Details") is ticked as
 * sent for `guestId`. A true upsert: the same guest+event pair is one row that
 * can be ticked and un-ticked, not appended to. `sentAt` only moves forward,
 * when a message is (re)marked sent — un-ticking keeps the last time it was.
 */
export async function setMessageEventCompletion(guestId, eventName, party, isCompleted) {
  if (!isDbEnabled()) {
    const now = new Date().toISOString();
    let event = messageEvents.find((entry) => entry.guestId === guestId && entry.eventName === eventName);
    if (!event) {
      event = {
        id: crypto.randomUUID(),
        guestId,
        eventName,
        sentByParty: party,
        isCompleted,
        sentAt: isCompleted ? now : null,
        createdAt: now,
      };
      messageEvents.push(event);
    } else {
      event.isCompleted = isCompleted;
      event.sentByParty = party;
      if (isCompleted) event.sentAt = now;
    }
    return { ...event };
  }

  const { rows } = await query(
    `INSERT INTO message_events (guest_id, event_name, sent_by_party, is_completed, sent_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN now() ELSE NULL END)
     ON CONFLICT (guest_id, event_name)
     DO UPDATE SET
       is_completed = EXCLUDED.is_completed,
       sent_by_party = EXCLUDED.sent_by_party,
       sent_at = CASE WHEN EXCLUDED.is_completed THEN now() ELSE message_events.sent_at END
     RETURNING *`,
    [guestId, eventName, party, isCompleted]
  );
  return mapRow(rows[0]);
}

/** Every tracked message kind's completion state for one guest. */
export async function getMessageEventsForGuest(guestId) {
  if (!isDbEnabled()) {
    return messageEvents.filter((entry) => entry.guestId === guestId).map((entry) => ({ ...entry }));
  }

  const { rows } = await query(
    `SELECT id, guest_id, event_name, is_completed, sent_at, sent_by_party
     FROM message_events WHERE guest_id = $1 ORDER BY event_name`,
    [guestId]
  );
  return rows.map(mapRow);
}
