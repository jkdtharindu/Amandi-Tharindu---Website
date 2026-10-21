import {
  listAllGuests,
  listAllInvitees,
  listAllRsvpResponses,
  listGuestsByParty,
} from './adminRepo.js';
import { computeCodeBreakdown, computeRsvpStats } from './guestQueries.js';

/**
 * The RSVP dashboard's two stat rows (the signed-in side's counts and the whole
 * wedding's) plus the per-invitation-code table. All come from the same guest
 * data, so they cannot disagree on what an "accepted" guest is (the lesson of
 * Action 77's Table Arrangement bug).
 *
 * @param {'bride' | 'groom'} party
 */
export async function loadDashboardStats(party) {
  const [sideGuests, allGuests, responses, invitees] = await Promise.all([
    listGuestsByParty(party),
    listAllGuests(),
    listAllRsvpResponses(),
    listAllInvitees(),
  ]);

  return {
    sideStats: computeRsvpStats(sideGuests, responses),
    overallStats: computeRsvpStats(allGuests, responses),
    sideBreakdown: computeCodeBreakdown(sideGuests, responses, invitees),
    overallBreakdown: computeCodeBreakdown(allGuests, responses, invitees),
  };
}
