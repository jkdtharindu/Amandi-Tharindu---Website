import {
  listSeatingTables,
  listSeatingTablesByParty,
  listUnassignedGuests,
  listUnassignedGuestsByParty,
  listAssignedGuests,
  listAssignedGuestsByParty,
  listUnassignedInvitees,
  listUnassignedProbableAttendees,
  getProbableAttendanceSummary,
} from './tableArrangementRepo.js';
import { listAllGuests, listAllRsvpResponses, listGuestsByParty } from '../admin/adminRepo.js';
import { computeRsvpStats } from '../admin/guestQueries.js';
import { buildDashboardStats } from './dashboardStats.js';

/**
 * The Table Arrangement screen for one side, shared by the page and its refresh endpoint.
 * Side membership must come from the SQL-filtered `...ByParty` functions: `mapGuestRow`
 * drops `assigned_to_party`, so a JS filter would put every real guest on the bride's side.
 *
 * @param {'bride' | 'groom'} party
 */
export async function loadTableArrangementView(party) {
  const [
    tables,
    unassignedGuests,
    assignedGuests,
    allTables,
    allUnassignedGuests,
    allAssignedGuests,
    unassignedInvitees,
    unassignedProbableAttendees,
    probableAttendanceSummary,
    sideGuests,
    allGuests,
    responses,
  ] = await Promise.all([
    listSeatingTablesByParty(party),
    listUnassignedGuestsByParty(party),
    listAssignedGuestsByParty(party),
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

  const sideGuestIds = new Set(sideGuests.map((guest) => guest.id));

  return {
    tables,
    unassignedGuests,
    unassignedInvitees,
    unassignedProbableAttendees,
    probableAttendanceSummary,
    dashboardStats: buildDashboardStats({
      tables,
      assignedGuests,
      unassignedGuests,
      unassignedInvitees: unassignedInvitees.filter((invitee) => sideGuestIds.has(invitee.guestId)),
      rsvpStats: computeRsvpStats(sideGuests, responses),
    }),
    overallDashboardStats: buildDashboardStats({
      tables: allTables,
      assignedGuests: allAssignedGuests,
      unassignedGuests: allUnassignedGuests,
      unassignedInvitees,
      rsvpStats: computeRsvpStats(allGuests, responses),
    }),
  };
}
