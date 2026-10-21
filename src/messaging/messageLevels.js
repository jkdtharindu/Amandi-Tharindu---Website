/**
 * The three WhatsApp message levels, in the order a guest receives them.
 * One list so the guest list ticks, the per-guest pop-up and the Messaging
 * Center cannot disagree on what a level is or what its tick is stored as.
 *
 * `eventName` is the key in message_events (a tick is one row per guest and
 * event, migration 024), so no migration is needed. `templateName` is the
 * seeded template the level starts from; level 3 has none because its wording
 * lives in TABLE_UPDATE_TEMPLATE (src/admin/messageTemplates.js).
 */
export const MESSAGE_LEVELS = [
  { key: 'main_invitation', number: 1, label: 'Main invitation', eventName: 'Main Invitation', templateName: 'initial_invite' },
  { key: 'rsvp_reminder', number: 2, label: 'RSVP reminder', eventName: 'RSVP Reminder', templateName: 'reminder_1' },
  { key: 'table_update', number: 3, label: 'Table number (final)', eventName: 'Table Details', templateName: null },
];

/**
 * How far one guest is through the three levels.
 * @param {{ eventName: string, isCompleted: boolean }[]} events
 */
export function levelProgress(events = []) {
  const done = new Set(events.filter((event) => event.isCompleted).map((event) => event.eventName));
  const levels = MESSAGE_LEVELS.map((level) => ({ ...level, done: done.has(level.eventName) }));
  const doneCount = levels.filter((level) => level.done).length;

  return {
    levels,
    doneCount,
    total: MESSAGE_LEVELS.length,
    percent: Math.round((doneCount / MESSAGE_LEVELS.length) * 100),
  };
}
