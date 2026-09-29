import {
  guestIsOnSide,
  inviteeIsOnSide,
  seatIsOnSideTable,
  seatOccupantSide,
  visibleTableSide,
} from '../admin/sideAccess.js';
import { COMMON } from './tableSides.js';

/**
 * Who may seat whom, and who may unseat whom (PRD §20, TASKS.md Action 68) —
 * decided on the server for every request, whatever the screen offered.
 *
 * Seating: the seat must be at the signed-in side's own table or a Common table,
 * and a guest or invitee being seated must be on the signed-in side. Together
 * that means a person only ever sits at their own side's table or a Common
 * table: a bride admin can neither seat anyone at a groom table nor seat a
 * groom person anywhere. Probable placeholders are one shared pool (the owner's
 * answer), so any seat the side can reach takes one.
 *
 * Unseating: a side clears any seat at its own tables, as before. At a Common
 * table it clears its own people and placeholders, never the other side's.
 *
 * Each function returns null when the action is allowed, or `{ status, message }`
 * for the route to send. 404 means "not yours to see": the other side's own
 * tables and people look exactly like ids that do not exist (Action 73). 403 is
 * used only where the thing is already visible — the other side's person
 * sitting at a Common table.
 *
 * `exec` is injectable so tests can drive the SQL path; production omits it.
 */

const SEAT_NOT_FOUND = { status: 404, message: 'Seat not found.' };

export async function seatAssignmentRefusal({ tableId, seatId, party, guestId, inviteeId }, exec) {
  if (!(await seatIsOnSideTable(tableId, seatId, party, exec))) return SEAT_NOT_FOUND;
  if (guestId && !(await guestIsOnSide(guestId, party, exec))) {
    return { status: 404, message: 'Guest not found.' };
  }
  if (inviteeId && !(await inviteeIsOnSide(inviteeId, party, exec))) {
    return { status: 404, message: 'That person was not found.' };
  }
  return null;
}

export async function seatRemovalRefusal({ tableId, seatId, party }, exec) {
  const tableSide = await visibleTableSide(tableId, party, exec);
  if (!tableSide || !(await seatIsOnSideTable(tableId, seatId, party, exec))) return SEAT_NOT_FOUND;

  if (tableSide === COMMON) {
    const occupantSide = await seatOccupantSide(seatId, exec);
    if (occupantSide && occupantSide !== party) {
      return {
        status: 403,
        message: "This guest is on the other side's list. Only their admin can move them off a Common table.",
      };
    }
  }
  return null;
}
