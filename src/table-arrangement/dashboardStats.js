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
 * @param {object} input
 * @param {{ seats: { inviteeId: string | null }[] }[]} input.tables
 * @param {{ rsvpStatus: string, participantCount?: number }[]} input.assignedGuests
 * @param {{ participantCount?: number }[]} input.unassignedGuests
 * @param {{ participantCount?: number }[]} input.unassignedInvitees
 * @param {{ acceptedHeadcount: number, declined: number, pending: number }} input.rsvpStats
 */
export function buildDashboardStats({
  tables,
  assignedGuests,
  unassignedGuests,
  unassignedInvitees,
  rsvpStats,
}) {
  // Seated invitees (individuals from a multi-person invitation) count toward
  // "Table Arranged" the same as seated guest parties do.
  const seatedInviteeCount = tables.reduce(
    (total, table) => total + table.seats.filter((seat) => seat.inviteeId).length,
    0
  );

  // Only guests who are both seated AND still RSVP-accepted count here — a
  // seated guest who later changes their answer to declined stops counting
  // without needing to be auto-unseated (Action 61 — detect and exclude declined).
  const seatedAcceptedGuests = assignedGuests.filter(
    (guest) => guest.rsvpStatus === 'accepted'
  ).length;

  // Count unassigned people (headcount from multi-person invitations, or 1 per family)
  const unassignedGuestHeadcount = unassignedGuests.reduce(
    (total, guest) => total + (guest.participantCount || 1),
    0
  );
  const unassignedInviteeHeadcount = unassignedInvitees.reduce(
    (total, invitee) => total + (invitee.participantCount || 1),
    0
  );

  return {
    // Use acceptedHeadcount (people) instead of accepted count (families)
    // so it matches the unit of tableArranged and balanceToArrange (Action 61)
    accepted: rsvpStats.acceptedHeadcount,
    tableArranged: seatedAcceptedGuests + seatedInviteeCount,
    balanceToArrange: unassignedGuestHeadcount + unassignedInviteeHeadcount,
    declined: rsvpStats.declined,
    pending: rsvpStats.pending,
  };
}
