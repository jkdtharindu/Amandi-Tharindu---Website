/**
 * RSVP aggregation for the admin dashboard (P0-08).
 *
 * Kept as a pure function over plain records so the counting rules are testable
 * on their own and identical whether the rows came from the in-memory store or
 * from Postgres. The couple books catering against these numbers.
 */

/** A guest is counted only while they are still invited. */
function isLive(guest) {
  return guest && guest.isDeleted !== true;
}

/**
 * Heads attending for one accepting family.
 *
 * `POST /api/guest/rsvp` does not enforce that an acceptance carries participant
 * names (only the page JS asks for them), so a nameless acceptance is possible.
 * It is counted as one head rather than zero: accepting means at least the guest
 * themselves is coming, and understating is the direction that costs money on
 * the day.
 */
function headsFor(response) {
  const names = Array.isArray(response.participantNames) ? response.participantNames : [];
  return names.length > 0 ? names.length : 1;
}

export function computeRsvpStats(guests = [], responses = []) {
  const live = (guests || []).filter(isLive);
  const liveIds = new Set(live.map((guest) => guest.id));

  // Index responses by guest so the pass below stays O(n), and ignore any
  // response belonging to a guest who has since been removed.
  const responseByGuest = new Map();
  for (const response of responses || []) {
    if (liveIds.has(response.guestId)) {
      responseByGuest.set(response.guestId, response);
    }
  }

  let acceptedFamilies = 0;
  let acceptedHeadcount = 0;
  let declinedFamilies = 0;
  let pendingFamilies = 0;
  let totalSlots = 0;

  for (const guest of live) {
    totalSlots += Number(guest.slotCount) || 0;

    const response = responseByGuest.get(guest.id);
    if (!response) {
      pendingFamilies += 1;
    } else if (response.attending) {
      acceptedFamilies += 1;
      acceptedHeadcount += headsFor(response);
    } else {
      declinedFamilies += 1;
    }
  }

  const totalInvited = live.length;
  const answered = acceptedFamilies + declinedFamilies;

  return {
    totalInvited,
    totalSlots,
    acceptedFamilies,
    acceptedHeadcount,
    declinedFamilies,
    pendingFamilies,
    // Guard the divide: an empty guest list is a real state on day one.
    responseRate: totalInvited === 0 ? 0 : Math.round((answered / totalInvited) * 100),
  };
}
