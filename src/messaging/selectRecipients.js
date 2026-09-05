/**
 * Picks the audience for a bulk WhatsApp run (PRD P1-06).
 *
 * Pure, so the admin UI can show the audience size before anything is opened.
 * A "recipient" is a guest who is still on the list, matches the chosen
 * filters, and has a number to message — guests without one are counted
 * rather than silently dropped, since the admin usually wants to know.
 */
export function selectRecipients(guests = [], filters = {}) {
  const { status = 'pending', relationship = 'all', skipGuestIds = [] } = filters;
  const skip = new Set(skipGuestIds);

  const recipients = [];
  let noNumberCount = 0;
  let alreadySentCount = 0;

  for (const guest of guests) {
    if (guest.isDeleted) continue;
    if (status && status !== 'all' && guest.rsvpStatus !== status) continue;
    if (relationship && relationship !== 'all' && guest.relationship !== relationship) continue;

    if (!String(guest.whatsappNumber ?? '').trim()) {
      noNumberCount += 1;
      continue;
    }

    // Counted only for guests who were otherwise in the audience, so the
    // "already sent" number reads as progress through this run.
    if (skip.has(guest.id)) {
      alreadySentCount += 1;
      continue;
    }

    recipients.push(guest);
  }

  recipients.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));

  return { recipients, noNumberCount, alreadySentCount };
}
