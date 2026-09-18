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
 * @param {object} input
 * @param {{ seats: { inviteeId: string | null }[] }[]} input.tables
 * @param {{ rsvpStatus: string }[]} input.assignedGuests
 * @param {unknown[]} input.unassignedGuests
 * @param {unknown[]} input.unassignedInvitees
 * @param {{ accepted: number, declined: number, pending: number }} input.rsvpStats
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
  // without needing to be auto-unseated.
  const seatedAcceptedGuests = assignedGuests.filter(
    (guest) => guest.rsvpStatus === 'accepted'
  ).length;

  return {
    accepted: rsvpStats.accepted,
    tableArranged: seatedAcceptedGuests + seatedInviteeCount,
    balanceToArrange: unassignedGuests.length + unassignedInvitees.length,
    declined: rsvpStats.declined,
    pending: rsvpStats.pending,
  };
}
