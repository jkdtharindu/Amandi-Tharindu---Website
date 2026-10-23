import { TABLE_UPDATE_TEMPLATE } from '../admin/messageTemplates.js';

// The wording a level starts from, and what "Reset to default" restores. Levels 1
// and 2 mirror the seeded templates (migrations 005, 008, 017); level 3's is
// TABLE_UPDATE_TEMPLATE. Once the admin saves wording it is stored as a row in
// message_templates and this is only the fallback.
const DEFAULT_BODIES = {
  initial_invite:
    'Dear [Name], you are cordially invited to the wedding of Tharindu & Amandi on [Date]. Please view your personal invitation and RSVP at [Link] using your code: [Code]. We look forward to celebrating with you! 💍',
  reminder_1:
    "Dear [Name], this is a gentle reminder to RSVP for Tharindu & Amandi's wedding on [Date]. Your personal invitation: [Link] (Code: [Code]). We'd love to know if you can join us! 🎊",
};

/**
 * The three WhatsApp message levels, in the order a guest receives them.
 * One list so the guest list ticks, the per-guest pop-up and the Messaging
 * Center cannot disagree on what a level is or what its tick is stored as.
 *
 * `eventName` is the key in message_events (a tick is one row per guest and
 * event, migration 024), so no migration is needed. `templateName` is the
 * message_templates row holding the level's saved wording; `defaultBody` is
 * used until the admin saves their own (level 3 has no seeded row).
 * `shareTag` ends the link sent in that level's message (/s/<tag>) and `shareCard`
 * is the fixed WhatsApp card wording for it (PRD section 24).
 */
export const MESSAGE_LEVELS = [
  { key: 'main_invitation', number: 1, label: 'Main invitation', eventName: 'Main Invitation', shareTag: 'invitation', shareCard: "You're invited. Open your personal invitation with your code.", templateName: 'initial_invite', defaultBody: DEFAULT_BODIES.initial_invite },
  { key: 'rsvp_reminder', number: 2, label: 'RSVP reminder', eventName: 'RSVP Reminder', shareTag: 'reminder', shareCard: 'A gentle reminder to RSVP. Open your invitation with your code.', templateName: 'reminder_1', defaultBody: DEFAULT_BODIES.reminder_1 },
  { key: 'table_update', number: 3, label: 'Table number (final)', eventName: 'Table Details', shareTag: 'table', shareCard: 'Your table details are ready. Open your invitation to see them.', templateName: 'table_update', defaultBody: TABLE_UPDATE_TEMPLATE },
];

/** The level a share link tag belongs to, or undefined for an unknown tag. */
export function levelForShareTag(tag) {
  return MESSAGE_LEVELS.find((level) => level.shareTag === tag);
}

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

/** The saved wording for a level, or its default when nothing is saved yet. */
export function templateBodyFor(level, templates = []) {
  const saved = templates.find((entry) => entry.name === level.templateName);
  return saved?.body?.trim() ? saved.body : level.defaultBody;
}
