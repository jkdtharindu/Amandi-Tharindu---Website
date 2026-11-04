import {
  listAllGuests,
  listAllInvitees,
  listAllRsvpResponses,
  listGuestsByParty,
} from './adminRepo.js';
import { computeCodeBreakdown, computeRsvpStats } from './guestQueries.js';
import { summarizeAnswers } from './answerSummary.js';
import { computeMessagingStats } from '../messaging/messagingStats.js';
import { getMessageEventsByGuest } from '../messaging/messageEventsRepo.js';

/**
 * The RSVP dashboard's two stat rows (the signed-in side's counts and the whole
 * wedding's) plus the per-invitation-code table. All come from the same guest
 * data, so they cannot disagree on what an "accepted" guest is (the lesson of
 * Action 77's Table Arrangement bug).
 *
 * @param {'bride' | 'groom'} party
 */
export async function loadDashboardStats(party) {
  const otherParty = party === 'bride' ? 'groom' : 'bride';
  const [sideGuests, otherGuests, allGuests, responses, invitees] = await Promise.all([
    listGuestsByParty(party),
    listGuestsByParty(otherParty),
    listAllGuests(),
    listAllRsvpResponses(),
    listAllInvitees(),
  ]);

  return {
    sideStats: computeRsvpStats(sideGuests, responses),
    overallStats: computeRsvpStats(allGuests, responses),
    sideBreakdown: computeCodeBreakdown(sideGuests, responses, invitees),
    otherBreakdown: computeCodeBreakdown(otherGuests, responses, invitees),
    overallBreakdown: computeCodeBreakdown(allGuests, responses, invitees),
    // Person-by-person answers per code (who is still to reply), same data as the rows above.
    sideAnswers: summarizeAnswers(sideGuests, responses, invitees),
    otherAnswers: summarizeAnswers(otherGuests, responses, invitees),
  };
}

/**
 * Messaging progress for the dashboard: the signed-in side, the other side and
 * both together. Never throws: if the messaging data cannot be read, the
 * dashboard still shows its RSVP numbers (returns null).
 *
 * @param {'bride' | 'groom'} party
 */
export async function loadMessagingDashboard(party) {
  try {
    const otherParty = party === 'bride' ? 'groom' : 'bride';
    const [sideGuests, otherGuests, responses, invitees] = await Promise.all([
      listGuestsByParty(party),
      listGuestsByParty(otherParty),
      listAllRsvpResponses(),
      listAllInvitees(),
    ]);
    const everyone = [...sideGuests, ...otherGuests];
    const events = await getMessageEventsByGuest(everyone.map((guest) => guest.id));
    const answers = summarizeAnswers(everyone, responses, invitees).byGuestId;

    return {
      side: computeMessagingStats(sideGuests, answers, events),
      other: computeMessagingStats(otherGuests, answers, events),
      overall: computeMessagingStats(everyone, answers, events),
    };
  } catch (error) {
    console.error('loadMessagingDashboard failed, hiding the messaging summary:', error);
    return null;
  }
}

