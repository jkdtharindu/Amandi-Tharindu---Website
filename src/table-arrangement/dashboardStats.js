/**
 * The Table Arrangement dashboard's headline numbers (P1-16).
 *
 * One formula, used both for the page's first render and by the refresh
 * endpoint the page calls after every seat/table action. Until Next Action 29
 * it lived only inline in `app/admin/table-arrangement/page.tsx`, so the
 * numbers were computed once per page load and then went stale: an admin who
 * seated twenty guests in one sitting kept seeing "Table Arranged: 0" until a
 * hard reload. Keeping the formula in one place is also what stops the two
 * callers quietly disagreeing later.
 *
 * Pure — callers fetch the inputs, so the page can reuse what it already
 * loaded for other purposes rather than querying twice.
 *
 * All counts use the same unit (people, not families) so the numbers are
 * directly comparable. An accepted family of 3 contributes 1 to "Accepted"
 * and 1-3 to "Table Arranged" depending on how many are seated (Action 61).
 *
 * `side`, when given, is the side the row is for. Its `tables` then include the
 * Common tables (Action 68), where the other side's people sit too, so only
 * seats whose `occupantSide` is this side count as this side's seated people —
 * including this side's own people at a Common table. Without `side` (the
 * wedding row) every seated invitee counts.
 *
 * @param {object} input
 * @param {{ seats: { inviteeId: string | null, occupantSide?: string | null }[] }[]} input.tables
 * @param {{ rsvpStatus: string, participantCount?: number }[]} input.assignedGuests
 * @param {{ participantCount?: number }[]} input.unassignedGuests
 * @param {{ participantCount?: number }[]} input.unassignedInvitees
 * @param {{ acceptedHeadcount: number, declined: number, pending: number }} input.rsvpStats
 * @param {'bride' | 'groom'} [input.side]
 */
export function buildDashboardStats({
  tables,
  assignedGuests,
  unassignedGuests,
  unassignedInvitees,
  rsvpStats,
  side,
}) {
  // Seated invitees (individuals from a multi-person invitation) count toward
  // "Table Arranged" the same as seated guest parties do.
  const seatedInviteeCount = tables.reduce(
    (total, table) =>
      total + table.seats.filter((seat) => seat.inviteeId && (!side || seat.occupantSide === side)).length,
    0
  );

  // Only guests who are both seated AND still RSVP-accepted count here — a
  // seated guest who later changes their answer to declined stops counting
  // without needing to be auto-unseated (Action 61 — detect and exclude declined).
  const seatedAcceptedGuests = assignedGuests.filter(
    (guest) => guest.rsvpStatus === 'accepted'
  ).length;

  return {
    // Use acceptedHeadcount (people) instead of accepted count (families)
    // so it matches the unit of tableArranged and balanceToArrange (Action 61)
    accepted: rsvpStats.acceptedHeadcount,
    tableArranged: seatedAcceptedGuests + seatedInviteeCount,
    balanceToArrange: countUnseated(unassignedGuests, unassignedInvitees),
    declined: rsvpStats.declined,
    pending: rsvpStats.pending,
  };
}

/**
 * Accepted people still waiting for a seat: "Balance to Arrange", and each side's
 * unseated count in the leftover summary (Action 68) — one formula for both.
 * Headcount from multi-person invitations, or 1 per family.
 */
export function countUnseated(unassignedGuests, unassignedInvitees) {
  const unassignedGuestHeadcount = unassignedGuests.reduce(
    (total, guest) => total + (guest.participantCount || 1),
    0
  );
  const unassignedInviteeHeadcount = unassignedInvitees.reduce(
    (total, invitee) => total + (invitee.participantCount || 1),
    0
  );
  return unassignedGuestHeadcount + unassignedInviteeHeadcount;
}
