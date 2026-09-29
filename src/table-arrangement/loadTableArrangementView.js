import {
  listSeatingTables,
  listSeatingTablesByParty,
  listUnassignedGuests,
  listUnassignedGuestsByParty,
  listAssignedGuests,
  listAssignedGuestsByParty,
  listUnassignedInvitees,
  listUnassignedInviteesByParty,
  listUnassignedProbableAttendees,
  getProbableAttendanceSummary,
} from './tableArrangementRepo.js';
import { listAllGuests, listAllRsvpResponses, listGuestsByParty } from '../admin/adminRepo.js';
import { computeRsvpStats } from '../admin/guestQueries.js';
import { buildDashboardStats, countUnseated } from './dashboardStats.js';
import { buildLeftoverSummary } from './tableSides.js';

/**
 * The Table Arrangement screen for one side, shared by the page and its refresh endpoint.
 * Side membership must come from the SQL-filtered `...ByParty` functions: `mapGuestRow`
 * drops `assigned_to_party`, so a JS filter would put every real guest on the bride's side.
 *
 * `tables` is the side's own tables plus every Common table (Action 68). The other
 * side's rows are read only to be turned into counts for the leftover summary and
 * the wedding row; no name, id or table of theirs is returned.
 *
 * @param {'bride' | 'groom'} party
 */
export async function loadTableArrangementView(party) {
  const otherSide = party === 'groom' ? 'bride' : 'groom';
  const [
    tables,
    unassignedGuests,
    assignedGuests,
    unassignedInvitees,
    otherUnassignedGuests,
    otherUnassignedInvitees,
    allTables,
    allUnassignedGuests,
    allAssignedGuests,
    allUnassignedInvitees,
    unassignedProbableAttendees,
    probableAttendanceSummary,
    sideGuests,
    allGuests,
    responses,
  ] = await Promise.all([
    listSeatingTablesByParty(party),
    listUnassignedGuestsByParty(party),
    listAssignedGuestsByParty(party),
    listUnassignedInviteesByParty(party),
    listUnassignedGuestsByParty(otherSide),
    listUnassignedInviteesByParty(otherSide),
    listSeatingTables(),
    listUnassignedGuests(),
    listAssignedGuests(),
    listUnassignedInvitees(),
    listUnassignedProbableAttendees(),
    getProbableAttendanceSummary(),
    listGuestsByParty(party),
    listAllGuests(),
    listAllRsvpResponses(),
  ]);

  const dashboardStats = buildDashboardStats({
    tables,
    side: party,
    assignedGuests,
    unassignedGuests,
    unassignedInvitees,
    rsvpStats: computeRsvpStats(sideGuests, responses),
  });

  return {
    party,
    tables,
    unassignedGuests,
    unassignedInvitees,
    unassignedProbableAttendees,
    probableAttendanceSummary,
    dashboardStats,
    overallDashboardStats: buildDashboardStats({
      tables: allTables,
      assignedGuests: allAssignedGuests,
      unassignedGuests: allUnassignedGuests,
      unassignedInvitees: allUnassignedInvitees,
      rsvpStats: computeRsvpStats(allGuests, responses),
    }),
    leftoverSummary: buildLeftoverSummary({
      tables: allTables,
      unseated: {
        [party]: dashboardStats.balanceToArrange,
        [otherSide]: countUnseated(otherUnassignedGuests, otherUnassignedInvitees),
      },
    }),
  };
}
