import { NextRequest, NextResponse } from 'next/server';
import {
  assignGuestToSeat,
  assignProbableAttendeeToSeat,
  assignInviteeToSeat,
  isUserFacingError,
} from '@/src/table-arrangement/tableArrangementRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

type RouteContext = { params: Promise<{ tableId: string; seatId: string }> };

/**
 * Assigns a seat to a real Guest, a ProbableAttendee placeholder, or an
 * individual Invitee (P1-14 / P1-16 / multi-person invitations) — exactly
 * one of guestId/probableAttendeeId/inviteeId is required. Rejects if that
 * occupant already holds another seat, or if this seat already holds someone
 * else (Next Action 59) — the seat has to be emptied first. Re-assigning the
 * seat's current occupant is allowed: it is how their notes are saved.
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  const { seatId } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const { guestId, probableAttendeeId, inviteeId, dietaryRequirements, specialNotes } = body as {
    guestId?: string;
    probableAttendeeId?: string;
    inviteeId?: string;
    dietaryRequirements?: string;
    specialNotes?: string;
  };

  const providedCount = [guestId, probableAttendeeId, inviteeId].filter(Boolean).length;
  if (providedCount === 0) {
    return NextResponse.json(
      { success: false, message: 'Guest ID, probable attendee ID, or invitee ID required.' },
      { status: 400 }
    );
  }
  if (providedCount > 1) {
    return NextResponse.json(
      { success: false, message: 'Provide only one of guestId, probableAttendeeId, or inviteeId.' },
      { status: 400 }
    );
  }

  try {
    let seat;
    if (inviteeId) {
      seat = await assignInviteeToSeat(seatId, inviteeId, { dietaryRequirements, specialNotes });
    } else if (probableAttendeeId) {
      seat = await assignProbableAttendeeToSeat(seatId, probableAttendeeId, { dietaryRequirements, specialNotes });
    } else {
      seat = await assignGuestToSeat(seatId, guestId, { dietaryRequirements, specialNotes });
    }
    return NextResponse.json({ success: true, seat });
  } catch (error) {
    // "already assigned to another seat" is the admin's answer; a constraint
    // violation's raw text is not (Next Action 34).
    if (isUserFacingError(error)) {
      return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 });
    }
    console.error('Failed to assign seat:', error);
    return NextResponse.json(
      { success: false, message: 'Could not assign that seat. Please try again.' },
      { status: 500 }
    );
  }
}
