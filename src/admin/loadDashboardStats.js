import { listAllGuests, listAllRsvpResponses, listGuestsByParty } from './adminRepo.js';
import { computeRsvpStats } from './guestQueries.js';

/**
 * The RSVP dashboard's two stat rows: the signed-in side's counts and the whole
 * wedding's. Both come from the same `computeRsvpStats`, so they cannot disagree
 * on what an "accepted" guest is (the lesson of Action 77's Table Arrangement bug).
 *
 * @param {'bride' | 'groom'} party
 */
export async function loadDashboardStats(party) {
  const [sideGuests, allGuests, responses] = await Promise.all([
    listGuestsByParty(party),
    listAllGuests(),
    listAllRsvpResponses(),
  ]);

  return {
    sideStats: computeRsvpStats(sideGuests, responses),
    overallStats: computeRsvpStats(allGuests, responses),
  };
}
