import { NextRequest, NextResponse } from 'next/server';
import {
  listSeatingTables,
  listSeatingTablesByParty,
  createSeatingTable,
  listUnassignedGuests,
  listUnassignedGuestsByParty,
  listAssignedGuests,
  listAssignedGuestsByParty,
  listUnassignedInvitees,
  listUnassignedProbableAttendees,
  getProbableAttendanceSummary,
  isUserFacingError,
} from '@/src/table-arrangement/tableArrangementRepo.js';
import { listAllGuests, listAllRsvpResponses, listGuestsByParty, getPartyStats } from '@/src/admin/adminRepo.js';
import { computeRsvpStats } from '@/src/admin/guestQueries.js';
import { buildDashboardStats } from '@/src/table-arrangement/dashboardStats.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/**
 * Every seating table with its seats, accepted guests not yet seated (P1-14),
 * accepted individual invitees not yet seated (multi-person invitations,
 * 2026-09), the ProbableAttendee buffer state (P1-16), and the dashboard's
 * headline numbers — one read endpoint so the client's existing post-action
 * refresh picks all of it up for free. The stats were added for Next Action
 * 29: they used to be computed only at page load, so they went stale the
 * moment an admin seated anyone.
 *
 * Updated 2026-09-20: Filtered by party (bride or groom) for multi-admin support (P1-14H).
 */
export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  const [
    tables,
    unassignedGuests,
    assignedGuests,
    unassignedInvitees,
    unassignedProbableAttendees,
    probableAttendanceSummary,
    allGuests,
    partyGuests,
    responses,
  ] = await Promise.all([
    listSeatingTablesByParty(session.party),
    listUnassignedGuestsByParty(session.party),
    listAssignedGuestsByParty(session.party),
    listUnassignedInvitees(),
    listUnassignedProbableAttendees(),
    getProbableAttendanceSummary(),
    listAllGuests(),
    listGuestsByParty(session.party),
    listAllRsvpResponses(),
  ]);

  const partyStats = await getPartyStats(session.party);
  const overallStats = computeRsvpStats(allGuests.filter((g: { isDeleted?: boolean }) => !g.isDeleted), responses);

  return NextResponse.json({
    success: true,
    tables,
    unassignedGuests,
    unassignedInvitees,
    unassignedProbableAttendees,
    probableAttendanceSummary,
    dashboardStats: buildDashboardStats({
      tables,
      assignedGuests,
      unassignedGuests,
      unassignedInvitees,
      rsvpStats: partyStats,
    }),
    stats: {
      party: partyStats,
      overall: overallStats,
    },
    party: session.party,
  });
}

/** Creates a seating table with `capacity` empty seats for the logged-in admin's party (P1-14, P1-14H). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const { tableNumber, tableName, capacity } = body as {
    tableNumber?: number;
    tableName?: string;
    capacity?: number;
  };

  if (!tableNumber || tableNumber < 1) {
    return NextResponse.json({ success: false, message: 'Valid table number required.' }, { status: 400 });
  }
  if (!capacity || capacity < 1 || capacity > 100) {
    return NextResponse.json({ success: false, message: 'Capacity must be between 1 and 100.' }, { status: 400 });
  }

  try {
    const table = await createSeatingTable({ tableNumber, tableName, capacity, party: session.party });
    return NextResponse.json({ success: true, table }, { status: 201 });
  } catch (error) {
    // Domain errors ("that table number is taken") are written for the admin
    // and pass through; anything else is a fault whose text could carry
    // Postgres detail, so it is logged and replaced (Next Action 34).
    if (isUserFacingError(error)) {
      return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 });
    }
    console.error('Failed to create seating table:', error);
    return NextResponse.json(
      { success: false, message: 'Could not create the table. Please try again.' },
      { status: 500 }
    );
  }
}
