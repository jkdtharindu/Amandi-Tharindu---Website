import { MESSAGE_LEVELS } from './messageLevels.js';

/**
 * Messaging progress for the dashboard: for each message step, how many guests
 * have been messaged and how many are still to message.
 *
 * Who a step is "for" follows how the steps are used:
 *   Step 1 Main invitation, Step 2 Guest code: every guest
 *   Step 3 RSVP reminder: anyone still to answer (nobody answered, or only some
 *          of the people in the code have)
 *   Step 4 Table number: codes where at least one person accepted
 *
 * Only guests with a WhatsApp number can be messaged; the rest are counted
 * separately as "no number" so they do not look like unfinished work.
 *
 * @param {any[]} guests              guests of one side (or both)
 * @param {Record<string, any>} answers   summarizeAnswers(...).byGuestId
 * @param {Record<string, {eventName: string, isCompleted: boolean}[]>} eventsByGuest
 */
const AUDIENCE = {
  main_invitation: () => true,
  guest_code: () => true,
  rsvp_reminder: (_guest, answer) => (answer ? answer.state !== 'complete' : true),
  table_update: (guest, answer) => (answer ? answer.accepted > 0 : guest.rsvpStatus === 'accepted'),
};

const hasNumber = (guest) => Boolean(String(guest.whatsappNumber ?? '').trim());

const doneSet = (events = []) =>
  new Set(events.filter((event) => event.isCompleted).map((event) => event.eventName));

export function computeMessagingStats(guests = [], answers = {}, eventsByGuest = {}) {
  const active = guests.filter((guest) => !guest.isDeleted);

  const levels = MESSAGE_LEVELS.map((level) => {
    const inAudience = AUDIENCE[level.key] ?? (() => true);
    let sent = 0;
    let toSend = 0;
    let noNumber = 0;

    for (const guest of active) {
      if (!inAudience(guest, answers[guest.id])) continue;
      if (!hasNumber(guest)) {
        noNumber += 1;
        continue;
      }
      if (doneSet(eventsByGuest[guest.id]).has(level.eventName)) sent += 1;
      else toSend += 1;
    }

    return { key: level.key, number: level.number, label: level.label, sent, toSend, noNumber };
  });

  const withNumber = active.filter(hasNumber);
  const fullyMessaged = withNumber.filter((guest) => {
    const done = doneSet(eventsByGuest[guest.id]);
    return MESSAGE_LEVELS.every((level) => done.has(level.eventName));
  }).length;

  return {
    levels,
    totals: {
      codes: active.length,
      withNumber: withNumber.length,
      noNumber: active.length - withNumber.length,
      fullyMessaged,
    },
  };
}
